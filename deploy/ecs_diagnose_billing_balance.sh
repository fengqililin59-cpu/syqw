#!/bin/bash
# 计费页余额「加载中」+ unread-count 502 一键诊断
set -euo pipefail
BACKEND="/var/www/wework-saas/backend"
echo "=== 1. balance.controller.js 语法 ==="
node --check "$BACKEND/src/controllers/balance.controller.js" && echo "语法 OK" || echo "!! 语法错误，请覆盖该文件"

echo ""
echo "=== 2. ok() 格式 ==="
grep -n 'return ok(res' "$BACKEND/src/controllers/balance.controller.js" | head -8 || true
grep -n 'HttpError(400.*});' "$BACKEND/src/controllers/balance.controller.js" && echo "!! 发现错误 HttpError 语法" || true

echo ""
echo "=== 3. 关键表 ==="
sudo mysql wework_saas -e "
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA='wework_saas'
AND TABLE_NAME IN ('tenant_balances','recharge_packages','balance_transactions','notifications')
ORDER BY TABLE_NAME;
"

echo ""
echo "=== 4. 本机 API health ==="
curl -sS http://127.0.0.1:3010/health; echo

echo ""
echo "=== 5. PM2 最近错误 ==="
pm2 logs syqw-api --err --lines 15 --nostream 2>/dev/null || true

echo ""
echo "=== 修复建议 ==="
echo "缺表: sudo mysql wework_saas < /var/www/wework-saas-git/deploy/ecs_missing_tables.sql"
echo "缺余额表: sudo mysql wework_saas < /var/www/wework-saas-git/database/096_fix_invoice_and_balance_schema.sql"
echo "覆盖 controller: cp /var/www/wework-saas-git/backend/src/controllers/balance.controller.js $BACKEND/src/controllers/  (git pull 后)"
echo "然后: pm2 restart syqw-api --update-env"
