import { OpenAI } from 'openai';
import { MigrationStrategy, SchemaDefinition, AIRecommendation, DatabaseConfig } from '../types';

export class AIOptimizer {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async optimizeMigrationStrategy(
    sourceConfig: DatabaseConfig,
    targetConfig: DatabaseConfig,
    schema: SchemaDefinition,
    constraints: {
      maxDowntime?: number;
      maxDuration?: number;
      priority: 'speed' | 'safety' | 'cost';
    }
  ): Promise<MigrationStrategy[]> {
    const prompt = this.buildOptimizationPrompt(sourceConfig, targetConfig, schema, constraints);
    
    try {
      const response = await this.openai.completions.create({
        model: 'gpt-4',
        prompt,
        max_tokens: 1500,
        temperature: 0.3,
      });

      const strategies = this.parseStrategies(response.choices[0].text || '');
      return strategies;
    } catch (error) {
      console.error('AI optimization failed:', error);
      return this.getDefaultStrategies();
    }
  }

  async analyzeSchema(schema: SchemaDefinition): Promise<AIRecommendation[]> {
    const prompt = this.buildSchemaAnalysisPrompt(schema);
    
    try {
      const response = await this.openai.completions.create({
        model: 'gpt-4',
        prompt,
        max_tokens: 1000,
        temperature: 0.2,
      });

      return this.parseRecommendations(response.choices[0].text || '');
    } catch (error) {
      console.error('Schema analysis failed:', error);
      return [];
    }
  }

  async predictMigrationComplexity(
    sourceConfig: DatabaseConfig,
    targetConfig: DatabaseConfig,
    schema: SchemaDefinition
  ): Promise<{
    complexity: 'low' | 'medium' | 'high';
    estimatedDuration: number;
    riskFactors: string[];
    recommendations: string[];
  }> {
    const prompt = this.buildComplexityPrompt(sourceConfig, targetConfig, schema);
    
    try {
      const response = await this.openai.completions.create({
        model: 'gpt-4',
        prompt,
        max_tokens: 800,
        temperature: 0.1,
      });

      return this.parseComplexityAnalysis(response.choices[0].text || '');
    } catch (error) {
      console.error('Complexity prediction failed:', error);
      return {
        complexity: 'medium',
        estimatedDuration: 3600000,
        riskFactors: ['Unable to predict complexity'],
        recommendations: ['Proceed with caution']
      };
    }
  }

  async suggestOptimizations(
    currentStrategy: MigrationStrategy,
    performance: {
      migrationSpeed: number;
      errorRate: number;
      resourceUsage: number;
    }
  ): Promise<AIRecommendation[]> {
    const prompt = this.buildOptimizationSuggestionsPrompt(currentStrategy, performance);
    
    try {
      const response = await this.openai.completions.create({
        model: 'gpt-4',
        prompt,
        max_tokens: 600,
        temperature: 0.3,
      });

      return this.parseRecommendations(response.choices[0].text || '');
    } catch (error) {
      console.error('Optimization suggestions failed:', error);
      return [];
    }
  }

  private buildOptimizationPrompt(
    sourceConfig: DatabaseConfig,
    targetConfig: DatabaseConfig,
    schema: SchemaDefinition,
    constraints: any
  ): string {
    return `
You are a database migration expert. Analyze the following migration scenario and suggest optimal strategies:

Source Database:
- Type: ${sourceConfig.type}
- Host: ${sourceConfig.host}:${sourceConfig.port}
- Database: ${sourceConfig.database}

Target Database:
- Type: ${targetConfig.type}
- Host: ${targetConfig.host}:${targetConfig.port}
- Database: ${targetConfig.database}

Schema:
${JSON.stringify(schema, null, 2)}

Constraints:
- Max Downtime: ${constraints.maxDowntime || 'Not specified'}ms
- Max Duration: ${constraints.maxDuration || 'Not specified'}ms
- Priority: ${constraints.priority}

Please provide 3-4 migration strategies with:
1. Strategy name and description
2. Estimated duration in milliseconds
3. Risk level (low/medium/high)
4. Whether downtime is required
5. Whether rollback is supported

Format as JSON array of objects.
`;
  }

  private buildSchemaAnalysisPrompt(schema: SchemaDefinition): string {
    return `
Analyze this database schema for potential issues and optimization opportunities:

${JSON.stringify(schema, null, 2)}

Provide recommendations for:
1. Performance optimizations
2. Data integrity improvements
3. Migration risks
4. Best practices

Format each recommendation with type, title, description, confidence (0-1), and impact level.
`;
  }

  private buildComplexityPrompt(
    sourceConfig: DatabaseConfig,
    targetConfig: DatabaseConfig,
    schema: SchemaDefinition
  ): string {
    return `
Analyze the complexity of this database migration:

Source: ${sourceConfig.type} -> Target: ${targetConfig.type}

Schema:
${JSON.stringify(schema, null, 2)}

Provide:
1. Complexity level (low/medium/high)
2. Estimated duration in milliseconds
3. Risk factors
4. Recommendations

Format as JSON object.
`;
  }

  private buildOptimizationSuggestionsPrompt(
    strategy: MigrationStrategy,
    performance: any
  ): string {
    return `
Current migration strategy:
${JSON.stringify(strategy, null, 2)}

Current performance:
- Migration Speed: ${performance.migrationSpeed} records/sec
- Error Rate: ${performance.errorRate}%
- Resource Usage: ${performance.resourceUsage}%

Suggest optimizations to improve performance and reliability.
`;
  }

  private parseStrategies(text: string): MigrationStrategy[] {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to parse strategies:', error);
    }
    return this.getDefaultStrategies();
  }

  private parseRecommendations(text: string): AIRecommendation[] {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to parse recommendations:', error);
    }
    return [];
  }

  private parseComplexityAnalysis(text: string): any {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to parse complexity analysis:', error);
    }
    return {
      complexity: 'medium',
      estimatedDuration: 3600000,
      riskFactors: ['Unable to analyze'],
      recommendations: ['Proceed with default settings']
    };
  }

  private getDefaultStrategies(): MigrationStrategy[] {
    return [
      {
        id: 'default-full',
        name: 'Full Migration with Downtime',
        description: 'Complete migration with scheduled downtime',
        estimatedDuration: 3600000,
        riskLevel: 'medium',
        downtime: true,
        rollbackSupported: true
      },
      {
        id: 'default-incremental',
        name: 'Incremental Migration',
        description: 'Gradual data migration with zero downtime',
        estimatedDuration: 7200000,
        riskLevel: 'low',
        downtime: false,
        rollbackSupported: true
      }
    ];
  }
}
