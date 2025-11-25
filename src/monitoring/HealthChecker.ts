import { EventEmitter } from 'events';
import { HealthCheck, SystemMetrics } from '../types';
import { DatabaseAdapter } from '../core/DatabaseAdapter';

export class HealthChecker extends EventEmitter {
  private checkInterval: NodeJS.Timeout | null = null;
  private healthStatus: HealthCheck = {
    status: 'healthy',
    checks: {
      database: false,
      redis: false,
      ai: false,
      storage: false
    },
    lastCheck: new Date()
  };

  constructor(
    private databaseAdapter: DatabaseAdapter,
    private redisClient?: any,
    private aiService?: any
  ) {
    super();
  }

  async startHealthChecks(intervalMs = 30000): Promise<void> {
    console.log('Starting health checks...');
    
    await this.performHealthCheck();
    
    this.checkInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);
  }

  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async performHealthCheck(): Promise<void> {
    const previousStatus = this.healthStatus.status;
    
    try {
      const checks = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkAI(),
        this.checkStorage()
      ]);

      this.healthStatus.checks.database = checks[0].status === 'fulfilled';
      this.healthStatus.checks.redis = checks[1].status === 'fulfilled';
      this.healthStatus.checks.ai = checks[2].status === 'fulfilled';
      this.healthStatus.checks.storage = checks[3].status === 'fulfilled';
      
      this.healthStatus.lastCheck = new Date();
      
      const failedChecks = Object.values(this.healthStatus.checks).filter(check => !check).length;
      
      if (failedChecks === 0) {
        this.healthStatus.status = 'healthy';
      } else if (failedChecks <= 2) {
        this.healthStatus.status = 'degraded';
      } else {
        this.healthStatus.status = 'unhealthy';
      }
      
      if (previousStatus !== this.healthStatus.status) {
        this.emit('healthStatusChanged', this.healthStatus);
      }
      
      this.emit('healthCheckCompleted', this.healthStatus);
      
    } catch (error) {
      console.error('Health check failed:', error);
      this.healthStatus.status = 'unhealthy';
      this.emit('healthCheckError', error);
    }
  }

  private async checkDatabase(): Promise<boolean> {
    if (!this.databaseAdapter) {
      console.log('No database adapter configured for health check');
      return true;
    }
    
    try {
      await this.databaseAdapter.executeQuery('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    if (!this.redisClient) {
      return true;
    }
    
    try {
      await this.redisClient.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  private async checkAI(): Promise<boolean> {
    if (!this.aiService) {
      return true;
    }
    
    try {
      await this.aiService.testConnection();
      return true;
    } catch (error) {
      console.error('AI service health check failed:', error);
      return false;
    }
  }

  private async checkStorage(): Promise<boolean> {
    try {
      const testFile = 'health-check-' + Date.now();
      await this.writeTestFile(testFile);
      await this.deleteTestFile(testFile);
      return true;
    } catch (error) {
      console.error('Storage health check failed:', error);
      return false;
    }
  }

  private async writeTestFile(filename: string): Promise<void> {
    const fs = require('fs').promises;
    await fs.writeFile(filename, 'health-check');
  }

  private async deleteTestFile(filename: string): Promise<void> {
    const fs = require('fs').promises;
    await fs.unlink(filename);
  }

  getHealthStatus(): HealthCheck {
    return { ...this.healthStatus };
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const metrics = await Promise.allSettled([
      this.getCPUUsage(),
      this.getMemoryUsage(),
      this.getNetworkLatency(),
      this.getDatabaseConnections(),
      this.getMigrationSpeed(),
      this.getErrorRate()
    ]);

    return {
      cpuUsage: metrics[0].status === 'fulfilled' ? metrics[0].value : 0,
      memoryUsage: metrics[1].status === 'fulfilled' ? metrics[1].value : 0,
      networkLatency: metrics[2].status === 'fulfilled' ? metrics[2].value : 0,
      databaseConnections: metrics[3].status === 'fulfilled' ? metrics[3].value : 0,
      migrationSpeed: metrics[4].status === 'fulfilled' ? metrics[4].value : 0,
      errorRate: metrics[5].status === 'fulfilled' ? metrics[5].value : 0
    };
  }

  private async getCPUUsage(): Promise<number> {
    const os = require('os');
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    return Math.round(((totalTick - totalIdle) / totalTick) * 100);
  }

  private async getMemoryUsage(): Promise<number> {
    const os = require('os');
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    return Math.round(((totalMem - freeMem) / totalMem) * 100);
  }

  private async getNetworkLatency(): Promise<number> {
    const start = Date.now();
    try {
      await this.databaseAdapter.executeQuery('SELECT 1');
      return Date.now() - start;
    } catch (error) {
      return 999;
    }
  }

  private async getDatabaseConnections(): Promise<number> {
    try {
      let query: string;
      
      if (this.databaseAdapter.constructor.name === 'PostgreSQLAdapter') {
        query = 'SELECT count(*) as count FROM pg_stat_activity';
      } else if (this.databaseAdapter.constructor.name === 'MySQLAdapter') {
        query = 'SHOW STATUS LIKE "Threads_connected"';
      } else {
        return 0;
      }
      
      const result = await this.databaseAdapter.executeQuery(query);
      return result[0]?.count || result[0]?.Value || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getMigrationSpeed(): Promise<number> {
    return 0;
  }

  private async getErrorRate(): Promise<number> {
    return 0;
  }

  async performDeepHealthCheck(): Promise<{
    health: HealthCheck;
    metrics: SystemMetrics;
    recommendations: string[];
  }> {
    const health = await this.performComprehensiveHealthCheck();
    const metrics = await this.getSystemMetrics();
    const recommendations = this.generateRecommendations(health, metrics);

    return {
      health,
      metrics,
      recommendations
    };
  }

  private async performComprehensiveHealthCheck(): Promise<HealthCheck> {
    await this.performHealthCheck();
    return { ...this.healthStatus };
  }

  private generateRecommendations(health: HealthCheck, metrics: SystemMetrics): string[] {
    const recommendations: string[] = [];

    if (!health.checks.database) {
      recommendations.push('Database connection is failing - check connection parameters');
    }

    if (!health.checks.redis) {
      recommendations.push('Redis connection is failing - verify Redis server status');
    }

    if (!health.checks.ai) {
      recommendations.push('AI service is unavailable - check API key and service status');
    }

    if (!health.checks.storage) {
      recommendations.push('Storage system is failing - check disk space and permissions');
    }

    if (metrics.cpuUsage > 80) {
      recommendations.push('High CPU usage detected - consider scaling up or optimizing queries');
    }

    if (metrics.memoryUsage > 85) {
      recommendations.push('High memory usage detected - consider adding more RAM or optimizing memory usage');
    }

    if (metrics.networkLatency > 1000) {
      recommendations.push('High network latency detected - check network connectivity');
    }

    if (metrics.databaseConnections > 50) {
      recommendations.push('High number of database connections - consider connection pooling');
    }

    if (metrics.errorRate > 5) {
      recommendations.push('High error rate detected - review logs and fix underlying issues');
    }

    return recommendations;
  }
}
