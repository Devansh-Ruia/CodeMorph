import { DatabaseConfig, TableDefinition, ColumnDefinition } from '../types';

export abstract class DatabaseAdapter {
  protected config: DatabaseConfig;
  protected connection: any;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract executeQuery(query: string, params?: any[]): Promise<any>;
  abstract getTableSchema(tableName: string): Promise<TableDefinition>;
  abstract createTable(table: TableDefinition): Promise<void>;
  abstract alterTable(tableName: string, changes: Partial<TableDefinition>): Promise<void>;
  abstract dropTable(tableName: string): Promise<void>;
  abstract insertData(tableName: string, data: any[]): Promise<void>;
  abstract selectData(tableName: string, limit?: number, offset?: number): Promise<any[]>;
  abstract getCount(tableName: string): Promise<number>;
  abstract createIndex(indexName: string, tableName: string, columns: string[], unique?: boolean): Promise<void>;
  abstract dropIndex(indexName: string): Promise<void>;
  abstract beginTransaction(): Promise<void>;
  abstract commit(): Promise<void>;
  abstract rollback(): Promise<void>;

  static create(config: DatabaseConfig): DatabaseAdapter {
    switch (config.type) {
      case 'postgresql':
        return new PostgreSQLAdapter(config);
      case 'mysql':
        return new MySQLAdapter(config);
      case 'mongodb':
        return new MongoDBAdapter(config);
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }
}

export class PostgreSQLAdapter extends DatabaseAdapter {
  private pg: any;

  async connect(): Promise<void> {
    try {
      const { Client } = require('pg');
      this.pg = new Client({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl
      });
      await this.pg.connect();
      this.connection = this.pg;
    } catch (error) {
      throw new Error(`Failed to connect to PostgreSQL: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pg) {
      await this.pg.end();
    }
  }

  async executeQuery(query: string, params: any[] = []): Promise<any> {
    try {
      const result = await this.pg.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`PostgreSQL query failed: ${error}`);
    }
  }

  async getTableSchema(tableName: string): Promise<TableDefinition> {
    const query = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position
    `;
    
    const rows = await this.executeQuery(query, [tableName]);
    
    const columns: ColumnDefinition[] = rows.map(row => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default
    }));

    const primaryKeyQuery = `
      SELECT column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
    `;
    
    const pkResult = await this.executeQuery(primaryKeyQuery, [tableName]);
    const primaryKey = pkResult.length > 0 ? pkResult[0].column_name : undefined;

    return {
      name: tableName,
      columns,
      primaryKey
    };
  }

  async createTable(table: TableDefinition): Promise<void> {
    const columns = table.columns.map(col => {
      let columnDef = `${col.name} ${this.mapPostgreSQLType(col.type)}`;
      if (!col.nullable) columnDef += ' NOT NULL';
      if (col.defaultValue !== undefined) columnDef += ` DEFAULT ${col.defaultValue}`;
      return columnDef;
    }).join(', ');

    const constraint = table.primaryKey ? `, PRIMARY KEY (${table.primaryKey})` : '';
    
    const query = `CREATE TABLE ${table.name} (${columns}${constraint})`;
    await this.executeQuery(query);
  }

  async alterTable(tableName: string, changes: Partial<TableDefinition>): Promise<void> {
    if (changes.columns) {
      for (const column of changes.columns) {
        const columnDef = `${column.name} ${this.mapPostgreSQLType(column.type)}`;
        const nullableDef = column.nullable ? '' : ' NOT NULL';
        const defaultDef = column.defaultValue !== undefined ? ` DEFAULT ${column.defaultValue}` : '';
        
        const query = `ALTER TABLE ${tableName} ADD COLUMN ${columnDef}${nullableDef}${defaultDef}`;
        await this.executeQuery(query);
      }
    }
  }

  async dropTable(tableName: string): Promise<void> {
    await this.executeQuery(`DROP TABLE IF EXISTS ${tableName}`);
  }

