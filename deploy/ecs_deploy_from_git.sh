#!/usr/bin/env bash
# 一键部署：从 GitHub 拉最新代码 → 构建前端 → 更新后端 → 重启 API
# 用法：bash /tmp/syqw-build/deploy/ecs_deploy_from_git.sh
# 或：先 git clone，再 bash deploy/ecs_deploy_from_git.sh
set -euo pipefail

REPO="https://github.com/fengqililin59-cpu/syqw.git"
TMP="/tmp/syqw-deploy-$$"
BACKEND_SRC="/var/www/wework-saas/backend/src"
# nginx HTTPS root（wework.syzs.top 443）
WEB_HTTPS="/var/www/zhiflow/frontend/dist"
# nginx HTTP root（80 fallback）
WEB_HTTP="/var/www/wework"

echo "=== [1/5] 克隆最新代码 ==="
rm -rf "$TMP"
git clone --depth=1 "$REPO" "$TMP"

echo "=== [2/5] 构建前端 ==="
cd "$TMP/frontend"
npm install --prefer-offline 2>&1 | tail -5
npm run build

echo "=== [3/5] 部署前端到 nginx ==="
rsync -a --delete "$TMP/frontend/dist/" "$WEB_HTTPS/"
rsync -a --delete "$TMP/frontend/dist/" "$WEB_HTTP/"
echo "前端版本: $(grep -o 'index-[^\"]*\.js' "$WEB_HTTPS/index.html" | head -1)"

echo "=== [4/5] 同步后端源码 ==="
rsync -a --exclude='.env' --exclude='node_modules' \
  "$TMP/backend/src/" "$BACKEND_SRC/"

echo "=== [5/5] 重启 API 并验证 ==="
pm2 restart syqw-api
sleep 4
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3010/health 2>/dev/null || echo "000")
echo "API 健康检查: $HTTP_CODE"

HTTPS_JS=$(curl -sS https://wework.syzs.top/ 2>/dev/null | grep -o 'index-[^"]*\.js' | head -1 || echo "?")
echo "HTTPS 实际版本: $HTTPS_JS"

rm -rf "$TMP"
echo ""
echo "✅ 部署完成"
