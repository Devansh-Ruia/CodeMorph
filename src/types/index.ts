export interface DatabaseConfig {
  type: 'postgresql' | 'mysql' | 'mongodb';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface MigrationStrategy {
  id: string;
  name: string;
  description: string;
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
  downtime: boolean;
  rollbackSupported: boolean;
}

export interface SchemaDefinition {
  version: string;
  tables: TableDefinition[];
  indexes?: IndexDefinition[];
  constraints?: ConstraintDefinition[];
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  primaryKey?: string;
  foreignKeys?: ForeignKeyDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  constraints?: string[];
}

export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
}

export interface ForeignKeyDefinition {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
}

export interface ConstraintDefinition {
  name: string;
  type: 'CHECK' | 'UNIQUE' | 'EXCLUDE';
  definition: string;
}

export interface MigrationJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  sourceDatabase: DatabaseConfig;
  targetDatabase: DatabaseConfig;
  strategy: MigrationStrategy;
  schema: SchemaDefinition;
  progress: number;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  logs: MigrationLog[];
}

export interface MigrationLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: any;
}

export interface AIRecommendation {
  type: 'strategy' | 'optimization' | 'warning';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  action?: string;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  databaseConnections: number;
  migrationSpeed: number;
  errorRate: number;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    redis: boolean;
    ai: boolean;
    storage: boolean;
  };
  lastCheck: Date;
}
