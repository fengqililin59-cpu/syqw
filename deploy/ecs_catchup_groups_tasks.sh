#!/usr/bin/env bash
# 客户群 / SOP / 任务 等常见缺表（幂等）
set -euo pipefail

GIT="${GIT:-/var/www/wework-saas-git}"
ENV="${ENV:-/var/www/wework-saas/backend/.env}"
DB_PASS=$(grep '^DB_PASSWORD=' "$ENV" | cut -d= -f2-)
DB_USER=$(grep '^DB_USER=' "$ENV" | cut -d= -f2-)
DB_NAME=$(grep '^DB_NAME=' "$ENV" | cut -d= -f2-)

run() {
  local f="$1"
  [ -f "$f" ] || { echo "SKIP missing $f"; return 0; }
  echo ">>> $(basename "$f")"
  mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$f" || echo "  [WARN] 可能有重复列，可忽略"
}

# 合同（tasks 外键依赖，若已存在会跳过）
run "$GIT/database/083_add_contracts.sql"
run "$GIT/database/084_add_tasks.sql"
run "$GIT/database/046_customer_groups.sql"

echo "==> 验证"
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SHOW TABLES LIKE 'customer_groups';
SHOW TABLES LIKE 'group_sop_tasks';
SHOW TABLES LIKE 'tasks';
"

pm2 restart syqw-api --update-env 2>/dev/null || true
echo "完成。请刷新 /app/groups"
