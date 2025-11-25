import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { MigrationEngine } from './core/MigrationEngine';
import { AIOptimizer } from './ai/AIOptimizer';
import { HealthChecker } from './monitoring/HealthChecker';
import { DatabaseAdapter } from './core/DatabaseAdapter';
import { MigrationStrategy, SchemaDefinition, DatabaseConfig } from './types';

dotenv.config();

export class CodeMorphServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private migrationEngine: MigrationEngine;
  private aiOptimizer: AIOptimizer;
  private healthChecker: HealthChecker;
  private databaseAdapter: DatabaseAdapter | null = null;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.migrationEngine = new MigrationEngine();
    this.aiOptimizer = new AIOptimizer(process.env.OPENAI_API_KEY || '');
    this.healthChecker = new HealthChecker(this.databaseAdapter!);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupEventListeners();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      next();
    });
  }

  private setupRoutes(): void {
    this.app.get('/api/health', async (req, res) => {
      try {
        const health = await this.healthChecker.performDeepHealthCheck();
        res.json(health);
      } catch (error) {
        res.status(500).json({ error: 'Health check failed' });
      }
    });

    this.app.get('/api/metrics', async (req, res) => {
      try {
        const metrics = await this.healthChecker.getSystemMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get metrics' });
      }
    });

    this.app.post('/api/migrations', async (req, res) => {
      try {
        const { sourceDatabase, targetDatabase, schema, constraints } = req.body;
        
        const strategies = await this.aiOptimizer.optimizeMigrationStrategy(
          sourceDatabase,
          targetDatabase,
          schema,
          constraints
        );

        const job = await this.migrationEngine.createMigration(
          sourceDatabase,
          targetDatabase,
          schema,
          strategies[0]
        );

        res.json({ job, strategies });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create migration' });
      }
    });

    this.app.post('/api/migrations/:id/start', async (req, res) => {
      try {
        const { id } = req.params;
        await this.migrationEngine.startMigration(id);
        res.json({ message: 'Migration started' });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to start migration' });
      }
    });

    this.app.post('/api/migrations/:id/pause', async (req, res) => {
      try {
        const { id } = req.params;
        await this.migrationEngine.pauseMigration(id);
        res.json({ message: 'Migration paused' });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to pause migration' });
      }
    });

    this.app.post('/api/migrations/:id/resume', async (req, res) => {
      try {
        const { id } = req.params;
        await this.migrationEngine.resumeMigration(id);
        res.json({ message: 'Migration resumed' });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to resume migration' });
      }
    });

    this.app.post('/api/migrations/:id/rollback', async (req, res) => {
      try {
        const { id } = req.params;
        await this.migrationEngine.rollbackMigration(id);
        res.json({ message: 'Migration rolled back' });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to rollback migration' });
      }
    });

    this.app.get('/api/migrations', (req, res) => {
      try {
        const jobs = this.migrationEngine.getAllJobs();
        res.json(jobs);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get migrations' });
      }
    });

    this.app.get('/api/migrations/:id', (req, res) => {
      try {
        const { id } = req.params;
        const job = this.migrationEngine.getJob(id);
        if (!job) {
          return res.status(404).json({ error: 'Migration not found' });
        }
        res.json(job);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get migration' });
      }
    });

    this.app.post('/api/analyze-schema', async (req, res) => {
      try {
        const { schema } = req.body;
        const recommendations = await this.aiOptimizer.analyzeSchema(schema);
        res.json(recommendations);
      } catch (error) {
        res.status(500).json({ error: 'Failed to analyze schema' });
      }
    });

    this.app.post('/api/predict-complexity', async (req, res) => {
      try {
        const { sourceDatabase, targetDatabase, schema } = req.body;
        const analysis = await this.aiOptimizer.predictMigrationComplexity(
          sourceDatabase,
          targetDatabase,
          schema
        );
        res.json(analysis);
      } catch (error) {
        res.status(500).json({ error: 'Failed to predict complexity' });
      }
    });

    this.app.get('/api/strategies', (req, res) => {
      const defaultStrategies: MigrationStrategy[] = [
        {
          id: 'full-migration',
          name: 'Full Migration with Downtime',
          description: 'Complete migration with scheduled downtime',
          estimatedDuration: 3600000,
          riskLevel: 'medium',
          downtime: true,
          rollbackSupported: true
        },
        {
          id: 'zero-downtime',
          name: 'Zero Downtime Migration',
          description: 'Gradual migration without service interruption',
          estimatedDuration: 7200000,
          riskLevel: 'low',
          downtime: false,
          rollbackSupported: true
        },
        {
          id: 'incremental',
          name: 'Incremental Migration',
          description: 'Phase-by-phase migration with validation',
          estimatedDuration: 14400000,
          riskLevel: 'low',
          downtime: false,
          rollbackSupported: true
        }
      ];
      res.json(defaultStrategies);
    });

    this.app.use(express.static('public'));

    this.app.get('*', (req, res) => {
      res.sendFile('index.html', { root: 'public' });
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('subscribe-migration', (migrationId: string) => {
        socket.join(`migration-${migrationId}`);
        console.log(`Client ${socket.id} subscribed to migration ${migrationId}`);
      });

      socket.on('unsubscribe-migration', (migrationId: string) => {
        socket.leave(`migration-${migrationId}`);
        console.log(`Client ${socket.id} unsubscribed from migration ${migrationId}`);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  private setupEventListeners(): void {
    this.migrationEngine.on('jobCreated', (job) => {
      this.io.emit('migration-created', job);
      this.io.to(`migration-${job.id}`).emit('migration-updated', job);
    });

    this.migrationEngine.on('jobStarted', (job) => {
      this.io.to(`migration-${job.id}`).emit('migration-started', job);
    });

    this.migrationEngine.on('jobProgress', (job) => {
      this.io.to(`migration-${job.id}`).emit('migration-progress', job);
    });

    this.migrationEngine.on('jobCompleted', (job) => {
      this.io.emit('migration-completed', job);
      this.io.to(`migration-${job.id}`).emit('migration-updated', job);
    });

    this.migrationEngine.on('jobFailed', (job) => {
      this.io.emit('migration-failed', job);
      this.io.to(`migration-${job.id}`).emit('migration-updated', job);
    });

    this.migrationEngine.on('jobPaused', (job) => {
      this.io.to(`migration-${job.id}`).emit('migration-paused', job);
    });

    this.migrationEngine.on('jobResumed', (job) => {
      this.io.to(`migration-${job.id}`).emit('migration-resumed', job);
    });

    this.migrationEngine.on('jobRollback', (job) => {
      this.io.to(`migration-${job.id}`).emit('migration-rollback', job);
    });

    this.healthChecker.on('healthStatusChanged', (health) => {
      this.io.emit('health-status-changed', health);
    });

    this.healthChecker.on('healthCheckCompleted', (health) => {
      this.io.emit('health-check-completed', health);
    });
  }

  async start(port = process.env.PORT || 3000): Promise<void> {
    try {
      await this.healthChecker.startHealthChecks();
      
      this.server.listen(port, () => {
        console.log(`🚀 CodeMorph Server running on port ${port}`);
        console.log(`📊 Dashboard: http://localhost:${port}`);
        console.log(`🔌 WebSocket: ws://localhost:${port}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    console.log('Shutting down CodeMorph Server...');
    
    this.healthChecker.stopHealthChecks();
    await this.migrationEngine.cleanup();
    
    this.server.close(() => {
      console.log('Server stopped');
      process.exit(0);
    });
  }
}

if (require.main === module) {
  const server = new CodeMorphServer();
  
  process.on('SIGINT', async () => {
    await server.stop();
  });

  process.on('SIGTERM', async () => {
    await server.stop();
  });

  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
