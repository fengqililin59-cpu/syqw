#!/bin/bash
# ECS：补齐 tenants 表 inbox_ai* 列，修复注册 500
set -euo pipefail
cd /var/www/wework-saas/backend
ENV_FILE="${ENV_FILE:-.env}"

get_env() {
  grep -m1 "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//'
}

DB_HOST=$(get_env DB_HOST); DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=$(get_env DB_PORT); DB_PORT=${DB_PORT:-3306}
DB_NAME=$(get_env DB_NAME); DB_NAME=${DB_NAME:-wework_saas}
DB_USER=$(get_env DB_USER); DB_USER=${DB_USER:-root}
DB_PASSWORD=$(get_env DB_PASSWORD)

if [ -z "$DB_PASSWORD" ]; then
  echo "ERROR: .env 无 DB_PASSWORD"
  exit 1
fi

run_sql() {
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" "$@"
}

add_col_if_missing() {
  local col="$1"
  local ddl="$2"
  run_sql -N -e "
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='tenants' AND COLUMN_NAME='$col');
SET @q := IF(@has = 0, '$ddl', 'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;
"
  echo "  checked: $col"
}

echo "==> 补齐 tenants 列 (${DB_USER}@${DB_HOST}/${DB_NAME})"
add_col_if_missing inbox_ai_auto_send \
  "ALTER TABLE tenants ADD COLUMN inbox_ai_auto_send TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_auto_send"
add_col_if_missing inbox_ai_auto_send_pricing \
  "ALTER TABLE tenants ADD COLUMN inbox_ai_auto_send_pricing TINYINT(1) NOT NULL DEFAULT 0 AFTER inbox_ai_auto_send"
add_col_if_missing inbox_ai_notify_assignee_on_auto_send \
  "ALTER TABLE tenants ADD COLUMN inbox_ai_notify_assignee_on_auto_send TINYINT(1) NOT NULL DEFAULT 1 AFTER inbox_ai_auto_send_pricing"
add_col_if_missing inbox_ai_platform_disabled \
  "ALTER TABLE tenants ADD COLUMN inbox_ai_platform_disabled TINYINT(1) NOT NULL DEFAULT 0 AFTER inbox_ai_notify_assignee_on_auto_send"
add_col_if_missing inbox_auto_draft_enabled \
  "ALTER TABLE tenants ADD COLUMN inbox_auto_draft_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER inbox_ai_platform_disabled"

echo ""
echo "==> 当前 inbox_ai* / inbox_auto_draft 列"
run_sql -e "SHOW COLUMNS FROM tenants WHERE Field LIKE 'inbox_ai%' OR Field = 'inbox_auto_draft_enabled';"

echo ""
echo "==> 用户 fengqili"
run_sql -e "SELECT id, tenant_id, username, status FROM users WHERE username LIKE '%fengqili%' OR email LIKE '%fengqili%';"

pm2 restart syqw-api --update-env
echo ""
echo "完成。请无痕打开 https://wework.syzs.top/register 重新注册。"
