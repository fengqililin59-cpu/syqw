#!/bin/bash
# 一键外呼：补齐 call_records / user_call_settings / TCCC 列 / call:make 权限
# ECS Workbench: bash deploy/ecs_fix_call_schema.sh
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
  echo ">>> $f"
  mysql_run < "$f" || echo "  [WARN] 部分语句可能已存在，继续…"
}

echo "==> 数据库: $DB_NAME @ $DB_HOST:$DB_PORT"
run_sql_file "$ROOT/database/047_call_records.sql"
run_sql_file "$ROOT/database/048_call_permission.sql"

echo "==> 验证"
mysql_run -e "SHOW TABLES LIKE 'call_records'; SHOW TABLES LIKE 'user_call_settings';"
mysql_run -e "SELECT code FROM permissions WHERE code='call:make';"
echo "完成。请部署最新前端后，在客户详情页点击「一键外呼」。"
echo "未配置 TCCC 时将使用 Mock 外呼（记录通话日志）；真实外呼请在 设置→云服务配置 填写 TCCC。"
