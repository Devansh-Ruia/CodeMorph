import { DatabaseAdapter } from './DatabaseAdapter';
import { SchemaDefinition, TableDefinition } from '../types';

export class DataMigrator {
  private batchSize = 1000;
  private maxConcurrency = 5;

  async migrateData(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter,
    schema: SchemaDefinition,
    progressCallback?: (progress: number) => void
  ): Promise<void> {
    console.log('Starting full data migration...');
    
    const totalTables = schema.tables.length;
    let completedTables = 0;
    
    for (const table of schema.tables) {
      await this.migrateTableData(sourceAdapter, targetAdapter, table);
      completedTables++;
      
      if (progressCallback) {
        progressCallback((completedTables / totalTables) * 100);
      }
    }
    
    console.log('Full data migration completed');
  }

  async migrateDataIncremental(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter,
    schema: SchemaDefinition,
    progressCallback?: (progress: number) => void
  ): Promise<void> {
    console.log('Starting incremental data migration...');
    
    const totalTables = schema.tables.length;
    let completedTables = 0;
    
    for (const table of schema.tables) {
      await this.migrateTableDataIncremental(sourceAdapter, targetAdapter, table);
      completedTables++;
      
      if (progressCallback) {
        progressCallback((completedTables / totalTables) * 100);
      }
    }
    
    console.log('Incremental data migration completed');
  }

  async rollbackData(
    targetAdapter: DatabaseAdapter,
    sourceAdapter: DatabaseAdapter,
    schema: SchemaDefinition
  ): Promise<void> {
    console.log('Starting data rollback...');
    
    for (const table of schema.tables) {
      await this.clearTableData(targetAdapter, table.name);
    }
    
    console.log('Data rollback completed');
  }

  private async migrateTableData(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter,
    table: TableDefinition
  ): Promise<void> {
    console.log(`Migrating data for table: ${table.name}`);
    
    let offset = 0;
    let hasMoreData = true;
    let totalMigrated = 0;
    
    while (hasMoreData) {
      const data = await sourceAdapter.selectData(table.name, this.batchSize, offset);
      
      if (data.length === 0) {
        hasMoreData = false;
        break;
      }
      
      const transformedData = await this.transformData(data, table);
      await targetAdapter.insertData(table.name, transformedData);
      
      totalMigrated += data.length;
      offset += this.batchSize;
      
      if (data.length < this.batchSize) {
        hasMoreData = false;
      }
    }
    
    console.log(`Migrated ${totalMigrated} records for table: ${table.name}`);
  }

  private async migrateTableDataIncremental(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter,
    table: TableDefinition
  ): Promise<void> {
    console.log(`Incrementally migrating data for table: ${table.name}`);
    
    const watermark = await this.getWatermark(targetAdapter, table.name);
    const newData = await this.getDataSinceWatermark(sourceAdapter, table.name, watermark);
    
    if (newData.length > 0) {
      const transformedData = await this.transformData(newData, table);
      await targetAdapter.insertData(table.name, transformedData);
      
      console.log(`Incrementally migrated ${newData.length} records for table: ${table.name}`);
    }
  }

  private async transformData(data: any[], table: TableDefinition): Promise<any[]> {
    return data.map(row => {
      const transformedRow: any = {};
      
      for (const column of table.columns) {
        let value = row[column.name];
        
        if (value !== null && value !== undefined) {
          value = this.transformValue(value, column.type, column);
        }
        
        transformedRow[column.name] = value;
      }
      
      return transformedRow;
    });
  }

  private transformValue(value: any, targetType: string, column: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    switch (targetType.toLowerCase()) {
      case 'string':
      case 'varchar':
      case 'text':
        return String(value);
      
      case 'integer':
      case 'int':
      case 'bigint':
        const num = Number(value);
        return isNaN(num) ? 0 : Math.floor(num);
      
      case 'decimal':
      case 'float':
      case 'double':
        const dec = Number(value);
        return isNaN(dec) ? 0 : dec;
      
      case 'boolean':
      case 'bool':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        if (typeof value === 'number') {
          return value !== 0;
        }
        return Boolean(value);
      
      case 'date':
      case 'datetime':
      case 'timestamp':
        if (value instanceof Date) return value;
        const dateValue = new Date(value);
        return isNaN(dateValue.getTime()) ? new Date() : dateValue;
      
      case 'json':
      case 'jsonb':
        if (typeof value === 'object') return value;
        try {
          return JSON.parse(String(value));
        } catch {
          return {};
        }
      
      case 'uuid':
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const strValue = String(value);
        return uuidRegex.test(strValue) ? strValue : null;
      
      default:
        return value;
    }
  }

  private async clearTableData(adapter: DatabaseAdapter, tableName: string): Promise<void> {
    try {
      await adapter.executeQuery(`DELETE FROM ${tableName}`);
    } catch (error) {
      console.warn(`Failed to clear table ${tableName}:`, error);
    }
  }

