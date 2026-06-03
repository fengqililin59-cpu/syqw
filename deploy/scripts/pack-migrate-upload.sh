#!/usr/bin/env bash
# Mac 本地：打「迁移补充包」供阿里云 Workbench 上传到 ECS /tmp
# 用法: bash deploy/scripts/pack-migrate-upload.sh
#       INCLUDE_LOCAL=1 bash deploy/scripts/pack-migrate-upload.sh   # 附带 local_*.sql（本机 dev 用）
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/dist-workbench}"
STAMP="$(date '+%Y%m%d-%H%M%S')"
PKG_NAME="zhiflow-migrate-${STAMP}"
PKG_ROOT="$OUT_DIR/$PKG_NAME"
INCLUDE_LOCAL="${INCLUDE_LOCAL:-0}"

green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
die() { printf "\033[31m%s\033[0m\n" "$*" >&2; exit 1; }

mkdir -p "$PKG_ROOT/database" "$PKG_ROOT/deploy/scripts"

# 生产 ECS 最小集（幂等、无 FK，适合 zhiflow_prod）
# 勿再打包 088_add_notification_rules.sql（INT tenant_id + FK，与 tenants.id BIGINT 不兼容）
PROD_SQL=(
  zhiflow_prod_phase10_12_no_fk.sql
  088_notification_rules_no_fk.sql
  024_registration_otp_challenges.sql
  077_custom_fields.sql
  068_billing_invoice_requests.sql
)

for sql in "${PROD_SQL[@]}"; do
  src="$ROOT_DIR/database/$sql"
  if [[ -f "$src" ]]; then
    cp "$src" "$PKG_ROOT/database/"
  else
    die "缺少 $src（请在仓库根执行）"
  fi
done

if [[ "$INCLUDE_LOCAL" == "1" ]]; then
  yellow "附带 local_*.sql（开发库补丁，生产一般只需 PROD_SQL）..."
  shopt -s nullglob
  for src in "$ROOT_DIR"/database/local_*.sql; do
    cp "$src" "$PKG_ROOT/database/"
  done
  shopt -u nullglob
fi

cp "$ROOT_DIR/deploy/scripts/db-migrate.sh" "$PKG_ROOT/deploy/scripts/"
cp "$ROOT_DIR/deploy/scripts/ecs-apply-prod-schema.sh" "$PKG_ROOT/deploy/scripts/"
chmod +x "$PKG_ROOT/deploy/scripts/"*.sh

(
  cd "$OUT_DIR"
  tar czf "${PKG_NAME}.tar.gz" "$PKG_NAME"
)

green "迁移包已生成:"
printf "  目录: %s\n" "$PKG_ROOT"
printf "  压缩包: %s/%s.tar.gz\n" "$OUT_DIR" "$PKG_NAME"
printf "\n包含 SQL:\n"
ls -1 "$PKG_ROOT/database/"
printf "\nMac 下一步:\n"
printf "  1. Workbench 上传 %s/%s.tar.gz → ECS /tmp/\n" "$OUT_DIR" "$PKG_NAME"
printf "  2. ECS: cd /tmp && tar xzf %s.tar.gz\n" "$PKG_NAME"
printf "  3. ECS: sudo bash %s/deploy/scripts/ecs-apply-prod-schema.sh\n" "$PKG_NAME"
printf "     或解压到站点: sudo tar xzf /tmp/%s.tar.gz -C /var/www/zhiflow\n" "$PKG_NAME"
