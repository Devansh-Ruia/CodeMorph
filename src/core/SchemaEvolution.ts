import { DatabaseAdapter } from './DatabaseAdapter';
import { SchemaDefinition, TableDefinition, ColumnDefinition, IndexDefinition } from '../types';

export class SchemaEvolution {
  async migrateSchema(
    sourceAdapter: DatabaseAdapter,
    targetAdapter: DatabaseAdapter,
    targetSchema: SchemaDefinition
  ): Promise<void> {
    console.log('Starting schema migration...');
    
    const existingTables = await this.getExistingTables(targetAdapter);
    
    for (const targetTable of targetSchema.tables) {
      if (existingTables.includes(targetTable.name)) {
        await this.evolveExistingTable(targetAdapter, targetTable);
      } else {
        await targetAdapter.createTable(targetTable);
      }
    }
    
    if (targetSchema.indexes) {
      for (const index of targetSchema.indexes) {
        await this.createOrUpdateIndex(targetAdapter, index);
      }
    }
    
    console.log('Schema migration completed');
  }

  async rollbackSchema(
    targetAdapter: DatabaseAdapter,
    sourceAdapter: DatabaseAdapter,
    originalSchema: SchemaDefinition
  ): Promise<void> {
    console.log('Starting schema rollback...');
    
    const currentTables = await this.getExistingTables(targetAdapter);
    const originalTableNames = originalSchema.tables.map(t => t.name);
    
    for (const tableName of currentTables) {
      if (!originalTableNames.includes(tableName)) {
        await targetAdapter.dropTable(tableName);
      }
    }
    
    for (const originalTable of originalSchema.tables) {
      if (currentTables.includes(originalTable.name)) {
        await targetAdapter.dropTable(originalTable.name);
        await targetAdapter.createTable(originalTable);
      }
    }
    
    console.log('Schema rollback completed');
  }

  private async evolveExistingTable(
    adapter: DatabaseAdapter,
    targetTable: TableDefinition
  ): Promise<void> {
    const currentSchema = await adapter.getTableSchema(targetTable.name);
    const changes = this.calculateTableChanges(currentSchema, targetTable);
    
    if (changes.addColumns.length > 0) {
      await this.addColumns(adapter, targetTable.name, changes.addColumns);
    }
    
    if (changes.modifyColumns.length > 0) {
      await this.modifyColumns(adapter, targetTable.name, changes.modifyColumns);
    }
    
    if (changes.dropColumns.length > 0) {
      await this.dropColumns(adapter, targetTable.name, changes.dropColumns);
    }
    
    if (changes.constraints) {
      await this.updateConstraints(adapter, targetTable.name, changes.constraints);
    }
  }

  private calculateTableChanges(
    current: TableDefinition,
    target: TableDefinition
  ): {
    addColumns: ColumnDefinition[];
    modifyColumns: ColumnDefinition[];
    dropColumns: ColumnDefinition[];
    constraints?: any;
  } {
    const currentColumns = new Map(current.columns.map(col => [col.name, col]));
    const targetColumns = new Map(target.columns.map(col => [col.name, col]));
    
    const addColumns: ColumnDefinition[] = [];
    const modifyColumns: ColumnDefinition[] = [];
    const dropColumns: ColumnDefinition[] = [];
    
    for (const [name, targetCol] of targetColumns) {
      if (!currentColumns.has(name)) {
        addColumns.push(targetCol);
      } else {
        const currentCol = currentColumns.get(name)!;
        if (this.columnsDiffer(currentCol, targetCol)) {
          modifyColumns.push(targetCol);
        }
      }
    }
    
    for (const [name, currentCol] of currentColumns) {
      if (!targetColumns.has(name)) {
        dropColumns.push(currentCol);
      }
    }
    
    return { addColumns, modifyColumns, dropColumns };
  }

  private columnsDiffer(current: ColumnDefinition, target: ColumnDefinition): boolean {
    return (
      current.type !== target.type ||
      current.nullable !== target.nullable ||
      current.defaultValue !== target.defaultValue
    );
  }