  async insertData(tableName: string, data: any[]): Promise<void> {
    if (data.length === 0) return;

    const columns = Object.keys(data[0]);
    const values = data.map(row => columns.map(col => row[col]));
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    for (const row of values) {
      await this.executeQuery(query, row);
    }
  }

  async selectData(tableName: string, limit = 1000, offset = 0): Promise<any[]> {
    const query = `SELECT * FROM ${tableName} LIMIT $1 OFFSET $2`;
    return await this.executeQuery(query, [limit, offset]);
  }

  async getCount(tableName: string): Promise<number> {
    const result = await this.executeQuery(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result[0].count);
  }

  async createIndex(indexName: string, tableName: string, columns: string[], unique = false): Promise<void> {
    const uniqueKeyword = unique ? 'UNIQUE ' : '';
    const query = `CREATE ${uniqueKeyword}INDEX ${indexName} ON ${tableName} (${columns.join(', ')})`;
    await this.executeQuery(query);
  }

  async dropIndex(indexName: string): Promise<void> {
    await this.executeQuery(`DROP INDEX IF EXISTS ${indexName}`);
  }

  async beginTransaction(): Promise<void> {
    await this.executeQuery('BEGIN');
  }

  async commit(): Promise<void> {
    await this.executeQuery('COMMIT');
  }

  async rollback(): Promise<void> {
    await this.executeQuery('ROLLBACK');
  }

  private mapPostgreSQLType(type: string): string {
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
  }
}

export class MySQLAdapter extends DatabaseAdapter {
  private mysql: any;

