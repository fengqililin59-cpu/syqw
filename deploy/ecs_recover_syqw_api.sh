#!/bin/bash
# syqw-api 502 / 3010 Connection refused 恢复
set -euo pipefail
RUN=/var/www/wework-saas/backend
cd "$RUN"

echo "=== PM2 配置 ==="
pm2 describe syqw-api 2>/dev/null | grep -E 'script path|exec cwd|status|restarts' || true

echo ""
echo "=== 前台试跑 8 秒（看启动报错）==="
timeout 8 node src/app.js 2>&1 || true

echo ""
echo "=== 端口监听 ==="
ss -tlnp | grep -E ':3010|:3000|:3002' || echo "3010/3000/3002 均未监听"

echo ""
echo "=== .env PORT / NODE_ENV ==="
grep -E '^PORT=|^NODE_ENV=' .env 2>/dev/null || echo "无 PORT 行（将用默认）"

echo ""
echo "=== 建议：用正确 cwd 重建 PM2 ==="
echo "pm2 delete syqw-api 2>/dev/null || true"
echo "cd $RUN && pm2 start src/app.js --name syqw-api -i 2 --cwd $RUN --update-env"
echo "pm2 save"
echo "sleep 2 && curl -sS http://127.0.0.1:3010/health"
