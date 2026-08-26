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

echo "=== [4/5] 同步后端源码、依赖 & 部署脚本 ==="
BACKEND_ROOT="/var/www/wework-saas/backend"
rsync -a --exclude='.env' --exclude='node_modules' \
  "$TMP/backend/src/" "$BACKEND_SRC/"
# 同步 package 清单，避免源码用了新依赖但 node_modules 未装（如 helmet）
cp "$TMP/backend/package.json" "$BACKEND_ROOT/package.json"
cp "$TMP/backend/package-lock.json" "$BACKEND_ROOT/package-lock.json" 2>/dev/null || true
rsync -a "$TMP/deploy/" "/var/www/wework-saas/deploy/"
echo "--- npm install（生产依赖）---"
cd "$BACKEND_ROOT"
npm install --omit=dev --prefer-offline 2>&1 | tail -12

echo "=== [5/5] 重启 / 重建 API 并验证 ==="
# 相对路径 ecosystem 易把 cwd 解析成 deploy/backend（脚本找不到）。优先绝对路径启动。
if pm2 describe syqw-api >/dev/null 2>&1; then
  pm2 restart syqw-api --update-env
else
  echo "syqw-api 不在 PM2 中，按绝对路径重建…"
  pm2 start /var/www/wework-saas/backend/src/app.js \
    --name syqw-api -i 2 \
    --cwd /var/www/wework-saas/backend \
    --node-args='--max-old-space-size=512' \
    --update-env
  pm2 save
fi
sleep 6
# 从 .env 读实际端口；若无则尝试从 nginx 推断，再默认 3010
API_PORT=$(grep -m1 '^PORT=' /var/www/wework-saas/backend/.env 2>/dev/null | cut -d= -f2- | tr -d '\r "' || true)
if [[ -z "${API_PORT}" ]]; then
  API_PORT=$(nginx -T 2>/dev/null | grep -Eo '127\.0\.0\.1:[0-9]+' | head -1 | cut -d: -f2 || true)
fi
API_PORT=${API_PORT:-3010}
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/health" 2>/dev/null || echo "000")
echo "API 健康检查: $HTTP_CODE (port ${API_PORT})"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "WARN: 健康检查失败。请改跑: bash /var/www/wework-saas/deploy/ecs_recover_and_sync.sh"
  pm2 logs syqw-api --err --lines 20 --nostream || true
fi

HTTPS_JS=$(curl -sS https://wework.syzs.top/ 2>/dev/null | grep -o 'index-[^"]*\.js' | head -1 || echo "?")
echo "HTTPS 实际版本: $HTTPS_JS"

rm -rf "$TMP"
echo ""
echo "✅ 部署完成"
