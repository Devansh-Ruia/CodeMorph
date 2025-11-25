import { EventEmitter } from 'events';
import { DatabaseAdapter } from './DatabaseAdapter';
import { SchemaDefinition } from '../types';

export class ZeroDowntimeManager extends EventEmitter {
  private shadowTables: Map<string, string> = new Map();
  private replicationStreams: Map<string, any> = new Map();
  private cutoverLocks: Map<string, boolean> = new Map();

  async setupShadowWrites(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter
  ): Promise<void> {
    this.emit('shadowWriteSetupStarted');
    
    try {
      const sourceSchema = await this.getFullSchema(sourceAdapter);
      
      for (const table of sourceSchema.tables) {
        const shadowTableName = `${table.name}_shadow`;
        this.shadowTables.set(table.name, shadowTableName);
        
        await targetAdapter.createTable({
          ...table,
          name: shadowTableName
        });
        
        await this.setupTriggers(sourceAdapter, table.name, shadowTableName);
        await this.setupReplication(sourceAdapter, targetAdapter, table.name, shadowTableName);
      }
      
      this.emit('shadowWriteSetupCompleted');
    } catch (error) {
      this.emit('shadowWriteSetupFailed', error);
      throw error;
    }
  }

  private async setupTriggers(
    sourceAdapter: DatabaseAdapter,
    sourceTable: string,
    shadowTable: string
  ): Promise<void> {
    const triggerName = `sync_${sourceTable}_to_${shadowTable}`;
    
    const createTriggerSQL = `
      CREATE OR REPLACE FUNCTION ${triggerName}_func()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO ${shadowTable} SELECT NEW.*;
          RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
          UPDATE ${shadowTable} SET ${this.buildUpdateColumns(sourceAdapter, sourceTable)} WHERE id = NEW.id;
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          DELETE FROM ${shadowTable} WHERE id = OLD.id;
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS ${triggerName} ON ${sourceTable};
      CREATE TRIGGER ${triggerName}
        AFTER INSERT OR UPDATE OR DELETE ON ${sourceTable}
        FOR EACH ROW EXECUTE FUNCTION ${triggerName}_func();
    `;

    if (sourceAdapter instanceof (await import('./DatabaseAdapter')).PostgreSQLAdapter) {
      await sourceAdapter.executeQuery(createTriggerSQL);
    }
  }

  private async setupReplication(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter,
    sourceTable: string,
    shadowTable: string
  ): Promise<void> {
    const replicationStream = {
      sourceTable,
      shadowTable,
      lastSyncTime: new Date(),
      isActive: true
    };
    
    this.replicationStreams.set(sourceTable, replicationStream);
    
    this.startReplicationPolling(sourceAdapter, targetAdapter, replicationStream);
  }

