import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseConfig, MigrationJob, MigrationStrategy, SchemaDefinition, MigrationLog } from '../types';
import { DatabaseAdapter } from './DatabaseAdapter';
import { SchemaEvolution } from './SchemaEvolution';
import { DataMigrator } from './DataMigrator';
import { ZeroDowntimeManager } from './ZeroDowntimeManager';

export class MigrationEngine extends EventEmitter {
  private jobs: Map<string, MigrationJob> = new Map();
  private adapters: Map<string, DatabaseAdapter> = new Map();
  private schemaEvolution: SchemaEvolution;
  private dataMigrator: DataMigrator;
  private zeroDowntime: ZeroDowntimeManager;

  constructor() {
    super();
    this.schemaEvolution = new SchemaEvolution();
    this.dataMigrator = new DataMigrator();
    this.zeroDowntime = new ZeroDowntimeManager();
  }

  async createMigration(
    sourceConfig: DatabaseConfig,
    targetConfig: DatabaseConfig,
    schema: SchemaDefinition,
    strategy: MigrationStrategy
  ): Promise<MigrationJob> {
    const jobId = uuidv4();
    const job: MigrationJob = {
      id: jobId,
      status: 'pending',
      sourceDatabase: sourceConfig,
      targetDatabase: targetConfig,
      strategy,
      schema,
      progress: 0,
      logs: []
    };

    this.jobs.set(jobId, job);
    this.emit('jobCreated', job);
    
    return job;
  }

  async startMigration(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Migration job ${jobId} not found`);
    }

    job.status = 'running';
    job.startTime = new Date();
    job.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Starting migration with strategy: ${job.strategy.name}`
    });

    this.emit('jobStarted', job);

    try {
      await this.executeMigration(job);
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.logs.push({
        timestamp: new Date(),
        level: 'error',
        message: `Migration failed: ${job.error}`
      });
      this.emit('jobFailed', job);
      throw error;
    }
  }

  private async executeMigration(job: MigrationJob): Promise<void> {
    const sourceAdapter = await this.getAdapter(job.sourceDatabase);
    const targetAdapter = await this.getAdapter(job.targetDatabase);

    job.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: 'Initializing database connections'
    });

    if (job.strategy.downtime) {
      await this.executeWithDowntime(job, sourceAdapter, targetAdapter);
    } else {
      await this.executeZeroDowntime(job, sourceAdapter, targetAdapter);
    }

    job.status = 'completed';
    job.endTime = new Date();
    job.progress = 100;
    job.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: 'Migration completed successfully'
    });

    this.emit('jobCompleted', job);
  }

  private async executeWithDowntime(
    job: MigrationJob,
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter
  ): Promise<void> {
    job.logs.push({
      timestamp: new Date(),
      level: 'warn',
      message: 'Executing migration with planned downtime'
    });

    await this.schemaEvolution.migrateSchema(sourceAdapter, targetAdapter, job.schema);
    job.progress = 30;

    await this.dataMigrator.migrateData(sourceAdapter, targetAdapter, job.schema, (progress) => {
      job.progress = 30 + (progress * 0.6);
      this.emit('jobProgress', job);
    });
    job.progress = 90;

    await this.validateMigration(sourceAdapter, targetAdapter, job.schema);
    job.progress = 100;
  }

  private async executeZeroDowntime(
    job: MigrationJob,
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter
  ): Promise<void> {
    job.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: 'Executing zero-downtime migration'
    });

    await this.zeroDowntime.setupShadowWrites(sourceAdapter, targetAdapter);
    job.progress = 10;

    await this.schemaEvolution.migrateSchema(sourceAdapter, targetAdapter, job.schema);
    job.progress = 30;

    await this.dataMigrator.migrateDataIncremental(sourceAdapter, targetAdapter, job.schema, (progress) => {
      job.progress = 30 + (progress * 0.5);
      this.emit('jobProgress', job);
    });
    job.progress = 80;

    await this.zeroDowntime.cutover(sourceAdapter, targetAdapter);
    job.progress = 95;

    await this.validateMigration(sourceAdapter, targetAdapter, job.schema);
    job.progress = 100;
  }

  private async validateMigration(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter,
    schema: SchemaDefinition
  ): Promise<void> {
    for (const table of schema.tables) {
      const sourceCount = await sourceAdapter.getCount(table.name);
      const targetCount = await targetAdapter.getCount(table.name);
      
      if (sourceCount !== targetCount) {
        throw new Error(`Data validation failed for table ${table.name}: source=${sourceCount}, target=${targetCount}`);
      }
    }
  }

  private async getAdapter(config: DatabaseConfig): Promise<DatabaseAdapter> {
    const key = `${config.type}://${config.host}:${config.port}/${config.database}`;
    
    if (!this.adapters.has(key)) {
      const adapter = DatabaseAdapter.create(config);
      await adapter.connect();
      this.adapters.set(key, adapter);
    }
    
    return this.adapters.get(key)!;
  }

  async pauseMigration(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') {
      throw new Error(`Cannot pause job ${jobId}`);
    }

    job.status = 'paused';
    job.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: 'Migration paused'
    });
    this.emit('jobPaused', job);
  }

  async resumeMigration(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'paused') {
      throw new Error(`Cannot resume job ${jobId}`);
    }

    job.status = 'running';
    job.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: 'Migration resumed'
    });
    this.emit('jobResumed', job);
  }

  async rollbackMigration(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || !job.strategy.rollbackSupported) {
      throw new Error(`Rollback not supported for job ${jobId}`);
    }

    job.status = 'running';
    job.logs.push({
      timestamp: new Date(),
      level: 'warn',
      message: 'Starting rollback'
    });

    try {
      const targetAdapter = await this.getAdapter(job.targetDatabase);
      const sourceAdapter = await this.getAdapter(job.sourceDatabase);
      
      await this.schemaEvolution.rollbackSchema(targetAdapter, sourceAdapter, job.schema);
      await this.dataMigrator.rollbackData(targetAdapter, sourceAdapter, job.schema);

      job.status = 'completed';
      job.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Rollback completed successfully'
      });
      this.emit('jobRollback', job);
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Rollback failed';
      this.emit('jobFailed', job);
      throw error;
    }
  }

  getJob(jobId: string): MigrationJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): MigrationJob[] {
    return Array.from(this.jobs.values());
  }

  async cleanup(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.disconnect();
    }
    this.adapters.clear();
  }
}
