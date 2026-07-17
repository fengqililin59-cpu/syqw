#!/bin/bash
# 应用一键外呼热修（需先上传 /root/syqw-call-hotfix.tgz 或 /root/syqw-frontend-dist.tgz）
set -euo pipefail

RUN=/var/www/wework-saas
GIT=/var/www/wework-saas-git
WEB=/var/www/wework

echo "=== 1. 解压源码热修（可选）==="
if [ -f /root/syqw-call-hotfix.tgz ]; then
  tar xzf /root/syqw-call-hotfix.tgz -C "$RUN"
  echo "已解压到 $RUN"
  FE="$GIT/frontend"
  cp "$RUN/frontend/src/components/CallButton.tsx" "$FE/src/components/"
  cp "$RUN/frontend/src/pages/CustomerDetailPage.tsx" "$FE/src/pages/"
  cp "$RUN/frontend/src/lib/roles.ts" "$FE/src/lib/"
  cp "$RUN/frontend/src/api/calls.ts" "$FE/src/api/"
  cp "$RUN/backend/src/utils/permissions.js" "$RUN/backend/src/utils/"
  cp "$RUN/backend/src/services/tccc.service.js" "$RUN/backend/src/services/"
  cp "$RUN/backend/src/services/call.service.js" "$RUN/backend/src/services/"
  echo "源码已同步"
else
  echo "跳过：无 /root/syqw-call-hotfix.tgz"
fi

if [ -f /root/syqw-backend-call.tgz ]; then
  tar xzf /root/syqw-backend-call.tgz -C "$RUN"
  echo "backend 热修已解压"
fi

echo ""
echo "=== 2. 前端 ==="
if [ -f /root/syqw-frontend-dist.tgz ]; then
  tar xzf /root/syqw-frontend-dist.tgz -C "$WEB"
  echo "已部署预构建前端 dist → $WEB"
else
  echo "在 $GIT/frontend 构建…"
  cd "$GIT/frontend"
  npm run build
  cp -r dist/* "$WEB/"
fi
grep -o 'index-[^"]*\.js' "$WEB/index.html" || true

echo ""
echo "=== 3. 重启 API ==="
pm2 restart syqw-api --update-env
sleep 4
ss -tlnp | grep ':3010' || echo "WARN: 3010 未监听"
curl -sS http://127.0.0.1:3010/health || pm2 logs syqw-api --err --lines 15 --nostream

echo ""
echo "完成。无痕打开 https://wework.syzs.top/app/customers 验证「一键外呼」。"
