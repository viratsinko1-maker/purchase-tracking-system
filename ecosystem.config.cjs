module.exports = {
  apps: [
    {
      name: 'pr-po-tracking',
      script: 'server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        PORT: 2025,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,           // Auto-restart on crash
      watch: false,                 // Don't watch file changes in production
      max_memory_restart: '1G',     // Restart if memory exceeds 1GB
      min_uptime: '10s',            // Minimum uptime before considering app stable
      max_restarts: 10,             // Maximum consecutive restarts (prevents restart loop)
      restart_delay: 4000,          // Wait 4s before restart
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,                   // Add timestamp to logs
    },
  ],
};
