/**
 * PM2 Ecosystem Configuration
 * Optimized for 4+ core production systems
 */

export default {
  apps: [{
    name: 'tgs-converter',
    script: './server.js',
    instances: 4,  // For 4+ core systems
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      WORKER_POOL_SIZE: 0,  // Auto-detect per instance
      CACHE_SIZE: 500       // 500 animations per instance
    },
    
    // Logging
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Restart strategy
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    
    // Kill timeout
    kill_timeout: 5000,
    
    // Advanced features
    listen_timeout: 10000,
    shutdown_with_message: true
  }]
};
