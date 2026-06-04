#!/usr/bin/env bash
# 补建 wework_tokens（企微 access_token 缓存），修复「Table wework_tokens doesn't exist」
set -euo pipefail

ROOT="${ROOT:-/var/www/wework-saas}"
ENV_FILE="${ENV_FILE:-$ROOT/backend/.env}"

DB_HOST=$(grep -m1 '^DB_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PORT=$(grep -m1 '^DB_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_NAME=$(grep -m1 '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_USER=$(grep -m1 '^DB_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PASS=$(grep -m1 '^DB_PASSWORD=' "$ENV_FILE" | sed 's/^DB_PASSWORD=//' | tr -d '\r')
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}

SQL="$ROOT/database/034_wework_tokens.sql"
if [ ! -f "$SQL" ]; then
  SQL="/var/www/wework-saas-git/database/034_wework_tokens.sql"
fi

echo "==> 创建 wework_tokens（$DB_NAME）"
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$SQL"

echo "==> 补充 JSAPI ticket 列（若缺失）"
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" <<EOSQL
SET @db = '${DB_NAME}';
SET @t = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='wework_tokens');
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='wework_tokens' AND COLUMN_NAME='jsapi_ticket');
SET @sql = IF(@t > 0 AND @c = 0,
  'ALTER TABLE wework_tokens ADD COLUMN jsapi_ticket VARCHAR(256) NULL AFTER expires_at, ADD COLUMN jsapi_ticket_expires_at DATETIME NULL AFTER jsapi_ticket, ADD COLUMN agent_jsapi_ticket VARCHAR(256) NULL AFTER jsapi_ticket_expires_at, ADD COLUMN agent_jsapi_ticket_expires_at DATETIME NULL AFTER agent_jsapi_ticket',
  'SELECT ''jsapi columns ok or table missing'' AS msg');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
EOSQL

echo "==> 验证"
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW TABLES LIKE 'wework_tokens'; DESCRIBE wework_tokens;"

pm2 restart syqw-api --update-env 2>/dev/null || true
echo "完成。请刷新 https://wework.syzs.top/app/settings 重新保存企微配置。"
