#!/usr/bin/env bash
# 修复演示数据：给 demo 跟进记录补上 next_follow_at，使「待跟进」列表在演示模式下有内容
# 用法：bash /var/www/wework-saas/deploy/ecs_fix_demo_followup_dates.sh
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
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "$1"
}

echo "=== 修复 demo intent 客户的跟进 next_follow_at ==="
mysql_run "
UPDATE customer_follow_ups cf
INNER JOIN customers c ON c.id = cf.customer_id
SET cf.next_follow_at = DATE_SUB(NOW(), INTERVAL 1 DAY)
WHERE c.tenant_id = 9999
  AND c.stage = 'intent'
  AND cf.user_id = 9999
  AND cf.content = '再次跟进，客户确认了预算，等待内部审批'
  AND cf.next_follow_at IS NULL;
"

echo "=== 补充 demo contacted 高意向客户的逾期跟进记录 ==="
mysql_run "
INSERT INTO customer_follow_ups (customer_id, user_id, type, content, next_follow_at, created_at)
SELECT
  c.id,
  9999,
  'other',
  '客户有意向，需要再跟进确认具体时间安排',
  DATE_SUB(NOW(), INTERVAL 2 DAY),
  DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM customers c
WHERE c.tenant_id = 9999
  AND c.stage = 'contacted'
  AND c.intent_score >= 70
  AND NOT EXISTS (
    SELECT 1 FROM customer_follow_ups cf2
    WHERE cf2.customer_id = c.id
      AND cf2.next_follow_at IS NOT NULL
  );
"

OVERDUE_COUNT=$(mysql_run "
SELECT COUNT(*) AS n
FROM customer_follow_ups cf
INNER JOIN customers c ON c.id = cf.customer_id
WHERE c.tenant_id = 9999
  AND cf.next_follow_at IS NOT NULL
  AND cf.next_follow_at <= NOW();
" 2>/dev/null | tail -1)

echo "✅ 完成！demo 当前逾期跟进数量：$OVERDUE_COUNT"
