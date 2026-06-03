#!/bin/bash
# 一次性补齐 072–080 等迁移（存在则执行；已存在的列可能报错可忽略）
set -euo pipefail
ROOT="${ROOT:-/var/www/wework-saas}"
cd "$ROOT/backend"
ENV_FILE=.env
DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | sed 's/^DB_PASSWORD=//' | tr -d '\r')
DB_USER=$(grep -m1 '^DB_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_NAME=$(grep -m1 '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_HOST=$(grep -m1 '^DB_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"'); DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=$(grep -m1 '^DB_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"'); DB_PORT=${DB_PORT:-3306}

run_sql() {
  local f="$1"
  [ -f "$f" ] || return 0
  echo ">>> $f"
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$f" 2>&1 | tail -3 || true
}

for n in 072 073 074 075 076 077 078 079 080 081; do
  for f in "$ROOT/database/${n}"*.sql; do
    [ -f "$f" ] && run_sql "$f"
  done
done

bash "$ROOT/deploy/ecs_fix_ai_reply_logs_qa.sh" 2>/dev/null || true
echo "建议再执行: bash $ROOT/deploy/ecs_fix_ai_reply_logs_qa.sh（076 幂等版）"
