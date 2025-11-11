import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Database, Server, Cloud, Activity, AlertTriangle, CheckCircle, XCircle, Zap, Brain, TrendingUp, Shield, RefreshCw, Settings, Play, Pause, RotateCcw } from 'lucide-react';

const AILiveMigrationSystem = () => {
  const [migrationState, setMigrationState] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [migrationMetrics, setMigrationMetrics] = useState({
    recordsMigrated: 0,
    totalRecords: 100000,
    throughput: 0,
    errorRate: 0,
    estimatedTime: '--:--:--'
  });
  const [evolutionStrategy, setEvolutionStrategy] = useState('progressive');
  const [systemHealth, setSystemHealth] = useState({
    source: 100,
    target: 100,
    network: 100
  });
  const [logs, setLogs] = useState([]);
  const [activePhase, setActivePhase] = useState(null);

  const migrationPhases = [
    { id: 'analysis', name: 'AI Analysis', icon: Brain, color: 'blue' },
    { id: 'schema', name: 'Schema Evolution', icon: Database, color: 'purple' },
    { id: 'data', name: 'Data Migration', icon: Server, color: 'green' },
    { id: 'validation', name: 'Validation', icon: CheckCircle, color: 'yellow' },
    { id: 'cutover', name: 'Live Cutover', icon: Zap, color: 'orange' }
  ];

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setLogs(prev => [{ timestamp, message, type }, ...prev.slice(0, 49)]);
  }, []);

  const generateAIRecommendations = useCallback(() => {
    const recommendations = [
      {
        type: 'optimization',
        title: 'Batch Size Optimization',
        description: 'Increase batch size to 5000 records for 23% faster migration',
        impact: 'high',
        autoApply: true
      },
      {
        type: 'warning',
        title: 'Peak Traffic Detected',
        description: 'Delay migration by 2 hours to avoid peak load',
        impact: 'medium',
        autoApply: false
      },
      {
        type: 'schema',
        title: 'Schema Compatibility',
        description: 'Detected 3 deprecated fields - automatic mapping configured',
        impact: 'low',
        autoApply: true
      }
    ];
    setAiRecommendations(recommendations);
    addLog('AI analysis complete - 3 recommendations generated', 'success');
  }, [addLog]);

  const simulateMigration = useCallback(() => {
    if (migrationState !== 'running') return;

    setProgress(prev => {
      const newProgress = Math.min(prev + Math.random() * 2, 100);
      
      const recordsMigrated = Math.floor((newProgress / 100) * migrationMetrics.totalRecords);
      const throughput = 1000 + Math.random() * 500;
      const errorRate = Math.random() * 0.5;
      const remainingRecords = migrationMetrics.totalRecords - recordsMigrated;
      const estimatedSeconds = Math.floor(remainingRecords / throughput);
      const hours = Math.floor(estimatedSeconds / 3600);
      const minutes = Math.floor((estimatedSeconds % 3600) / 60);
      const seconds = estimatedSeconds % 60;
      const estimatedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      setMigrationMetrics({
        recordsMigrated,
        totalRecords: migrationMetrics.totalRecords,
        throughput: Math.floor(throughput),
        errorRate: errorRate.toFixed(2),
        estimatedTime
      });

      // Update system health with some variance
      setSystemHealth({
        source: Math.max(85, 100 - Math.random() * 15),
        target: Math.max(80, 100 - Math.random() * 20),
        network: Math.max(90, 100 - Math.random() * 10)
      });

      // Update phase
      if (newProgress < 20) setActivePhase('analysis');
      else if (newProgress < 40) setActivePhase('schema');
      else if (newProgress < 70) setActivePhase('data');
      else if (newProgress < 90) setActivePhase('validation');
      else setActivePhase('cutover');

      if (newProgress >= 100) {
        setMigrationState('completed');
        addLog('Migration completed successfully!', 'success');
        setActivePhase(null);
      }

      return newProgress;
    });
  }, [migrationState, migrationMetrics.totalRecords, addLog]);

  useEffect(() => {
    const interval = setInterval(simulateMigration, 100);
    return () => clearInterval(interval);
  }, [simulateMigration]);

  const startMigration = () => {
    setMigrationState('running');
    setProgress(0);
    setLogs([]);
    addLog('Migration started', 'info');
    generateAIRecommendations();
    setActivePhase('analysis');
  };

  const pauseMigration = () => {
    setMigrationState('paused');
    addLog('Migration paused', 'warning');
  };

  const resumeMigration = () => {
    setMigrationState('running');
    addLog('Migration resumed', 'info');
  };

  const rollback = () => {
    setMigrationState('idle');
    setProgress(0);
    setActivePhase(null);
    addLog('Migration rolled back', 'error');
    setMigrationMetrics({
      recordsMigrated: 0,
      totalRecords: 100000,
      throughput: 0,
      errorRate: 0,
      estimatedTime: '--:--:--'
    });
  };

  const getHealthColor = (value) => {
    if (value >= 90) return 'text-green-400';
    if (value >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getLogColor = (type) => {
    switch(type) {
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-blue-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-purple-500/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Brain className="text-purple-400" />
                AI-Powered Live Migration System
              </h1>
              <p className="text-purple-300 mt-1">Intelligent zero-downtime migration with real-time optimization</p>
            </div>
            <div className="flex gap-3">
              {migrationState === 'idle' && (
                <button 
                  onClick={startMigration}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center gap-2 shadow-lg"
                >
                  <Play size={20} />
                  Start Migration
                </button>
              )}
              {migrationState === 'running' && (
                <button 
                  onClick={pauseMigration}
                  className="px-6 py-3 bg-yellow-600 rounded-xl text-white font-semibold hover:bg-yellow-700 transition-all duration-300 flex items-center gap-2"
                >
                  <Pause size={20} />
                  Pause
                </button>
              )}
              {migrationState === 'paused' && (
                <button 
                  onClick={resumeMigration}
                  className="px-6 py-3 bg-green-600 rounded-xl text-white font-semibold hover:bg-green-700 transition-all duration-300 flex items-center gap-2"
                >
                  <Play size={20} />
                  Resume
                </button>
              )}
              {(migrationState === 'running' || migrationState === 'paused') && (
                <button 
                  onClick={rollback}
                  className="px-6 py-3 bg-red-600 rounded-xl text-white font-semibold hover:bg-red-700 transition-all duration-300 flex items-center gap-2"
                >
                  <RotateCcw size={20} />
                  Rollback
                </button>
              )}
            </div>
          </div>

          {/* Migration Phases */}
          <div className="flex items-center justify-between bg-black/30 rounded-xl p-4">
            {migrationPhases.map((phase, index) => {
              const Icon = phase.icon;
              const isActive = activePhase === phase.id;
              const isPassed = migrationPhases.findIndex(p => p.id === activePhase) > index;
              
              return (
                <div key={phase.id} className="flex items-center">
                  <div className={`flex flex-col items-center ${isActive ? 'scale-110' : ''} transition-all duration-300`}>
                    <div className={`p-3 rounded-full ${isActive ? 'bg-gradient-to-r from-purple-600 to-blue-600 animate-pulse' : isPassed ? 'bg-green-600' : 'bg-gray-700'} transition-all duration-300`}>
                      <Icon size={24} className="text-white" />
                    </div>
                    <span className={`text-xs mt-2 ${isActive ? 'text-purple-300 font-bold' : 'text-gray-400'}`}>
                      {phase.name}
                    </span>
                  </div>
                  {index < migrationPhases.length - 1 && (
                    <div className={`w-24 h-1 mx-2 ${isPassed ? 'bg-green-600' : 'bg-gray-700'} transition-all duration-300`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress & Metrics */}
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="text-purple-400" />
                Migration Progress
              </h2>
              
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Overall Progress</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300 relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/30 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">Records Migrated</div>
                  <div className="text-2xl font-bold text-white">
                    {migrationMetrics.recordsMigrated.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    of {migrationMetrics.totalRecords.toLocaleString()}
                  </div>
                </div>
                <div className="bg-black/30 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">Throughput</div>
                  <div className="text-2xl font-bold text-green-400">
                    {migrationMetrics.throughput}
                  </div>
                  <div className="text-xs text-gray-500">records/sec</div>
                </div>
                <div className="bg-black/30 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">Error Rate</div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {migrationMetrics.errorRate}%
                  </div>
                  <div className="text-xs text-gray-500">acceptable</div>
                </div>
                <div className="bg-black/30 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">ETA</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {migrationMetrics.estimatedTime}
                  </div>
                  <div className="text-xs text-gray-500">remaining</div>
                </div>
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Brain className="text-purple-400" />
                AI Recommendations
              </h2>
              
              <div className="space-y-3">
                {aiRecommendations.map((rec, index) => (
                  <div key={index} className="bg-black/30 rounded-xl p-4 border border-purple-500/20 hover:border-purple-400/40 transition-all duration-300">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {rec.type === 'optimization' && <TrendingUp size={16} className="text-green-400" />}
                          {rec.type === 'warning' && <AlertTriangle size={16} className="text-yellow-400" />}
                          {rec.type === 'schema' && <Database size={16} className="text-blue-400" />}
                          <span className="text-white font-semibold">{rec.title}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            rec.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                            rec.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {rec.impact} impact
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm">{rec.description}</p>
                      </div>
                      <button className={`ml-4 px-3 py-1 rounded-lg text-sm font-medium transition-all duration-300 ${
                        rec.autoApply 
                          ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                          : 'bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-600/50'
                      }`}>
                        {rec.autoApply ? 'Auto-Applied' : 'Review'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Migration Logs */}
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="text-purple-400" />
                Live Activity Log
              </h2>
              
              <div className="bg-black/30 rounded-xl p-4 h-64 overflow-y-auto font-mono text-sm space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-3 hover:bg-white/5 px-2 py-1 rounded transition-colors">
                    <span className="text-gray-500">{log.timestamp}</span>
                    <span className={getLogColor(log.type)}>{log.message}</span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-gray-500 text-center mt-20">No activity yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* System Health */}
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Shield className="text-purple-400" />
                System Health
              </h2>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Server size={16} />
                      Source System
                    </span>
                    <span className={`font-bold ${getHealthColor(systemHealth.source)}`}>
                      {systemHealth.source.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        systemHealth.source >= 90 ? 'bg-green-500' :
                        systemHealth.source >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${systemHealth.source}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Cloud size={16} />
                      Target System
                    </span>
                    <span className={`font-bold ${getHealthColor(systemHealth.target)}`}>
                      {systemHealth.target.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        systemHealth.target >= 90 ? 'bg-green-500' :
                        systemHealth.target >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${systemHealth.target}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Activity size={16} />
                      Network
                    </span>
                    <span className={`font-bold ${getHealthColor(systemHealth.network)}`}>
                      {systemHealth.network.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        systemHealth.network >= 90 ? 'bg-green-500' :
                        systemHealth.network >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${systemHealth.network}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Evolution Strategy */}
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Settings className="text-purple-400" />
                Evolution Strategy
              </h2>
              
              <div className="space-y-3">
                <label className="block">
                  <input 
                    type="radio" 
                    name="strategy" 
                    value="progressive"
                    checked={evolutionStrategy === 'progressive'}
                    onChange={(e) => setEvolutionStrategy(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-white">Progressive Migration</span>
                  <p className="text-xs text-gray-400 ml-6">Gradual migration with minimal risk</p>
                </label>
                
                <label className="block">
                  <input 
                    type="radio" 
                    name="strategy" 
                    value="blue-green"
                    checked={evolutionStrategy === 'blue-green'}
                    onChange={(e) => setEvolutionStrategy(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-white">Blue-Green Deployment</span>
                  <p className="text-xs text-gray-400 ml-6">Parallel systems with instant cutover</p>
                </label>
                
                <label className="block">
                  <input 
                    type="radio" 
                    name="strategy" 
                    value="canary"
                    checked={evolutionStrategy === 'canary'}
                    onChange={(e) => setEvolutionStrategy(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-white">Canary Release</span>
                  <p className="text-xs text-gray-400 ml-6">Gradual traffic shift with monitoring</p>
                </label>
              </div>
              
              <div className="mt-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <div className="text-xs text-purple-300">
                  AI Confidence: <span className="font-bold">94%</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Strategy optimized for your workload pattern
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30">
              <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
              
              <div className="grid grid-cols-2 gap-3">
                <button className="p-3 bg-black/30 rounded-xl text-gray-400 hover:text-white hover:bg-purple-600/20 transition-all duration-300 flex flex-col items-center gap-2">
                  <RefreshCw size={20} />
                  <span className="text-xs">Sync Check</span>
                </button>
                <button className="p-3 bg-black/30 rounded-xl text-gray-400 hover:text-white hover:bg-purple-600/20 transition-all duration-300 flex flex-col items-center gap-2">
                  <Shield size={20} />
                  <span className="text-xs">Validate</span>
                </button>
                <button className="p-3 bg-black/30 rounded-xl text-gray-400 hover:text-white hover:bg-purple-600/20 transition-all duration-300 flex flex-col items-center gap-2">
                  <Zap size={20} />
                  <span className="text-xs">Boost Speed</span>
                </button>
                <button className="p-3 bg-black/30 rounded-xl text-gray-400 hover:text-white hover:bg-purple-600/20 transition-all duration-300 flex flex-col items-center gap-2">
                  <Brain size={20} />
                  <span className="text-xs">AI Optimize</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AILiveMigrationSystem;