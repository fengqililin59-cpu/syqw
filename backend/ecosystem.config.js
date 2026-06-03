// PM2 生产环境配置 - ZhiFlow Backend
// 使用方法：
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup   （生成开机自启命令，复制粘贴执行）
//
// 常用命令：
//   pm2 status              查看进程状态
//   pm2 logs zhiflow-api    查看实时日志
//   pm2 restart zhiflow-api 热重启
//   pm2 reload  zhiflow-api 零停机重载（适合更新代码后）
//   pm2 stop    zhiflow-api
//   pm2 delete  zhiflow-api

export default {
  apps: [
    {
      // ── 应用基本信息 ────────────────────────────────────────
      name: 'zhiflow-api',
      script: './src/app.js',                 // 相对于 cwd
      cwd: '/var/www/zhiflow/backend',        // 按实际部署路径修改

      // ── 运行模式 ────────────────────────────────────────────
      // 单核服务器用 1；多核可改为 'max' 或具体数字（需后端无状态，或使用 Redis session）
      instances: 1,
      exec_mode: 'fork',                      // 多实例时改为 'cluster'

      // ── Node.js 选项（ESM 项目必须保留）────────────────────
      node_args: [],

      // ── 环境变量 ────────────────────────────────────────────
      // 生产环境不在此处硬编码敏感值，依赖 .env 文件或系统环境变量
      env_production: {
        NODE_ENV: 'production',
        // 勿在此写 PORT：PM2 环境变量会覆盖 backend/.env，导致 Nginx 指 3002 而进程监听 3000
      },

      // ── 日志配置 ────────────────────────────────────────────
      out_file: '/var/log/pm2/zhiflow-api.out.log',
      error_file: '/var/log/pm2/zhiflow-api.err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 单个日志文件超过 50MB 后自动轮转（需安装 pm2-logrotate）
      // pm2 install pm2-logrotate
      // pm2 set pm2-logrotate:max_size 50M
      // pm2 set pm2-logrotate:retain 14

      // ── 重启策略 ────────────────────────────────────────────
      watch: false,                           // 生产环境禁用文件监听
      autorestart: true,
      max_restarts: 10,                       // 10 次重启后停止尝试
      min_uptime: '10s',                      // 运行不足 10s 的重启不计入正常重启
      restart_delay: 3000,                    // 崩溃后等待 3s 再重启（ms）
      max_memory_restart: '512M',             // 内存超 512MB 自动重启

      // ── 优雅关闭 ────────────────────────────────────────────
      kill_timeout: 5000,                     // 发送 SIGTERM 后等待 5s 再强杀
      listen_timeout: 8000,                   // 等待进程 ready 信号的超时
    },
  ],
};