  private async getWatermark(adapter: DatabaseAdapter, tableName: string): Promise<Date> {
    try {
      const result = await adapter.executeQuery(`
        SELECT MAX(updated_at) as max_updated, MAX(created_at) as max_created 
        FROM ${tableName}
      `);
      
      const maxUpdated = result[0]?.max_updated;
      const maxCreated = result[0]?.max_created;
      
      if (maxUpdated && maxCreated) {
        return new Date(Math.max(new Date(maxUpdated).getTime(), new Date(maxCreated).getTime()));
      } else if (maxUpdated) {
        return new Date(maxUpdated);
      } else if (maxCreated) {
        return new Date(maxCreated);
      }
    } catch (error) {
      console.warn(`Could not get watermark for ${tableName}:`, error);
    }
    
    return new Date(0);
  }

  private async getDataSinceWatermark(
    adapter: DatabaseAdapter,
    tableName: string,
    watermark: Date
  ): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM ${tableName} 
        WHERE updated_at > ? OR created_at > ?
        ORDER BY updated_at, created_at
        LIMIT ${this.batchSize}
      `;
      
      return await adapter.executeQuery(query, [watermark, watermark]);
    } catch (error) {
      console.warn(`Could not get incremental data for ${tableName}:`, error);
      
      try {
        return await adapter.executeQuery(`SELECT * FROM ${tableName} LIMIT ${this.batchSize}`);
      } catch (fallbackError) {
        console.error(`Failed to get any data for ${tableName}:`, fallbackError);
        return [];
      }
    }
  }

  async validateDataIntegrity(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter,
    schema: SchemaDefinition
  ): Promise<{
    isValid: boolean;
    mismatches: { table: string; sourceCount: number; targetCount: number }[];
  }> {
    const mismatches: { table: string; sourceCount: number; targetCount: number }[] = [];
    
    for (const table of schema.tables) {
      const sourceCount = await sourceAdapter.getCount(table.name);
      const targetCount = await targetAdapter.getCount(table.name);
      
      if (sourceCount !== targetCount) {
        mismatches.push({
          table: table.name,
          sourceCount,
          targetCount
        });
      }
    }
    
    return {
      isValid: mismatches.length === 0,
      mismatches
    };
  }

  async optimizeMigration(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter,
    schema: SchemaDefinition
  ): Promise<void> {
    console.log('Optimizing migration performance...');
    
    await this.disableIndexes(targetAdapter, schema);
    await this.disableConstraints(targetAdapter, schema);
    
    console.log('Migration optimization completed');
  }

  async postMigrationOptimization(
    targetAdapter: DatabaseAdapter,
    schema: SchemaDefinition
  ): Promise<void> {
    console.log('Running post-migration optimization...');
    
    await this.enableConstraints(targetAdapter, schema);
    await this.rebuildIndexes(targetAdapter, schema);
    await this.updateStatistics(targetAdapter, schema);
    
    console.log('Post-migration optimization completed');
  }

  private async disableIndexes(adapter: DatabaseAdapter, schema: SchemaDefinition): Promise<void> {
    if (schema.indexes) {
      for (const index of schema.indexes) {
        try {
          await adapter.dropIndex(index.name);
        } catch (error) {
          console.warn(`Could not drop index ${index.name}:`, error);
        }
      }
    }
  }

  private async disableConstraints(adapter: DatabaseAdapter, schema: SchemaDefinition): Promise<void> {
    for (const table of schema.tables) {
      try {
        await adapter.executeQuery(`ALTER TABLE ${table.name} DISABLE TRIGGER ALL`);
      } catch (error) {
        console.warn(`Could not disable constraints for ${table.name}:`, error);
      }
    }
  }

  private async enableConstraints(adapter: DatabaseAdapter, schema: SchemaDefinition): Promise<void> {
    for (const table of schema.tables) {
      try {
        await adapter.executeQuery(`ALTER TABLE ${table.name} ENABLE TRIGGER ALL`);
      } catch (error) {
        console.warn(`Could not enable constraints for ${table.name}:`, error);
      }
    }
  }

  private async rebuildIndexes(adapter: DatabaseAdapter, schema: SchemaDefinition): Promise<void> {
    if (schema.indexes) {
      for (const index of schema.indexes) {
        try {
          await adapter.createIndex(index.name, index.table, index.columns, index.unique);
        } catch (error) {
          console.warn(`Could not recreate index ${index.name}:`, error);
        }
      }
    }
  }

  private async updateStatistics(adapter: DatabaseAdapter, schema: SchemaDefinition): Promise<void> {
    for (const table of schema.tables) {
      try {
        await adapter.executeQuery(`ANALYZE ${table.name}`);
      } catch (error) {
        console.warn(`Could not analyze table ${table.name}:`, error);
      }
    }
  }

  setBatchSize(size: number): void {
    this.batchSize = Math.max(1, Math.min(size, 10000));
  }

  setMaxConcurrency(concurrency: number): void {
    this.maxConcurrency = Math.max(1, Math.min(concurrency, 20));
  }
}
