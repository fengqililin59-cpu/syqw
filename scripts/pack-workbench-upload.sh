#!/usr/bin/env bash
# 本地打包 Workbench 上传包（Mac 无法 scp 时使用）
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/dist-workbench}"
STAMP="$(date '+%Y%m%d-%H%M%S')"
PKG_NAME="wework-workbench-${STAMP}"
PKG_ROOT="$OUT_DIR/$PKG_NAME"
SKIP_BUILD="${SKIP_BUILD:-0}"

green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }

mkdir -p "$PKG_ROOT/backend" "$PKG_ROOT/frontend" "$PKG_ROOT/database"

if [[ "$SKIP_BUILD" != "1" ]]; then
  yellow "构建前端..."
  npm run build --prefix "$FRONTEND_DIR"
else
  yellow "跳过前端构建 (SKIP_BUILD=1)"
fi

yellow "复制后端 src（完整目录，避免 app.js 依赖缺文件）..."
rsync -a \
  --exclude='*.test.js' \
  --exclude='__tests__/' \
  "$ROOT_DIR/backend/src/" "$PKG_ROOT/backend/src/"

yellow "复制后端 package.json / package-lock.json ..."
cp "$ROOT_DIR/backend/package.json" "$PKG_ROOT/backend/package.json"
cp "$ROOT_DIR/backend/package-lock.json" "$PKG_ROOT/backend/package-lock.json"
if [[ -f "$ROOT_DIR/backend/ecosystem.config.cjs" ]]; then
  cp "$ROOT_DIR/backend/ecosystem.config.cjs" "$PKG_ROOT/backend/ecosystem.config.cjs"
fi
if [[ -f "$ROOT_DIR/backend/ecosystem.config.js" ]]; then
  cp "$ROOT_DIR/backend/ecosystem.config.js" "$PKG_ROOT/backend/ecosystem.config.js"
fi

yellow "复制前端 dist..."
rsync -a "$FRONTEND_DIR/dist/" "$PKG_ROOT/frontend/dist/"

for sql in 058_customer_discovery_profile.sql 059_tenant_lead_settings.sql 060_ticket_sla.sql 061_tenant_public_webhook_settings.sql; do
  src="$ROOT_DIR/database/$sql"
  if [[ -f "$src" ]]; then
    cp "$src" "$PKG_ROOT/database/"
  fi
done

cp "$ROOT_DIR/scripts/server-unpack-workbench.sh" "$PKG_ROOT/install.sh"
cp "$ROOT_DIR/scripts/post-deploy-acceptance.sh" "$PKG_ROOT/post-deploy-acceptance.sh"
chmod +x "$PKG_ROOT/install.sh" "$PKG_ROOT/post-deploy-acceptance.sh"

(
  cd "$OUT_DIR"
  tar czf "${PKG_NAME}.tar.gz" "$PKG_NAME"
)

green "打包完成:"
printf "  目录: %s\n" "$PKG_ROOT"
printf "  压缩包: %s\n" "$OUT_DIR/${PKG_NAME}.tar.gz"
printf "\n下一步:\n"
printf "  1. Workbench 上传 %s 到 ECS /tmp/\n" "${PKG_NAME}.tar.gz"
printf "  2. 服务器执行: cd /tmp && tar xzf %s.tar.gz && cd %s && sudo ./install.sh\n" "$PKG_NAME" "$PKG_NAME"
printf "  3. 迁移 SQL 不在本包内，请另打: bash deploy/scripts/pack-migrate-upload.sh\n"
printf "     详见 docs/deploy/ecs-workbench-quickstart-zh.md\n"
