// PM2 生产环境配置 (CommonJS)
// 启动: pm2 start deploy/ecosystem.config.cjs --env production
// 保存: pm2 save
// 开机自启: pm2 startup

module.exports = {
  apps: [
    {
      // ===== 后端 API 服务 =====
      name: 'syqw-api',
      cwd: './backend',
      script: 'src/app.js',
      node_args: '--max-old-space-size=512',
      env: {
        NODE_ENV: 'production',
      },

      // 日志（生产服务器用 /var/log/syqw/，本地开发用 ./logs/）
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      max_size: '10M',
      retain: 5,

      // 进程管理
      instances: 2,           // 2 个实例（可替换为 'max' 使用全部 CPU）
      exec_mode: 'cluster',   // 集群模式，负载均衡
      watch: false,           // 生产环境不启用文件监听

      // 优雅重启
      kill_timeout: 10000,
      listen_timeout: 5000,
      max_restarts: 10,
      max_memory_restart: '400M',
      restart_delay: 3000,

      // 健康检查
      wait_ready: true,
      shutdown_with_message: true,

      autorestart: true,
    },
  ],

  // ===== 部署配置（pm2 deploy） =====
  deploy: {
    production: {
      user: 'root',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-org/syqw.git',
      path: '/opt/syqw',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm ci --prefix backend && npm ci --prefix frontend && npm run build --prefix frontend && pm2 reload deploy/ecosystem.config.cjs --env production',
      'pre-setup': 'apt update && apt install -y nodejs npm mysql-server nginx',
    },
  },
};
