#!/usr/bin/env bash
# 一键部署：从 GitHub 拉最新代码 → 构建前端 → 更新后端 → 重启 API
# 用法：bash /tmp/syqw-build/deploy/ecs_deploy_from_git.sh
# 或：先 git clone，再 bash deploy/ecs_deploy_from_git.sh
set -euo pipefail

# 注意：源码仓库已迁移到 syqw-app（私有）。
# 旧的 syqw 仓库已被改造为投流落地页静态站，只含 index.html / privacy.html，
# 用它部署会把整个生产环境覆盖成一个落地页。
# 私有仓库在 ECS 上克隆需要凭据，若网络或鉴权不通，改用 Workbench 上传包：
#   本地: bash scripts/pack-p0-upload.sh
#   服务器: cd /tmp && tar xzf <包>.tar.gz && cd <包> && sudo bash ./p0_install.sh
#
# 生产拓扑（跨栈组合，不要按目录名想当然；如需自动探测请用 deploy/p0_install.sh）：
#   wework.syzs.top(主应用) nginx root = /var/www/zhiflow/frontend/dist
#                           location /api → 127.0.0.1:3010
#                           3010 = pm2 syqw-api (cluster 2)，cwd /var/www/wework-saas/backend，DB wework_saas
#   另一套 zhiflow 栈       pm2 zhiflow-api / 3002 / DB zhiflow_prod，
#                           仅被 crm.syzs.top 的 /upload 使用，不接主 API 流量 —— 往这里发代码就是误部署。
#   同域名下还有一个 root=/var/www/zhiflow/landing 的 server 块，是投流落地页，不要动。
# 下方路径均可用环境变量覆盖，但请先用 `nginx -T` 确认再改。
REPO="${REPO:-https://github.com/fengqililin59-cpu/syqw-app.git}"
TMP="/tmp/syqw-deploy-$$"
BACKEND_ROOT="${BACKEND_ROOT:-/var/www/wework-saas/backend}"
BACKEND_SRC="$BACKEND_ROOT/src"
# nginx root（wework.syzs.top 443）；历史上的 /var/www/wework HTTP fallback 已无 server 块引用，已移除
WEB_HTTPS="${WEB_HTTPS:-/var/www/zhiflow/frontend/dist}"
PM2_APP="${PM2_APP:-syqw-api}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/wework-saas/deploy}"
SITE_DOMAIN="${SITE_DOMAIN:-wework.syzs.top}"

echo "=== [1/5] 克隆最新代码 ==="
rm -rf "$TMP"
git clone --depth=1 "$REPO" "$TMP"

# 防呆：确认克隆到的是源码仓库而非落地页站点，否则 rsync --delete 会清空生产
if [[ ! -d "$TMP/backend/src" || ! -f "$TMP/frontend/package.json" ]]; then
  echo "ERROR: 克隆到的仓库不含 backend/src 或 frontend/package.json，疑似克隆了落地页仓库。" >&2
  echo "已中止，未改动生产环境。" >&2
  rm -rf "$TMP"
  exit 1
fi

