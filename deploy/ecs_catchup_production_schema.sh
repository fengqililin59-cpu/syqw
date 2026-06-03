#!/bin/bash
# 生产库一次性补齐：计费页/仪表盘常见缺表缺列（幂等）
# 用法: bash /var/www/wework-saas/deploy/ecs_catchup_production_schema.sh
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

run_sql_file() {
  local f="$1"
  if [ ! -f "$f" ]; then
    echo "  [SKIP] 不存在: $f"
    return 0
  fi
  echo ">>> $f"
  mysql_run < "$f" || echo "  [WARN] 执行有报错（可能已存在），继续…"
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

for f in \
  "$ROOT/database/043_billing.sql" \
  "$ROOT/database/062_billing_promo_codes.sql" \
  "$ROOT/database/049_sms.sql" \
  "$ROOT/database/068_billing_invoice_requests.sql" \
  "$ROOT/database/084_add_tasks.sql" \
  "$ROOT/database/092_balance_autorenew.sql" \
  "$ROOT/database/093_usage_addons.sql" \
  "$ROOT/database/094_invoice_enhance.sql" \
  "$ROOT/database/095_payment_purchase_type.sql" \
  "$ROOT/database/096_fix_invoice_and_balance_schema.sql"
do
  run_sql_file "$f"
done

echo "==> payment_records 微信列（幂等）"
add_col payment_records pay_code_url \
  "ALTER TABLE payment_records ADD COLUMN pay_code_url VARCHAR(512) NULL AFTER out_trade_no"
add_col payment_records wechat_transaction_id \
  "ALTER TABLE payment_records ADD COLUMN wechat_transaction_id VARCHAR(64) NULL AFTER pay_code_url"
add_col payment_records purchase_type \
  "ALTER TABLE payment_records ADD COLUMN purchase_type ENUM('subscription','balance_recharge','addon_purchase') NOT NULL DEFAULT 'subscription' AFTER pay_channel"
add_col payment_records metadata \
  "ALTER TABLE payment_records ADD COLUMN metadata JSON NULL AFTER remark"
add_col payment_records auto_invoice \
  "ALTER TABLE payment_records ADD COLUMN auto_invoice TINYINT(1) NOT NULL DEFAULT 0 AFTER metadata"

if [ -f "$ROOT/deploy/ecs_fix_billing_payment_remaining.sh" ]; then
  echo "==> 计费/加购/发票列（完整脚本）"
  bash "$ROOT/deploy/ecs_fix_billing_payment_remaining.sh"
elif [ -f "$ROOT/deploy/ecs_migrate_078_096.sql" ]; then
  echo "==> 078-096 批量迁移"
  run_sql_file "$ROOT/deploy/ecs_migrate_078_096.sql"
fi

echo "==> 关键对象检查"
mysql_run -N -e "
SELECT CONCAT('sms_templates: ', IF(COUNT(*)>0,'OK','MISSING')) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='sms_templates';
SELECT CONCAT('billing_invoice_requests: ', IF(COUNT(*)>0,'OK','MISSING')) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='billing_invoice_requests';
SELECT CONCAT('wechat_transaction_id: ', IF(COUNT(*)>0,'OK','MISSING')) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='payment_records' AND COLUMN_NAME='wechat_transaction_id';
SELECT CONCAT('tasks: ', IF(COUNT(*)>0,'OK','MISSING')) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='tasks';
SELECT CONCAT('tenant_balances: ', IF(COUNT(*)>0,'OK','MISSING')) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='tenant_balances';
"

echo "==> 重启 syqw-api"
pm2 restart syqw-api --update-env 2>/dev/null || true
echo "完成。浏览器无痕刷新 /app/billing"