  private async addColumns(
    adapter: DatabaseAdapter,
    tableName: string,
    columns: ColumnDefinition[]
  ): Promise<void> {
    for (const column of columns) {
      const columnDef = `${column.name} ${this.mapColumnType(adapter, column.type)}`;
      const nullableDef = column.nullable ? '' : ' NOT NULL';
      const defaultDef = column.defaultValue !== undefined ? ` DEFAULT ${column.defaultValue}` : '';
      
      const query = `ALTER TABLE ${tableName} ADD COLUMN ${columnDef}${nullableDef}${defaultDef}`;
      await adapter.executeQuery(query);
    }
  }

  private async modifyColumns(
    adapter: DatabaseAdapter,
    tableName: string,
    columns: ColumnDefinition[]
  ): Promise<void> {
    for (const column of columns) {
      const columnDef = `${column.name} ${this.mapColumnType(adapter, column.type)}`;
      const nullableDef = column.nullable ? '' : ' NOT NULL';
      const defaultDef = column.defaultValue !== undefined ? ` DEFAULT ${column.defaultValue}` : '';
      
      const query = `ALTER TABLE ${tableName} ALTER COLUMN ${column.name} TYPE ${this.mapColumnType(adapter, column.type)}`;
      await adapter.executeQuery(query);
      
      if (!column.nullable) {
        await adapter.executeQuery(`ALTER TABLE ${tableName} ALTER COLUMN ${column.name} SET NOT NULL`);
      }
      
      if (column.defaultValue !== undefined) {
        await adapter.executeQuery(`ALTER TABLE ${tableName} ALTER COLUMN ${column.name} SET DEFAULT ${column.defaultValue}`);
      }
    }
  }

  private async dropColumns(
    adapter: DatabaseAdapter,
    tableName: string,
    columns: ColumnDefinition[]
  ): Promise<void> {
    for (const column of columns) {
      await adapter.executeQuery(`ALTER TABLE ${tableName} DROP COLUMN ${column.name}`);
    }
  }

  private async updateConstraints(
    adapter: DatabaseAdapter,
    tableName: string,
    constraints: any
  ): Promise<void> {
    if (constraints.primaryKey) {
      await adapter.executeQuery(`ALTER TABLE ${tableName} ADD PRIMARY KEY (${constraints.primaryKey})`);
    }
    
    if (constraints.foreignKeys) {
      for (const fk of constraints.foreignKeys) {
        const fkDef = `FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencedTable}(${fk.referencedColumn})`;
        if (fk.onDelete) {
          await adapter.executeQuery(`ALTER TABLE ${tableName} ADD CONSTRAINT ${fk.name} ${fkDef} ON DELETE ${fk.onDelete}`);
        } else {
          await adapter.executeQuery(`ALTER TABLE ${tableName} ADD CONSTRAINT ${fk.name} ${fkDef}`);
        }
      }
    }
  }

  private async createOrUpdateIndex(
    adapter: DatabaseAdapter,
    index: IndexDefinition
  ): Promise<void> {
    try {
      await adapter.createIndex(index.name, index.table, index.columns, index.unique);
    } catch (error) {
      console.warn(`Failed to create index ${index.name}:`, error);
    }
  }

  private async getExistingTables(adapter: DatabaseAdapter): Promise<string[]> {
    try {
      let query: string;
      
      if (adapter.constructor.name === 'PostgreSQLAdapter') {
        query = "SELECT tablename FROM pg_tables WHERE schemaname = 'public'";
      } else if (adapter.constructor.name === 'MySQLAdapter') {
        query = 'SHOW TABLES';
      } else {
        query = 'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()';
      }
      
      const result = await adapter.executeQuery(query);
      return result.map((row: any) => {
        const tableName = row.tablename || row.TABLE_NAME || row.table_name || Object.values(row)[0];
        return tableName as string;
      });
    } catch (error) {
      console.error('Failed to get existing tables:', error);
      return [];
    }
  }