  private startReplicationPolling(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter,
    stream: any
  ): void {
    const pollInterval = setInterval(async () => {
      if (!stream.isActive) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const changes = await this.getChangesSince(
          sourceAdapter,
          stream.sourceTable,
          stream.lastSyncTime
        );

        if (changes.length > 0) {
          await targetAdapter.insertData(stream.shadowTable, changes);
          stream.lastSyncTime = new Date();
        }
      } catch (error) {
        this.emit('replicationError', { stream, error });
      }
    }, 1000);
  }

  private async getChangesSince(
    adapter: DatabaseAdapter,
    tableName: string,
    since: Date
  ): Promise<any[]> {
    const query = `
      SELECT * FROM ${tableName} 
      WHERE updated_at > $1 OR created_at > $1
      ORDER BY updated_at, created_at
    `;
    
    try {
      return await adapter.executeQuery(query, [since]);
    } catch (error) {
      const fallbackQuery = `SELECT * FROM ${tableName} LIMIT 1000`;
      return await adapter.executeQuery(fallbackQuery);
    }
  }

  async cutover(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter
  ): Promise<void> {
    this.emit('cutoverStarted');
    
    try {
      await this.validateShadowData(sourceAdapter, targetAdapter);
      
      await this.enableMaintenanceMode(sourceAdapter);
      
      await this.finalSync(sourceAdapter, targetAdapter);
      
      await this.renameTables(targetAdapter);
      
      await this.updateApplicationConnections(targetAdapter);
      
      await this.disableMaintenanceMode(sourceAdapter);
      
      this.emit('cutoverCompleted');
    } catch (error) {
      await this.rollbackCutover(sourceAdapter, targetAdapter);
      this.emit('cutoverFailed', error);
      throw error;
    }
  }

  private async validateShadowData(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter
  ): Promise<void> {
    for (const [sourceTable, shadowTable] of this.shadowTables) {
      const sourceCount = await sourceAdapter.getCount(sourceTable);
      const shadowCount = await targetAdapter.getCount(shadowTable);
      
      if (sourceCount !== shadowCount) {
        throw new Error(
          `Data validation failed for ${sourceTable}: source=${sourceCount}, shadow=${shadowCount}`
        );
      }
    }
  }

  private async enableMaintenanceMode(adapter: DatabaseAdapter): Promise<void> {
    try {
      await adapter.executeQuery(`
        CREATE TABLE IF NOT EXISTS maintenance_mode (
          enabled BOOLEAN DEFAULT true,
          message TEXT DEFAULT 'System under maintenance'
        );
        INSERT INTO maintenance_mode (enabled, message) VALUES (true, 'Migration in progress');
      `);
    } catch (error) {
      console.warn('Could not enable maintenance mode:', error);
    }
  }

  private async disableMaintenanceMode(adapter: DatabaseAdapter): Promise<void> {
    try {
      await adapter.executeQuery(`
        UPDATE maintenance_mode SET enabled = false WHERE enabled = true;
      `);
    } catch (error) {
      console.warn('Could not disable maintenance mode:', error);
    }
  }

  private async finalSync(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter
  ): Promise<void> {
    for (const [sourceTable, shadowTable] of this.shadowTables) {
      const replicationStream = this.replicationStreams.get(sourceTable);
      if (replicationStream) {
        replicationStream.isActive = false;
      }
      
      const finalChanges = await this.getChangesSince(
        sourceAdapter,
        sourceTable,
        replicationStream?.lastSyncTime || new Date(0)
      );
      
      if (finalChanges.length > 0) {
        await targetAdapter.insertData(shadowTable, finalChanges);
      }
    }
  }

  private async renameTables(targetAdapter: DatabaseAdapter): Promise<void> {
    await targetAdapter.beginTransaction();
    
    try {
      for (const [originalTable, shadowTable] of this.shadowTables) {
        const backupTable = `${originalTable}_backup_${Date.now()}`;
        
        await targetAdapter.executeQuery(`ALTER TABLE ${originalTable} RENAME TO ${backupTable}`);
        await targetAdapter.executeQuery(`ALTER TABLE ${shadowTable} RENAME TO ${originalTable}`);
      }
      
      await targetAdapter.commit();
    } catch (error) {
      await targetAdapter.rollback();
      throw error;
    }
  }

  private async updateApplicationConnections(targetAdapter: DatabaseAdapter): Promise<void> {
    this.emit('connectionsUpdated', { targetAdapter });
  }

  private async rollbackCutover(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter
  ): Promise<void> {
    try {
      await targetAdapter.beginTransaction();
      
      for (const [originalTable, shadowTable] of this.shadowTables) {
        const backupTable = `${originalTable}_backup_${Date.now()}`;
        
        await targetAdapter.executeQuery(`ALTER TABLE ${originalTable} RENAME TO ${shadowTable}`);
        await targetAdapter.executeQuery(`ALTER TABLE ${backupTable} RENAME TO ${originalTable}`);
      }
      
      await targetAdapter.commit();
      await this.disableMaintenanceMode(sourceAdapter);
    } catch (error) {
      await targetAdapter.rollback();
      console.error('Rollback failed:', error);
    }
  }

  private async getFullSchema(adapter: DatabaseAdapter): Promise<SchemaDefinition> {
    const tablesQuery = adapter instanceof (await import('./DatabaseAdapter')).PostgreSQLAdapter
      ? "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
      : "SHOW TABLES";
    
    const tableNames = await adapter.executeQuery(tablesQuery);
    const tables = [];
    
    for (const row of tableNames) {
      const tableName = row.tablename || row.TABLE_NAME || Object.values(row)[0];
      const tableSchema = await adapter.getTableSchema(tableName);
      tables.push(tableSchema);
    }
    
    return {
      version: '1.0',
      tables
    };
  }

  private buildUpdateColumns(adapter: DatabaseAdapter, tableName: string): string {
    return 'column1 = NEW.column1, column2 = NEW.column2';
  }

  async cleanup(): Promise<void> {
    for (const stream of this.replicationStreams.values()) {
      stream.isActive = false;
    }
    
    this.shadowTables.clear();
    this.replicationStreams.clear();
    this.cutoverLocks.clear();
  }
}
