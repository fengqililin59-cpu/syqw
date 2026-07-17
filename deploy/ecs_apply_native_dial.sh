#!/bin/bash
# 本机直接拨打：扩展 dial_mode ENUM 为 native
# ECS Workbench: bash deploy/ecs_apply_native_dial.sh
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

SQL="$ROOT/database/099_native_dial_mode.sql"
if [ ! -f "$SQL" ]; then
  echo "缺少 $SQL，请先上传源码"
  exit 1
fi

mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$SQL"
echo ">>> dial_mode 已支持 native"

echo ">>> 重启 API"
pm2 restart syqw-api --update-env

echo "完成。请在后台 设置→个人设置 选择「本机直接拨打」并保存。"
