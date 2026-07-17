#!/bin/bash
# P0 粘贴评分 + P1 付费墙 + P2 战力榜 — ECS 一键热修
#
# Workbench 上传后执行：
#   export MYSQL_PWD='你的MySQL密码'
#   bash /root/ecs_hotfix_p0_p1_p2.sh
#
# 需上传（Mac 打包见 deploy/pack_features_hotfix.sh）：
#   /root/syqw-backend-features.tgz
#   /root/syqw-frontend-dist.tgz  （可选，有则部署前端）
set -euo pipefail

RUN="${RUN:-/var/www/wework-saas}"
WEB="${WEB:-/var/www/wework}"
GIT="${GIT:-/var/www/wework-saas-git}"

need_mysql() {
  if [ -z "${MYSQL_PWD:-}" ]; then
    echo "请先执行: export MYSQL_PWD='你的MySQL root 密码'"
    exit 1
  fi
}

echo "=== 0. 解压后端热修包 ==="
if [ -f /root/syqw-backend-features.tgz ]; then
  tar xzf /root/syqw-backend-features.tgz -C "$RUN"
  echo "OK: backend → $RUN"
else
  echo "WARN: 无 /root/syqw-backend-features.tgz"
  echo "      请从 Mac 上传，或手动 scp 下列文件到 $RUN/backend/"
fi

echo ""
echo "=== 1. 付费墙 SQL 098（内联）==="
need_mysql
mysql -u root -p"$MYSQL_PWD" wework_saas <<'EOSQL'
SET NAMES utf8mb4;

UPDATE plans SET
  customers_limit = 30,
  seats_limit = 1,
  broadcasts_monthly = 50,
  ai_calls_monthly = 20,
  features = JSON_ARRAY('customer_manage','dashboard','channel_track','broadcast')
WHERE code = 'free';

UPDATE plans SET
  name = '专业版',
  price_monthly = 398.00,
  price_yearly = 3980.00,
  customers_limit = 5000,
  seats_limit = 20,
  broadcasts_monthly = 10000,
  ai_calls_monthly = 2000,
  features = JSON_ARRAY(
    'customer_manage','broadcast','channel_track','dashboard','automation','ai_full',
    'campaign','migration','intent_alert','audit_log',
    'ai_intent_score','ai_coach_daily','ads_roi','archive_analysis'
  ),
  sort_order = 20
WHERE code = 'pro';

INSERT INTO plans
  (name, code, price_monthly, price_yearly,
   customers_limit, seats_limit, broadcasts_monthly, ai_calls_monthly,
   features, sort_order, is_active)
VALUES
  ('增长版', 'growth', 998.00, 9980.00,
   20000, 50, 30000, 5000,
   JSON_ARRAY(
     'customer_manage','broadcast','channel_track','dashboard','automation','ai_full',
     'campaign','migration','intent_alert','audit_log',
     'ai_intent_score','ai_coach_daily','ads_roi','archive_analysis','ocean_lead','script_library'
   ),
   25, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  price_monthly = VALUES(price_monthly),
  price_yearly = VALUES(price_yearly),
  customers_limit = VALUES(customers_limit),
  seats_limit = VALUES(seats_limit),
  broadcasts_monthly = VALUES(broadcasts_monthly),
  ai_calls_monthly = VALUES(ai_calls_monthly),
  features = VALUES(features),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);
EOSQL
echo "OK: plans 已更新"
mysql -u root -p"$MYSQL_PWD" wework_saas -e "SELECT code,name,price_monthly,customers_limit,ai_calls_monthly FROM plans WHERE code IN ('free','pro','growth');"

echo ""
echo "=== 2. 检查关键后端文件 ==="
check_file() {
  if [ -f "$1" ]; then echo "  OK $1"; else echo "  MISSING $1"; fi
}
check_file "$RUN/backend/src/services/leaderboard.service.js"
check_file "$RUN/backend/src/constants/planFeatures.js"
check_file "$RUN/backend/src/middlewares/requirePlanFeature.js"
check_file "$RUN/backend/src/routes/analytics.routes.js"
grep -q 'quick-score' "$RUN/backend/src/routes/ai.routes.js" 2>/dev/null && echo "  OK ai quick-score route" || echo "  MISSING ai quick-score route"
grep -q 'leaderboard' "$RUN/backend/src/routes/analytics.routes.js" 2>/dev/null && echo "  OK analytics leaderboard route" || echo "  MISSING analytics leaderboard route"

echo ""
echo "=== 3. 前端（可选）==="
if [ -f /root/syqw-frontend-dist.tgz ]; then
  tar xzf /root/syqw-frontend-dist.tgz -C "$WEB"
  echo "OK: frontend → $WEB"
  grep -o 'index-[^"]*\.js' "$WEB/index.html" || true
else
  echo "跳过：无 /root/syqw-frontend-dist.tgz"
fi

echo ""
echo "=== 4. 重启 API ==="
pm2 restart syqw-api --update-env
sleep 4
curl -sS http://127.0.0.1:3010/health | head -c 200 || pm2 logs syqw-api --err --lines 20 --nostream

echo ""
echo "=== 5. 接口探测（无需 token）==="
# 401 = 路由存在且需登录；404 = 后端未部署新代码
code_lb=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/api/v1/analytics/leaderboard)
code_qs=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3010/api/v1/ai/quick-score -H 'Content-Type: application/json' -d '{"text":"test"}')
echo "  GET /analytics/leaderboard → HTTP $code_lb  (期望 401，若是 404 说明后端未更新)"
echo "  POST /ai/quick-score        → HTTP $code_qs  (期望 401)"

echo ""
echo "=== 6. 获取演示 token 自测（可选）==="
GUEST=$(curl -s -X POST http://127.0.0.1:3010/api/v1/auth/guest-login -H 'Content-Type: application/json' -d '{}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token',''))" 2>/dev/null || true)
if [ -n "$GUEST" ]; then
  echo "  guest token 前 20 字符: ${GUEST:0:20}..."
  curl -s -H "Authorization: Bearer $GUEST" http://127.0.0.1:3010/api/v1/analytics/leaderboard | head -c 400
  echo ""
else
  echo "  guest-login 未返回 token（可浏览器登录后在 DevTools → Application → token 复制）"
fi

echo ""
echo "完成。浏览器无痕打开 https://wework.syzs.top/app/leaderboard 与 /app/quick-score"
