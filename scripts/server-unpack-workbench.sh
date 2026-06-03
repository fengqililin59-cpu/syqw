#!/usr/bin/env bash
# 在 ECS 上解压 Workbench 包后执行（与 pack-workbench-upload.sh 配套）
set -euo pipefail

# ZhiFlow 生产默认（wework-saas 旧栈请自行 export 覆盖）
BACKEND_DIR="${BACKEND_DIR:-/var/www/zhiflow/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-/var/www/zhiflow/frontend/dist}"
PM2_APP="${PM2_APP:-zhiflow-api}"
HEALTH_PORT="${HEALTH_PORT:-3002}"
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

echo "==> 同步 PM2 ecosystem（若包内带有）..."
if [[ -f "$SCRIPT_DIR/backend/ecosystem.config.cjs" ]]; then
  cp "$SCRIPT_DIR/backend/ecosystem.config.cjs" "$BACKEND_DIR/ecosystem.config.cjs"
fi
if [[ -f "$SCRIPT_DIR/backend/ecosystem.config.js" ]]; then
  cp "$SCRIPT_DIR/backend/ecosystem.config.js" "$BACKEND_DIR/ecosystem.config.js"
fi

echo "==> 安装依赖并重启 PM2 ..."
cd "$BACKEND_DIR"
npm ci --omit=dev
ECO_FILE=""
if [[ -f "$BACKEND_DIR/ecosystem.config.cjs" ]]; then
  ECO_FILE="$BACKEND_DIR/ecosystem.config.cjs"
elif [[ -f "$BACKEND_DIR/ecosystem.config.js" ]]; then
  ECO_FILE="$BACKEND_DIR/ecosystem.config.js"
fi
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
elif [[ -n "$ECO_FILE" ]]; then
  pm2 start "$ECO_FILE" --env production --only "$PM2_APP"
  pm2 save
else
  pm2 start src/app.js --name "$PM2_APP" --cwd "$BACKEND_DIR" --env production
  pm2 save
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
