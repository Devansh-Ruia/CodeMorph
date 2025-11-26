# CodeMorph - AI-Powered Live Migration & Evolution System

A comprehensive system that handles real-time data migration, schema evolution, and uses AI to optimize migration strategies while maintaining zero downtime.

## 🚀 Features

- **Zero Downtime Migration**: Live data migration without service interruption
- **AI-Powered Optimization**: Intelligent migration strategy recommendations
- **Multi-Database Support**: PostgreSQL, MySQL, MongoDB
- **Real-time Monitoring**: Live progress tracking and health checks
- **Schema Evolution**: Automatic schema detection and evolution
- **Rollback Support**: Safe rollback capabilities
- **Web Dashboard**: Modern UI for migration management

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Migration     │    │      AI          │    │   Monitoring    │
│     Engine      │◄──►│    Optimizer     │◄──►│   Health Check   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Database       │    │   Schema         │    │   Zero          │
│  Adapters       │    │   Evolution      │    │   Downtime      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/your-org/codemorph-migration-system.git
cd codemorph-migration-system

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Configure your environment variables
# Edit .env with your database and API keys
```

## 🔧 Configuration

Create a `.env` file with the following configuration:

```env
PORT=3000
NODE_ENV=development
OPENAI_API_KEY=your_openai_api_key_here
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:password@localhost:5432/codemorph
LOG_LEVEL=info
```

## 🚀 Quick Start

### 1. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### 2. Access the Dashboard

Open your browser and navigate to `http://localhost:3000`

### 3. Create Your First Migration

```javascript
const migrationConfig = {
  sourceDatabase: {
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: 'source_db',
    username: 'user',
    password: 'password'
  },
  targetDatabase: {
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    database: 'target_db',
    username: 'user',
    password: 'password'
  },
  schema: {
    version: '1.0',
    tables: [
      {
        name: 'users',
        columns: [
          { name: 'id', type: 'integer', nullable: false },
          { name: 'email', type: 'string', nullable: false },
          { name: 'created_at', type: 'datetime', nullable: false }
        ],
        primaryKey: 'id'
      }
    ]
  },
  constraints: {
    maxDowntime: 5000,
    maxDuration: 3600000,
    priority: 'safety'
  }
};

// POST to /api/migrations
const response = await fetch('http://localhost:3000/api/migrations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(migrationConfig)
});
```

## 📚 API Documentation

### Migration Endpoints

#### Create Migration
```http
POST /api/migrations
Content-Type: application/json

{
  "sourceDatabase": { ... },
  "targetDatabase": { ... },
  "schema": { ... },
  "constraints": { ... }
}
```

#### Start Migration
```http
POST /api/migrations/{id}/start
```

#### Pause Migration
```http
POST /api/migrations/{id}/pause
```

#### Resume Migration
```http
POST /api/migrations/{id}/resume
```

#### Rollback Migration
```http
POST /api/migrations/{id}/rollback
```

#### Get Migration Status
```http
GET /api/migrations/{id}
```

#### List All Migrations
```http
GET /api/migrations
```

### AI Analysis Endpoints

#### Analyze Schema
```http
POST /api/analyze-schema
Content-Type: application/json

{
  "schema": { ... }
}
```

#### Predict Migration Complexity
```http
POST /api/predict-complexity
Content-Type: application/json

{
  "sourceDatabase": { ... },
  "targetDatabase": { ... },
  "schema": { ... }
}
```

### Monitoring Endpoints

#### Health Check
```http
GET /api/health
```

#### System Metrics
```http
GET /api/metrics
```

## 🔄 Migration Strategies

### 1. Full Migration with Downtime
- **Duration**: ~1 hour
- **Risk**: Medium
- **Downtime**: Required
- **Rollback**: Supported

### 2. Zero Downtime Migration
- **Duration**: ~2 hours
- **Risk**: Low
- **Downtime**: None
- **Rollback**: Supported

### 3. Incremental Migration
- **Duration**: ~4 hours
- **Risk**: Low
- **Downtime**: None
- **Rollback**: Supported

## 🛠️ Development

### Project Structure

```
src/
├── core/                  # Core migration engine
│   ├── MigrationEngine.ts
│   ├── DatabaseAdapter.ts
│   ├── SchemaEvolution.ts
│   ├── DataMigrator.ts
│   └── ZeroDowntimeManager.ts
├── ai/                    # AI optimization
│   └── AIOptimizer.ts
├── monitoring/            # Health checks & metrics
│   └── HealthChecker.ts
├── dashboard/             # Web dashboard
├── types/                 # TypeScript definitions
│   └── index.ts
├── utils/                 # Utility functions
└── index.ts              # Server entry point
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- MigrationEngine.test.ts
```

### Building for Production

```bash
# Build TypeScript
npm run build

# Build dashboard
npm run build-dashboard
```

## 📊 Monitoring & Observability

### Health Checks
- Database connectivity
- Redis connection
- AI service availability
- Storage system health

### Metrics
- CPU and memory usage
- Network latency
- Database connections
- Migration speed
- Error rates

### Real-time Updates
- WebSocket connections for live updates
- Progress tracking
- Error notifications
- System health alerts

## 🔒 Security Considerations

- Database credentials are encrypted in transit
- API keys are stored securely in environment variables
- Connection pooling prevents resource exhaustion
- Audit logging for all migration operations

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check database credentials
   - Verify network connectivity
   - Ensure database is running

2. **AI Optimizer Not Working**
   - Verify OpenAI API key
   - Check API quota limits
   - Review network connectivity

3. **Migration Stuck**
   - Check logs for errors
   - Verify database permissions
   - Monitor system resources

### Log Levels

- `error`: Critical errors
- `warn`: Warning messages
- `info`: General information
- `debug`: Detailed debugging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: ruiadevansh@gmail.com
- 💬 Discord: [Join our community]
- 📖 Documentation: [docs.codemorph.dev]

## 🗺️ Roadmap

- [ ] Support for Oracle and SQL Server
- [ ] GraphQL schema migration
- [ ] Advanced AI recommendations
- [ ] Multi-region migration support
- [ ] Performance analytics dashboard
- [ ] Automated testing framework
- [ ] Cloud-native deployment options

---

