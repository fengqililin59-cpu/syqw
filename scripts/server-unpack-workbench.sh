#!/usr/bin/env bash
# 在 ECS 上解压 Workbench 包后执行（与 pack-workbench-upload.sh 配套）
set -euo pipefail

BACKEND_DIR="${BACKEND_DIR:-/var/www/wework-saas/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-/var/www/wework}"
PM2_APP="${PM2_APP:-wework-api}"
HEALTH_PORT="${HEALTH_PORT:-3010}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -d "$SCRIPT_DIR/backend/src" ]]; then
  echo "未找到 backend/src，请在解压后的包目录内运行 ./install.sh" >&2
  exit 1
fi

echo "==> 同步后端 src ..."
rsync -a "$SCRIPT_DIR/backend/src/" "$BACKEND_DIR/src/"

if [[ -f "$SCRIPT_DIR/backend/package.json" ]]; then
  echo "==> 同步 package.json / package-lock.json ..."
  cp "$SCRIPT_DIR/backend/package.json" "$BACKEND_DIR/package.json"
  cp "$SCRIPT_DIR/backend/package-lock.json" "$BACKEND_DIR/package-lock.json"
fi

echo "==> 同步前端静态 ..."
rsync -a --delete "$SCRIPT_DIR/frontend/dist/" "$FRONTEND_DIR/"

if [[ -f "$SCRIPT_DIR/database/058_customer_discovery_profile.sql" ]]; then
  echo "==> 检测到迁移 058，请手动确认是否已执行:"
  echo "    mysql ... < $SCRIPT_DIR/database/058_customer_discovery_profile.sql"
fi
if [[ -f "$SCRIPT_DIR/database/059_tenant_lead_settings.sql" ]]; then
  echo "==> 检测到迁移 059（线索分配），请手动确认是否已执行:"
  echo "    mysql ... < $SCRIPT_DIR/database/059_tenant_lead_settings.sql"
fi
if [[ -f "$SCRIPT_DIR/database/060_ticket_sla.sql" ]]; then
  echo "==> 检测到迁移 060（工单 SLA），请手动确认是否已执行:"
  echo "    mysql ... < $SCRIPT_DIR/database/060_ticket_sla.sql"
fi
if [[ -f "$SCRIPT_DIR/database/061_tenant_public_webhook_settings.sql" ]]; then
  echo "==> 检测到迁移 061（公域 Webhook 验签），请手动确认是否已执行:"
  echo "    mysql ... < $SCRIPT_DIR/database/061_tenant_public_webhook_settings.sql"
fi

echo "==> 安装依赖并重启 PM2 ..."
cd "$BACKEND_DIR"
npm ci --omit=dev
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  pm2 start src/app.js --name "$PM2_APP" --cwd "$BACKEND_DIR"
fi

echo "==> 健康检查 ..."
curl -fsS "http://127.0.0.1:${HEALTH_PORT}/health" | head -c 200
echo ""
curl -fsS "http://127.0.0.1:${HEALTH_PORT}/health?deep=1" | head -c 400
echo ""
echo "建议验收（需管理员账号或 TOKEN）:"
echo "  cd $SCRIPT_DIR && TENANT_ID=1 USERNAME=admin PASSWORD='***' ./post-deploy-acceptance.sh"
echo "  仅健康检查: PHASE=public ./post-deploy-acceptance.sh"
echo ""
echo "完成。请按 docs/ops/workbench-upload-manifest.md 验收。"
