#!/usr/bin/env bash
# 立即消除「演示模式」顶栏（DB + 同步前端 + 可选后端）
set -euo pipefail

ENV=/var/www/wework-saas/backend/.env
DB_PASS=$(grep '^DB_PASSWORD=' "$ENV" | cut -d= -f2-)
DB_USER=$(grep '^DB_USER=' "$ENV" | cut -d= -f2-)
DB_NAME=$(grep '^DB_NAME=' "$ENV" | cut -d= -f2-)

echo "==> 已配置企微的租户：关闭 demo_mode"
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<'SQL'
UPDATE users u
INNER JOIN tenants t ON t.id = u.tenant_id
SET u.demo_mode = 0
WHERE t.wework_corp_id IS NOT NULL
  AND t.wework_secret IS NOT NULL
  AND TRIM(t.wework_secret) <> '';
SQL

echo "==> 同步前端到 Nginx root"
GIT=/var/www/wework-saas-git
cd "$GIT/frontend"
npm run build
rsync -av --delete "$GIT/frontend/dist/" /var/www/wework/
rsync -av --delete "$GIT/frontend/dist/" /var/www/zhiflow/frontend/dist/

if [ -f "$GIT/backend/src/middlewares/demoMode.js" ]; then
  cp "$GIT/backend/src/middlewares/demoMode.js" /var/www/wework-saas/backend/src/middlewares/demoMode.js
  cp "$GIT/backend/src/services/auth.service.js" /var/www/wework-saas/backend/src/services/auth.service.js 2>/dev/null || true
  cp "$GIT/backend/src/services/settings.service.js" /var/www/wework-saas/backend/src/services/settings.service.js 2>/dev/null || true
fi

pm2 restart syqw-api --update-env
sleep 5
curl -sS http://127.0.0.1:3010/health
echo
echo "前端包: $(grep -o 'index-[^\"]*\\.js' /var/www/wework/index.html | head -1)"
echo "完成。浏览器请 Ctrl+Shift+R 或无痕打开 /app"