echo "=== [1.5/5] 校验部署目标（改动前）==="
# 端口只认 .env，不做硬编码兜底：猜端口会让健康检查测到别的应用而误判成功
API_PORT=$(grep -m1 '^PORT=' "$BACKEND_ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r "' || true)
[[ -n "$API_PORT" ]] || { echo "ERROR: $BACKEND_ROOT/.env 中没有 PORT，无法确认部署目标。" >&2; rm -rf "$TMP"; exit 1; }
[[ -d "$BACKEND_SRC" ]] || { echo "ERROR: $BACKEND_SRC 不存在，后端目标错误。" >&2; rm -rf "$TMP"; exit 1; }
[[ -f "$WEB_HTTPS/index.html" ]] || { echo "ERROR: $WEB_HTTPS 下没有 index.html，疑似前端目标错误。" >&2; rm -rf "$TMP"; exit 1; }
if command -v nginx >/dev/null 2>&1; then
  NGINX_DUMP="$(nginx -T 2>/dev/null || true)"
  # 前端目标必须是当前生效的 nginx root，后端端口必须真的承载线上 API 流量，
  # 否则会出现「新前端 + 旧后端」（历史事故：代码发到了 zhiflow 栈 3002）
  grep -q "root[[:space:]]\+${WEB_HTTPS};" <<<"$NGINX_DUMP" || {
    echo "ERROR: nginx 配置中没有 root $WEB_HTTPS，前端目标可能已变更。请先 nginx -T 确认后用 WEB_HTTPS=... 重跑。" >&2
    rm -rf "$TMP"; exit 1; }
  grep -q "proxy_pass http://127\.0\.0\.1:${API_PORT}" <<<"$NGINX_DUMP" || {
    echo "ERROR: nginx 中没有反代到 127.0.0.1:${API_PORT} 的配置，后端目标与线上流量不匹配。" >&2
    rm -rf "$TMP"; exit 1; }
fi
echo "  前端 $WEB_HTTPS / 后端 $BACKEND_ROOT (port $API_PORT) / pm2 $PM2_APP"

echo "=== [2/5] 构建前端 ==="
cd "$TMP/frontend"
npm install --prefer-offline 2>&1 | tail -5
npm run build

echo "=== [3/5] 部署前端到 nginx ==="
rsync -a --delete "$TMP/frontend/dist/" "$WEB_HTTPS/"
echo "前端版本: $(grep -o 'index-[^\"]*\.js' "$WEB_HTTPS/index.html" | head -1)"

echo "=== [4/5] 同步后端源码、依赖 & 部署脚本 ==="
rsync -a --exclude='.env' --exclude='node_modules' \
  "$TMP/backend/src/" "$BACKEND_SRC/"
# 同步 package 清单，避免源码用了新依赖但 node_modules 未装（如 helmet）
cp "$TMP/backend/package.json" "$BACKEND_ROOT/package.json"
cp "$TMP/backend/package-lock.json" "$BACKEND_ROOT/package-lock.json" 2>/dev/null || true
rsync -a "$TMP/deploy/" "$DEPLOY_DIR/"
echo "--- npm install（生产依赖）---"
cd "$BACKEND_ROOT"
npm install --omit=dev --prefer-offline 2>&1 | tail -12

echo "=== [5/5] 重启 / 重建 API 并验证 ==="
# 相对路径 ecosystem 易把 cwd 解析成 deploy/backend（脚本找不到）。优先绝对路径启动。
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  # cluster 模式用 reload 滚动重启，避免 2 个实例同时下线出现 502
  if pm2 describe "$PM2_APP" 2>/dev/null | grep -qi 'cluster'; then
    pm2 reload "$PM2_APP" --update-env
  else
    pm2 restart "$PM2_APP" --update-env
  fi
else
  echo "$PM2_APP 不在 PM2 中，按绝对路径重建…"
  pm2 start "$BACKEND_SRC/app.js" \
    --name "$PM2_APP" -i 2 \
    --cwd "$BACKEND_ROOT" \
    --node-args='--max-old-space-size=512' \
    --update-env
  pm2 save
fi
sleep 6
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/health" 2>/dev/null || echo "000")
echo "API 健康检查: $HTTP_CODE (port ${API_PORT})"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "WARN: 健康检查失败。请改跑: bash $DEPLOY_DIR/ecs_recover_and_sync.sh"
  pm2 logs "$PM2_APP" --err --lines 20 --nostream || true
fi

HTTPS_JS=$(curl -sS "https://$SITE_DOMAIN/" 2>/dev/null | grep -o 'index-[^"]*\.js' | head -1 || echo "?")
echo "HTTPS 实际版本: $HTTPS_JS"

rm -rf "$TMP"
echo ""
echo "✅ 部署完成"
