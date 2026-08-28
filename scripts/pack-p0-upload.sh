#!/usr/bin/env bash
# 本地打包美业 P0 部署包，供阿里云 Workbench 上传
# 用法：bash scripts/pack-p0-upload.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/dist-workbench}"
STAMP="$(date '+%Y%m%d-%H%M%S')"
PKG_NAME="zhiflow-p0-${STAMP}"
PKG_ROOT="$OUT_DIR/$PKG_NAME"
SKIP_BUILD="${SKIP_BUILD:-0}"

yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }

rm -rf "$PKG_ROOT"
mkdir -p "$PKG_ROOT/backend" "$PKG_ROOT/frontend" "$PKG_ROOT/database"

if [[ "$SKIP_BUILD" != "1" ]]; then
  yellow "构建前端..."
  npm run build --prefix "$ROOT_DIR/frontend"
else
  yellow "跳过前端构建 (SKIP_BUILD=1)"
fi

yellow "复制后端 src ..."
rsync -a --exclude='*.test.js' --exclude='__tests__/' \
  "$ROOT_DIR/backend/src/" "$PKG_ROOT/backend/src/"

cp "$ROOT_DIR/backend/package.json" "$PKG_ROOT/backend/package.json"
cp "$ROOT_DIR/backend/package-lock.json" "$PKG_ROOT/backend/package-lock.json" 2>/dev/null || true

yellow "复制前端 dist ..."
rsync -a "$ROOT_DIR/frontend/dist/" "$PKG_ROOT/frontend/dist/"

yellow "复制 P0 迁移 SQL ..."
cp "$ROOT_DIR/database/100_beauty_appointments_cards.sql" "$PKG_ROOT/database/"

cp "$ROOT_DIR/deploy/p0_install.sh" "$PKG_ROOT/p0_install.sh"
chmod +x "$PKG_ROOT/p0_install.sh"

( cd "$OUT_DIR" && tar czf "${PKG_NAME}.tar.gz" "$PKG_NAME" )

green "打包完成: $OUT_DIR/${PKG_NAME}.tar.gz"
printf "大小: %s\n" "$(du -h "$OUT_DIR/${PKG_NAME}.tar.gz" | cut -f1)"
printf "\n服务器执行:\n"
printf "  cd /tmp && tar xzf %s.tar.gz && cd %s && sudo bash ./p0_install.sh\n" "$PKG_NAME" "$PKG_NAME"
