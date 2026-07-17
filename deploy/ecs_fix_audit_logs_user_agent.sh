#!/usr/bin/env bash
# 修复审计日志 500：Unknown column 'AuditLog.user_agent'
set -euo pipefail

GIT="${GIT:-/var/www/wework-saas-git}"
ENV="${ENV:-/var/www/wework-saas/backend/.env}"
SQL="$GIT/database/097_operation_audit_logs_user_agent.sql"

DB_HOST=$(grep -m1 '^DB_HOST=' "$ENV" | cut -d= -f2- | tr -d '\r"')
DB_PORT=$(grep -m1 '^DB_PORT=' "$ENV" | cut -d= -f2- | tr -d '\r"')
DB_NAME=$(grep -m1 '^DB_NAME=' "$ENV" | cut -d= -f2-)
DB_USER=$(grep -m1 '^DB_USER=' "$ENV" | cut -d= -f2-)
DB_PASS=$(grep '^DB_PASSWORD=' "$ENV" | cut -d= -f2-)
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}

if [ ! -f "$SQL" ]; then
  echo "缺少 $SQL，请先 git pull"
  exit 1
fi

echo "==> 执行 $SQL"
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$SQL"

pm2 restart syqw-api --update-env 2>/dev/null || true
echo "完成。请刷新 /app/audit-logs"
