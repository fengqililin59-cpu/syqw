// PM2 集群配置 - ECS 生产环境 (CommonJS)
// 部署时复制到 ECS，用 pm2 start ecosystem.ecs.cjs --env production
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'syqw-api',
      script: 'src/app.js',
      cwd: '/opt/syqw/backend',
      instances: 2,
      exec_mode: 'cluster',
      node_args: '--max-old-space-size=512',
      max_memory_restart: '400M',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
      listen_timeout: 5000,
      env_production: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/syqw/api-error.log',
      out_file: '/var/log/syqw/api-out.log',
      merge_logs: true,
      max_size: '10M',
      retain: 5,
    },
  ],
};
