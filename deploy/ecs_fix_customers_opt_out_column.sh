#!/bin/bash
# 修复新建客户报错：Unknown column 'opt_out_auto_msg' in 'field list'
# ECS Workbench: bash deploy/ecs_fix_customers_opt_out_column.sh
set -euo pipefail
ROOT="${ROOT:-/var/www/wework-saas}"
ENV_FILE="${ENV_FILE:-$ROOT/backend/.env}"

DB_HOST=$(grep -m1 '^DB_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PORT=$(grep -m1 '^DB_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_NAME=$(grep -m1 '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_USER=$(grep -m1 '^DB_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' "$ENV_FILE" | sed 's/^DB_PASSWORD=//' | tr -d '\r')
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}

mysql_run() {
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" "$@"
}

add_col() {
  local table="$1" col="$2" ddl="$3"
  mysql_run -e "
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='$table' AND COLUMN_NAME='$col');
SET @q := IF(@has = 0, '$ddl', 'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;"
  echo "  OK ${table}.${col}"
}

echo "==> 数据库: $DB_NAME @ $DB_HOST:$DB_PORT"
echo "==> customers 表补齐（幂等）"

add_col customers opt_out_auto_msg \
  "ALTER TABLE customers ADD COLUMN opt_out_auto_msg TINYINT(1) NOT NULL DEFAULT 0 COMMENT '客户退订自动消息（流程直发）' AFTER priority"

# 013 同批：若 tenants.allow_auto_send 也缺失，一并补齐
add_col tenants allow_auto_send \
  "ALTER TABLE tenants ADD COLUMN allow_auto_send TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否允许流程/自动化向客户直发企微消息' AFTER status"

echo ""
echo "==> 验证"
mysql_run -e "SHOW COLUMNS FROM customers LIKE 'opt_out_auto_msg';"
echo "完成。请刷新客户页后重新「新建客户」。"
