#!/usr/bin/env bash
# 在服务器上于项目根目录执行：bash scripts/apply-ai-employee-migrations.sh
# 从 backend/.env 读取 DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME（或 DATABASE_URL）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/backend/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "找不到 $ENV_FILE，请先在项目目录配置数据库连接" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-syqw}"

if [[ -z "${DB_PASSWORD:-}" ]]; then
  echo "请在 backend/.env 中设置 DB_PASSWORD" >&2
  exit 1
fi

MIGRATIONS=(
  "010_phase3_campaigns.sql"
  "054_ai_employee_inbox.sql"
  "055_inbox_permissions.sql"
  "056_service_tickets_orders.sql"
  "057_ticket_permissions.sql"
)

echo "==> 数据库 ${DB_NAME}@${DB_HOST}:${DB_PORT} 用户 ${DB_USER}"
for f in "${MIGRATIONS[@]}"; do
  path="${ROOT}/database/${f}"
  if [[ ! -f "$path" ]]; then
    echo "跳过（文件不存在）: $f" >&2
    continue
  fi
  echo "==> 执行 $f"
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$path"
done

echo "==> 完成。请重启 backend 并确认 .env 中 PUBLIC_INBOX_WEBHOOK_SECRET、ENABLE_INBOX_SLA_CRON 等已配置。"
