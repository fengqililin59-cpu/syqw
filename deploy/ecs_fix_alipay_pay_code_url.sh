#!/usr/bin/env bash
# ECS：修复支付宝计费「Data too long for column pay_code_url」并重启 API
set -euo pipefail

BACKEND=/var/www/wework-saas/backend
ENV_FILE="${BACKEND}/.env"
DB_NAME=$(grep '^DB_NAME=' "$ENV_FILE" | cut -d= -f2-)
DB_USER=$(grep '^DB_USER=' "$ENV_FILE" | cut -d= -f2-)
DB_PASS=$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)

echo "==> 放宽 pay_code_url 列宽（若尚未执行）"
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<'SQL'
ALTER TABLE payment_records
  MODIFY COLUMN pay_code_url VARCHAR(2048) NULL;
SQL

echo "==> 将误写入的超长支付宝 URL 改为短标记 pagepay:订单号"
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<'SQL'
UPDATE payment_records
SET pay_code_url = CONCAT('pagepay:', out_trade_no)
WHERE pay_channel = 'alipay'
  AND status = 'pending'
  AND pay_code_url IS NOT NULL
  AND pay_code_url NOT LIKE 'mock:alipay:%'
  AND pay_code_url NOT LIKE 'pagepay:%'
  AND (LENGTH(pay_code_url) > 128 OR pay_code_url LIKE 'https://%');
SQL

echo "==> 重启 syqw-api"
pm2 restart syqw-api --update-env
sleep 6
curl -sS http://127.0.0.1:3010/health || true
echo
echo "完成。请在本机 git push 后 rsync backend，或直接在 ECS 同步 billing.service.js 后再次 pm2 restart。"
