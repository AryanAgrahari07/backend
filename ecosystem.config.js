/**
 * INFRA-2: PM2 ecosystem configuration
 *
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "qrave-api",
      script: "src/index.js",
      // Run one instance per CPU core for maximum throughput
      instances: "max",
      exec_mode: "cluster",
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      restart_delay: 4000,
      // Memory limit — restart if a single worker exceeds 512MB
      max_memory_restart: "512M",
      // Pass env vars; override in .env.production
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      // Structured pino logs
      error_file: "logs/api-error.log",
      out_file: "logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
    {
      name: "qrave-worker",
      script: "src/jobs/worker.js",
      // Single instance — queue processors should not run in parallel to avoid duplicate processing
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
      error_file: "logs/worker-error.log",
      out_file: "logs/worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
