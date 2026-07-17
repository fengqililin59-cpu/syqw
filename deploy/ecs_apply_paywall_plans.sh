#!/usr/bin/env bash
# 098 付费墙 migration：收紧体验版配额 + 专业版/增长版定价
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="${ROOT}/database/098_paywall_plans.sql"

if [[ ! -f "$SQL" ]]; then
  echo "missing $SQL" >&2
  exit 1
fi

: "${MYSQL_HOST:=127.0.0.1}"
: "${MYSQL_USER:=root}"
: "${MYSQL_DB:=wework_saas}"

echo "Applying 098_paywall_plans.sql to ${MYSQL_DB}@${MYSQL_HOST}..."
mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"${MYSQL_PWD:?set MYSQL_PWD}" "$MYSQL_DB" < "$SQL"
echo "Done. Restart syqw-api: pm2 restart syqw-api"