  async connect(): Promise<void> {
    try {
      const mysql = require('mysql2/promise');
      this.connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl
      });
    } catch (error) {
      throw new Error(`Failed to connect to MySQL: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
    }
  }

  async executeQuery(query: string, params: any[] = []): Promise<any> {
    try {
      const [rows] = await this.connection.execute(query, params);
      return rows;
    } catch (error) {
      throw new Error(`MySQL query failed: ${error}`);
    }
  }

  async getTableSchema(tableName: string): Promise<TableDefinition> {
    const query = `
      SELECT 
        COLUMN_NAME as column_name,
        DATA_TYPE as data_type,
        IS_NULLABLE as is_nullable,
        COLUMN_DEFAULT as column_default
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ORDINAL_POSITION
    `;
    
    const rows = await this.executeQuery(query, [tableName]);
    
    const columns: ColumnDefinition[] = rows.map((row: any) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default
    }));

    const primaryKeyQuery = `
      SELECT COLUMN_NAME as column_name
      FROM information_schema.key_column_usage
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
    `;
    
    const pkResult = await this.executeQuery(primaryKeyQuery, [tableName]);
    const primaryKey = pkResult.length > 0 ? pkResult[0].column_name : undefined;

    return {
      name: tableName,
      columns,
      primaryKey
    };
  }

  async createTable(table: TableDefinition): Promise<void> {
    const columns = table.columns.map(col => {
      let columnDef = `${col.name} ${this.mapMySQLType(col.type)}`;
      if (!col.nullable) columnDef += ' NOT NULL';
      if (col.defaultValue !== undefined) columnDef += ` DEFAULT ${col.defaultValue}`;
      return columnDef;
    }).join(', ');

    const constraint = table.primaryKey ? `, PRIMARY KEY (${table.primaryKey})` : '';
    
    const query = `CREATE TABLE ${table.name} (${columns}${constraint})`;
    await this.executeQuery(query);
  }

  async alterTable(tableName: string, changes: Partial<TableDefinition>): Promise<void> {
    if (changes.columns) {
      for (const column of changes.columns) {
        const columnDef = `${column.name} ${this.mapMySQLType(column.type)}`;
        const nullableDef = column.nullable ? '' : ' NOT NULL';
        const defaultDef = column.defaultValue !== undefined ? ` DEFAULT ${column.defaultValue}` : '';
        
        const query = `ALTER TABLE ${tableName} ADD COLUMN ${columnDef}${nullableDef}${defaultDef}`;
        await this.executeQuery(query);
      }
    }
  }

  async dropTable(tableName: string): Promise<void> {
    await this.executeQuery(`DROP TABLE IF EXISTS ${tableName}`);
  }

  async insertData(tableName: string, data: any[]): Promise<void> {
    if (data.length === 0) return;

    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    
    const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    for (const row of data) {
      const values = columns.map(col => row[col]);
      await this.executeQuery(query, values);
    }
  }

  async selectData(tableName: string, limit = 1000, offset = 0): Promise<any[]> {
    const query = `SELECT * FROM ${tableName} LIMIT ? OFFSET ?`;
    return await this.executeQuery(query, [limit, offset]);
  }

  async getCount(tableName: string): Promise<number> {
    const result = await this.executeQuery(`SELECT COUNT(*) as count FROM ${tableName}`);
    return result[0].count;
  }

  async createIndex(indexName: string, tableName: string, columns: string[], unique = false): Promise<void> {
    const uniqueKeyword = unique ? 'UNIQUE ' : '';
    const query = `CREATE ${uniqueKeyword}INDEX ${indexName} ON ${tableName} (${columns.join(', ')})`;
    await this.executeQuery(query);
  }

  async dropIndex(indexName: string): Promise<void> {
    await this.executeQuery(`DROP INDEX ${indexName}`);
  }

  async beginTransaction(): Promise<void> {
    await this.executeQuery('START TRANSACTION');
  }

  async commit(): Promise<void> {
    await this.executeQuery('COMMIT');
  }

  async rollback(): Promise<void> {
    await this.executeQuery('ROLLBACK');
  }

  private mapMySQLType(type: string): string {
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
}

export class MongoDBAdapter extends DatabaseAdapter {
  private client: any;
  private db: any;

  async connect(): Promise<void> {
    try {
      const { MongoClient } = require('mongodb');
      const uri = `mongodb://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}`;
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db(this.config.database);
      this.connection = this.client;
    } catch (error) {
      throw new Error(`Failed to connect to MongoDB: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }

  async executeQuery(query: string, params?: any[]): Promise<any> {
    throw new Error('MongoDB does not support SQL queries');
  }

  async getTableSchema(tableName: string): Promise<TableDefinition> {
    const collection = this.db.collection(tableName);
    const sample = await collection.findOne();
    
    if (!sample) {
      return { name: tableName, columns: [] };
    }

    const columns: ColumnDefinition[] = Object.keys(sample).map(key => ({
      name: key,
      type: typeof sample[key],
      nullable: sample[key] === null || sample[key] === undefined,
      defaultValue: undefined
    }));

    return {
      name: tableName,
      columns
    };
  }

  async createTable(table: TableDefinition): Promise<void> {
    const collection = this.db.collection(table.name);
    await collection.createIndex({ _id: 1 });
  }

  async alterTable(tableName: string, changes: Partial<TableDefinition>): Promise<void> {
    // MongoDB is schemaless, so no alter table needed
  }

  async dropTable(tableName: string): Promise<void> {
    await this.db.collection(tableName).drop();
  }

  async insertData(tableName: string, data: any[]): Promise<void> {
    const collection = this.db.collection(tableName);
    await collection.insertMany(data);
  }

  async selectData(tableName: string, limit = 1000, offset = 0): Promise<any[]> {
    const collection = this.db.collection(tableName);
    return await collection.find().limit(limit).skip(offset).toArray();
  }

  async getCount(tableName: string): Promise<number> {
    const collection = this.db.collection(tableName);
    return await collection.countDocuments();
  }

  async createIndex(indexName: string, tableName: string, columns: string[], unique = false): Promise<void> {
    const collection = this.db.collection(tableName);
    const indexSpec: any = {};
    columns.forEach(col => {
      indexSpec[col] = 1;
    });
    await collection.createIndex(indexSpec, { name: indexName, unique });
  }

  async dropIndex(indexName: string): Promise<void> {
    // MongoDB index dropping would need collection context
  }

  async beginTransaction(): Promise<void> {
    const session = this.client.startSession();
    session.startTransaction();
  }

  async commit(): Promise<void> {
    // Would need session context
  }

  async rollback(): Promise<void> {
    // Would need session context
  }
}
