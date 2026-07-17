#!/bin/bash
# Mac 本地打包 P0+P1+P2 热修，上传到 ECS /root/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="/tmp/syqw-backend-features.tgz"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/backend/src/"{constants,middlewares,services,controllers,routes}

cp "$ROOT/backend/src/services/aiContent.service.js" "$TMP/backend/src/services/"
cp "$ROOT/backend/src/services/billing.service.js" "$TMP/backend/src/services/"
cp "$ROOT/backend/src/services/onboardingChecklist.service.js" "$TMP/backend/src/services/"
cp "$ROOT/backend/src/services/leaderboard.service.js" "$TMP/backend/src/services/"
cp "$ROOT/backend/src/services/weeklyDigest.service.js" "$TMP/backend/src/services/"

cp "$ROOT/backend/src/controllers/aiContent.controller.js" "$TMP/backend/src/controllers/"
cp "$ROOT/backend/src/controllers/analytics.controller.js" "$TMP/backend/src/controllers/"

cp "$ROOT/backend/src/constants/planFeatures.js" "$TMP/backend/src/constants/"
cp "$ROOT/backend/src/middlewares/requirePlanFeature.js" "$TMP/backend/src/middlewares/"

cp "$ROOT/backend/src/routes/ai.routes.js" "$TMP/backend/src/routes/"
cp "$ROOT/backend/src/routes/customer.routes.js" "$TMP/backend/src/routes/"
cp "$ROOT/backend/src/routes/coaching.routes.js" "$TMP/backend/src/routes/"
cp "$ROOT/backend/src/routes/ad.routes.js" "$TMP/backend/src/routes/"
cp "$ROOT/backend/src/routes/analytics.routes.js" "$TMP/backend/src/routes/"

tar czf "$OUT" -C "$TMP" backend
cp "$ROOT/deploy/ecs_hotfix_p0_p1_p2.sh" /tmp/ecs_hotfix_p0_p1_p2.sh

echo "Backend: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Script:  /tmp/ecs_hotfix_p0_p1_p2.sh"
echo ""
echo "Frontend（若已 build）:"
if [ -d "$ROOT/frontend/dist" ]; then
  tar czf /tmp/syqw-frontend-dist.tgz -C "$ROOT/frontend/dist" .
  echo "  /tmp/syqw-frontend-dist.tgz"
else
  echo "  先 cd frontend && npm run build"
fi
echo ""
echo "Workbench 上传到 /root/ 后 ECS 执行:"
echo "  export MYSQL_PWD='...'"
echo "  bash /root/ecs_hotfix_p0_p1_p2.sh"
