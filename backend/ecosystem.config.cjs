// PM2 生产配置（CommonJS，PM2 可正确解析；勿用 export default 的 .js）
// 启动: cd /var/www/zhiflow/backend && pm2 start ecosystem.config.cjs --env production
// 或: pm2 start ecosystem.config.cjs --env production --only zhiflow-api

module.exports = {
  apps: [
    {
      name: 'zhiflow-api',
      script: './src/app.js',
      cwd: '/var/www/zhiflow/backend',
      instances: 1,
      exec_mode: 'fork',
      node_args: [],
      env_production: {
        NODE_ENV: 'production',
      },
      out_file: '/var/log/pm2/zhiflow-api.out.log',
      error_file: '/var/log/pm2/zhiflow-api.err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      listen_timeout: 8000,
    },
  ],
};
