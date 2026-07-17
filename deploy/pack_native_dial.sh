#!/bin/bash
# 打包「本机直接拨打」热修（Mac 本地 → 上传 ECS /root/）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$ROOT/deploy"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/backend/src/"{services,models}
mkdir -p "$TMP/database"
mkdir -p "$TMP/frontend/src/"{components,api,pages}

cp "$ROOT/backend/src/services/call.service.js" "$TMP/backend/src/services/"
cp "$ROOT/backend/src/models/callRecord.model.js" "$TMP/backend/src/models/"
cp "$ROOT/backend/src/models/userCallSetting.model.js" "$TMP/backend/src/models/"
cp "$ROOT/database/099_native_dial_mode.sql" "$TMP/database/"

cp "$ROOT/frontend/src/components/CallButton.tsx" "$TMP/frontend/src/components/"
cp "$ROOT/frontend/src/api/calls.ts" "$TMP/frontend/src/api/"
cp "$ROOT/frontend/src/pages/SettingsPage.tsx" "$TMP/frontend/src/pages/"
cp "$ROOT/frontend/src/pages/CallRecordsPage.tsx" "$TMP/frontend/src/pages/"

tar czf "$DEPLOY/syqw-native-dial-backend.tgz" -C "$TMP" backend database

echo "Backend+SQL: $DEPLOY/syqw-native-dial-backend.tgz ($(du -h "$DEPLOY/syqw-native-dial-backend.tgz" | cut -f1))"
echo "ECS script:  $DEPLOY/ecs_apply_native_dial_hotfix.sh"

if [ -d "$ROOT/frontend/dist" ]; then
  tar czf "$DEPLOY/syqw-native-dial-frontend.tgz" -C "$ROOT/frontend/dist" .
  echo "Frontend:    $DEPLOY/syqw-native-dial-frontend.tgz ($(du -h "$DEPLOY/syqw-native-dial-frontend.tgz" | cut -f1))"
else
  echo "Frontend:    跳过（先 cd frontend && npm run build）"
fi

echo ""
echo "上传 syqw-native-dial-backend.tgz 与 ecs_apply_native_dial_hotfix.sh 到 ECS /root/ 后执行："
echo "  bash /root/ecs_apply_native_dial_hotfix.sh"