  private mapColumnType(adapter: DatabaseAdapter, type: string): string {
    if (adapter.constructor.name === 'PostgreSQLAdapter') {
      const typeMap: { [key: string]: string } = {
        'string': 'VARCHAR(255)',
        'text': 'TEXT',
        'integer': 'INTEGER',
        'bigint': 'BIGINT',
        'decimal': 'DECIMAL',
        'boolean': 'BOOLEAN',
        'date': 'DATE',
        'datetime': 'TIMESTAMP',
        'json': 'JSONB',
        'uuid': 'UUID'
      };
      return typeMap[type.toLowerCase()] || type.toUpperCase();
    } else if (adapter.constructor.name === 'MySQLAdapter') {
      const typeMap: { [key: string]: string } = {
        'string': 'VARCHAR(255)',
        'text': 'TEXT',
        'integer': 'INT',
        'bigint': 'BIGINT',
        'decimal': 'DECIMAL',
        'boolean': 'BOOLEAN',
        'date': 'DATE',
        'datetime': 'DATETIME',
        'json': 'JSON'
      };
      return typeMap[type.toLowerCase()] || type.toUpperCase();
    }
    return type.toUpperCase();
  }

  async validateSchemaCompatibility(
    sourceSchema: SchemaDefinition,
    targetSchema: SchemaDefinition
  ): Promise<{
    compatible: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    const sourceTables = new Map(sourceSchema.tables.map(t => [t.name, t]));
    const targetTables = new Map(targetSchema.tables.map(t => [t.name, t]));
    
    for (const [targetTableName, targetTable] of targetTables) {
      if (!sourceTables.has(targetTableName)) {
        warnings.push(`Target table ${targetTableName} does not exist in source`);
        continue;
      }
      
      const sourceTable = sourceTables.get(targetTableName)!;
      const compatibility = this.checkTableCompatibility(sourceTable, targetTable);
      
      warnings.push(...compatibility.warnings);
      errors.push(...compatibility.errors);
    }
    
    return {
      compatible: errors.length === 0,
      warnings,
      errors
    };
  }

  private checkTableCompatibility(
    source: TableDefinition,
    target: TableDefinition
  ): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    const sourceColumns = new Map(source.columns.map(c => [c.name, c]));
    const targetColumns = new Map(target.columns.map(c => [c.name, c]));
    
    for (const [targetColName, targetCol] of targetColumns) {
      if (!sourceColumns.has(targetColName)) {
        warnings.push(`Target column ${targetColName} does not exist in source table ${source.name}`);
        continue;
      }
      
      const sourceCol = sourceColumns.get(targetColName)!;
      
      if (!this.areTypesCompatible(sourceCol.type, targetCol.type)) {
        errors.push(`Type incompatibility for ${source.name}.${targetColName}: ${sourceCol.type} -> ${targetCol.type}`);
      }
      
      if (sourceCol.nullable && !targetCol.nullable) {
        warnings.push(`Column ${source.name}.${targetColName} is nullable in source but NOT NULL in target`);
      }
    }
    
    return { warnings, errors };
  }

  private areTypesCompatible(sourceType: string, targetType: string): boolean {
    const compatibilityMap: { [key: string]: string[] } = {
      'string': ['string', 'text', 'varchar', 'char'],
      'text': ['text', 'string', 'varchar', 'char'],
      'integer': ['integer', 'int', 'bigint', 'smallint', 'tinyint'],
      'bigint': ['bigint', 'integer', 'int'],
      'decimal': ['decimal', 'numeric', 'float', 'double'],
      'boolean': ['boolean', 'bool', 'bit'],
      'date': ['date', 'datetime', 'timestamp'],
      'datetime': ['datetime', 'timestamp', 'date'],
      'json': ['json', 'jsonb', 'text']
    };
    
    const sourceCompatible = compatibilityMap[sourceType.toLowerCase()] || [sourceType];
    return sourceCompatible.includes(targetType.toLowerCase());
  }
}
