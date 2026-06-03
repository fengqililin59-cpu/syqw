#!/bin/bash
# 修复计费页 500：payment_records.metadata / purchase_type、usage_addon_packages.code、发票表列
set -euo pipefail
ROOT="${ROOT:-/var/www/wework-saas}"
ENV_FILE="${ENV_FILE:-$ROOT/backend/.env}"
DB_HOST=$(grep -m1 '^DB_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PORT=$(grep -m1 '^DB_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"'); DB_PORT=${DB_PORT:-3306}
DB_NAME=$(grep -m1 '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_USER=$(grep -m1 '^DB_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' "$ENV_FILE" | sed 's/^DB_PASSWORD=//' | tr -d '\r')
DB_HOST=${DB_HOST:-127.0.0.1}

mysql_run() { mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" "$@"; }

add_col() {
  local table="$1" col="$2" ddl="$3"
  mysql_run -e "
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='$table' AND COLUMN_NAME='$col');
SET @q := IF(@has = 0, '$ddl', 'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;"
  echo "  OK ${table}.${col}"
}

echo "==> payment_records（095）"
add_col payment_records purchase_type \
  "ALTER TABLE payment_records ADD COLUMN purchase_type ENUM('subscription','balance_recharge','addon_purchase') NOT NULL DEFAULT 'subscription' AFTER pay_channel"
add_col payment_records metadata \
  "ALTER TABLE payment_records ADD COLUMN metadata JSON NULL AFTER remark"
add_col payment_records auto_invoice \
  "ALTER TABLE payment_records ADD COLUMN auto_invoice TINYINT(1) NOT NULL DEFAULT 0 AFTER metadata"

echo "==> usage_addon_packages.code（093 种子依赖）"
mysql_run -e "
CREATE TABLE IF NOT EXISTS usage_addon_packages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(32) NOT NULL,
  resource_type ENUM('customers','seats','broadcasts','ai_calls') NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_months INT UNSIGNED NOT NULL DEFAULT 1,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
add_col usage_addon_packages code \
  "ALTER TABLE usage_addon_packages ADD COLUMN code VARCHAR(32) NOT NULL DEFAULT '' AFTER name"
mysql_run -e "
UPDATE usage_addon_packages SET code=CONCAT('legacy_', id) WHERE code='' OR code IS NULL;
INSERT IGNORE INTO usage_addon_packages (name, code, resource_type, quantity, price, duration_months, sort_order) VALUES
('AI调用包 1000次', 'ai_1k', 'ai_calls', 1000, 59.00, 1, 10),
('AI调用包 5000次', 'ai_5k', 'ai_calls', 5000, 199.00, 1, 20),
('群发包 2000次', 'broadcast_2k', 'broadcasts', 2000, 49.00, 1, 40),
('客户扩容包 500人', 'customers_500', 'customers', 500, 29.00, 1, 60);"

echo "==> tenant_usage_addons"
mysql_run -e "
CREATE TABLE IF NOT EXISTS tenant_usage_addons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  addon_package_id BIGINT UNSIGNED NOT NULL,
  resource_type ENUM('customers','seats','broadcasts','ai_calls') NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  consumed INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  payment_record_id BIGINT UNSIGNED DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"

echo "==> billing_invoice_requests 列对齐模型"
add_col billing_invoice_requests requested_by 'ALTER TABLE billing_invoice_requests ADD COLUMN requested_by BIGINT UNSIGNED NULL'
add_col billing_invoice_requests invoice_file_path 'ALTER TABLE billing_invoice_requests ADD COLUMN invoice_file_path VARCHAR(500) NULL'
add_col billing_invoice_requests invoice_number 'ALTER TABLE billing_invoice_requests ADD COLUMN invoice_number VARCHAR(32) NULL'
add_col billing_invoice_requests issued_by 'ALTER TABLE billing_invoice_requests ADD COLUMN issued_by BIGINT UNSIGNED NULL'
add_col billing_invoice_requests tax_no \
  "ALTER TABLE billing_invoice_requests ADD COLUMN tax_no VARCHAR(32) NOT NULL DEFAULT '' AFTER title"
mysql_run -e "
SET @has_old := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='billing_invoice_requests' AND COLUMN_NAME='tax_number');
SET @q := IF(@has_old > 0,
  'ALTER TABLE billing_invoice_requests CHANGE COLUMN tax_number tax_no VARCHAR(32) NOT NULL',
  'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;"

echo "==> 余额表"
if [ -f "$ROOT/deploy/ecs_fix_096_balance_only.sql" ]; then
  mysql_run < "$ROOT/deploy/ecs_fix_096_balance_only.sql"
else
  echo "  [SKIP] 缺 deploy/ecs_fix_096_balance_only.sql"
fi

echo "==> 校验"
mysql_run -N -e "
SELECT CONCAT('metadata: ', IF(COUNT(*)>0,'OK','MISSING')) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='payment_records' AND COLUMN_NAME='metadata';
SELECT CONCAT('addon.code: ', IF(COUNT(*)>0,'OK','MISSING')) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='usage_addon_packages' AND COLUMN_NAME='code';
"

pm2 restart syqw-api --update-env 2>/dev/null || true
echo "完成 → 无痕刷新 /app/billing"
