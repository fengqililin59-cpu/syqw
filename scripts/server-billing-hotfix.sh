#!/usr/bin/env bash
# 在 ECS 上执行：补全缺失的 billing 模块并重启 wework-api
set -euo pipefail

BACKEND_DIR="${BACKEND_DIR:-/var/www/wework-saas/backend}"
PM2_APP="${PM2_APP:-wework-api}"
HOTFIX="${1:-/tmp/billing-hotfix.tar.gz}"

if [[ ! -f "$HOTFIX" ]]; then
  echo "未找到 $HOTFIX" >&2
  echo "请先从本机上传 dist-workbench/billing-hotfix.tar.gz 到 ECS /tmp/" >&2
  exit 1
fi

echo "==> 解压 billing 热修到 $BACKEND_DIR"
tar xzf "$HOTFIX" -C "$BACKEND_DIR"

echo "==> 确认文件"
ls -la "$BACKEND_DIR/src/routes/billing.routes.js"

echo "==> 重启 $PM2_APP"
pm2 restart "$PM2_APP" --update-env
sleep 3

echo "==> 健康检查"
curl -fsS "http://127.0.0.1:3010/health?deep=1"
echo ""
