#!/bin/bash
# 修复 AI 审核台：Unknown column 'AiReplyLog.qa_status'
set -euo pipefail
cd /var/www/wework-saas/backend
ENV_FILE=.env
DB_HOST=$(grep -m1 '^DB_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PORT=$(grep -m1 '^DB_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_NAME=$(grep -m1 '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_USER=$(grep -m1 '^DB_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | sed 's/^DB_PASSWORD=//' | tr -d '\r')
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}

add_col() {
  local col="$1" ddl="$2"
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='ai_reply_logs' AND COLUMN_NAME='$col');
SET @q := IF(@has = 0, '$ddl', 'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;"
  echo "  $col OK"
}

echo "==> ai_reply_logs 抽检字段"
add_col qa_status \
  "ALTER TABLE ai_reply_logs ADD COLUMN qa_status VARCHAR(16) NULL DEFAULT NULL AFTER approved_by"
add_col qa_reviewed_at \
  "ALTER TABLE ai_reply_logs ADD COLUMN qa_reviewed_at DATETIME NULL DEFAULT NULL AFTER qa_status"
add_col qa_reviewed_by \
  "ALTER TABLE ai_reply_logs ADD COLUMN qa_reviewed_by BIGINT UNSIGNED NULL DEFAULT NULL AFTER qa_reviewed_at"
add_col qa_note \
  "ALTER TABLE ai_reply_logs ADD COLUMN qa_note VARCHAR(500) NULL DEFAULT NULL AFTER qa_reviewed_by"

mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -e \
  "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='ai_reply_logs' AND INDEX_NAME='idx_ai_reply_qa'" | grep -q '^1$' || \
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e \
  "ALTER TABLE ai_reply_logs ADD KEY idx_ai_reply_qa (tenant_id, qa_status, created_at)"

pm2 restart syqw-api --update-env
echo "完成。刷新 /app/ai-review"
