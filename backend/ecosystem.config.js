/**
 * PM2 Ecosystem Configuration
 * Handles clustering and process management for NestJS backend
 *
 * Memory Allocation: 1.5GB container
 * - 2 instances x ~500MB each = ~1GB for Node processes
 * - Remaining ~500MB for OS, buffers, and overhead
 */
module.exports = {
  apps: [
    {
      // Application name shown in PM2 dashboard
      name: 'cms-backend',

      // Entry point (compiled JS)
      script: 'dist/main.js',

      // Cluster mode settings - 2 instances for 1.5GB container
      instances: process.env.PM2_INSTANCES || 2,
      exec_mode: 'cluster',

      // Auto-restart settings
      autorestart: true,
      watch: false,
      max_memory_restart: '600M', // Restart if single instance exceeds 600MB

      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 8080,
      },

      // Logging configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      merge_logs: true,
      time: true,

      // Graceful shutdown
      kill_timeout: 10000,  // 10 seconds for graceful shutdown
      wait_ready: true,
      listen_timeout: 10000,
      shutdown_with_message: true,

      // Restart strategies
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 1000,

      // Resource monitoring
      instance_var: 'INSTANCE_ID',

      // Cron restart (optional - restart at 3 AM daily)
      // cron_restart: '0 3 * * *',

      // Source maps for debugging
      source_map_support: true,

      // Node.js arguments - optimized for 1.5GB container with 2 instances
      // Each instance gets ~500MB heap (1200MB / 2 instances = 600MB, leaving headroom)
      node_args: [
        '--max-old-space-size=500',
        '--optimize-for-size',
      ],
    },
  ],
};
