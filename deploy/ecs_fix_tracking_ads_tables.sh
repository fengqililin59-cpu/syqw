#!/usr/bin/env bash
# 补建渠道分析 / 广告 ROI 依赖表（page_visits、marketing_events、ad_*、agg_*）
set -euo pipefail

ROOT="${ROOT:-/var/www/wework-saas}"
GIT="${GIT:-/var/www/wework-saas-git}"
ENV_FILE="${ENV_FILE:-$ROOT/backend/.env}"

DB_HOST=$(grep -m1 '^DB_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PORT=$(grep -m1 '^DB_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_NAME=$(grep -m1 '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_USER=$(grep -m1 '^DB_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PASS=$(grep -m1 '^DB_PASSWORD=' "$ENV_FILE" | sed 's/^DB_PASSWORD=//' | tr -d '\r')
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}

run_sql() {
  local f="$1"
  local base
  base="$(basename "$f")"
  if [ ! -f "$f" ]; then
    echo "  [SKIP] 不存在: $f"
    return 0
  fi
  echo ">>> $base"
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$f"
}

SQL_ROOT="$GIT/database"
[ -d "$SQL_ROOT" ] || SQL_ROOT="$ROOT/database"

for f in \
  "$SQL_ROOT/009_ad_click_tracking.sql" \
  "$SQL_ROOT/025_page_visits_tracking.sql" \
  "$SQL_ROOT/026_ad_conversion_events.sql" \
  "$SQL_ROOT/027_marketing_events.sql" \
  "$SQL_ROOT/028_ad_spend_daily.sql" \
  "$SQL_ROOT/030_agg_ads_roi_daily.sql" \
  "$SQL_ROOT/031_agg_channel_daily.sql" \
  "$SQL_ROOT/032_aggregation_meta.sql"
do
  run_sql "$f"
done

echo "==> 验证"
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SHOW TABLES LIKE 'page_visits';
SHOW TABLES LIKE 'marketing_events';
SHOW TABLES LIKE 'ad_click_records';
SHOW TABLES LIKE 'agg_channel_daily';
"

pm2 restart syqw-api --update-env 2>/dev/null || true
echo "完成。请刷新 https://wework.syzs.top/app/channel-report"
