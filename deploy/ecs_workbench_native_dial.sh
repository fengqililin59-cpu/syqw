#!/bin/bash
# ECS Workbench 一键部署「本机直接拨打」
# 用法（二选一）：
#   A) 上传 /root/native-dial-src.tgz（约 23KB，含源码）后执行本脚本
#   B) 上传 /root/syqw-native-dial-backend.tgz + syqw-native-dial-frontend.tgz 后执行
set -euo pipefail

RUN="${RUN:-/var/www/wework-saas}"
GIT="${GIT:-/var/www/wework-saas-git}"
WEB="${WEB:-/var/www/wework}"
ENV_FILE="${ENV_FILE:-$RUN/backend/.env}"

DB_HOST=$(grep -m1 '^DB_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PORT=$(grep -m1 '^DB_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_NAME=$(grep -m1 '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_USER=$(grep -m1 '^DB_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' "$ENV_FILE" | sed 's/^DB_PASSWORD=//' | tr -d '\r')
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}

mysql_run() {
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" "$@"
}

echo "========== 1. 解压源码 =========="
if [ -f /root/native-dial-src.tgz ]; then
  TMP=$(mktemp -d)
  tar xzf /root/native-dial-src.tgz -C "$TMP"
  cp "$TMP/backend/src/services/call.service.js" "$RUN/backend/src/services/"
  cp "$TMP/backend/src/models/callRecord.model.js" "$RUN/backend/src/models/"
  cp "$TMP/backend/src/models/userCallSetting.model.js" "$RUN/backend/src/models/"
  mkdir -p "$GIT/frontend/src/"{components,api,pages}
  cp "$TMP/frontend/src/components/CallButton.tsx" "$GIT/frontend/src/components/"
  cp "$TMP/frontend/src/api/calls.ts" "$GIT/frontend/src/api/"
  cp "$TMP/frontend/src/pages/SettingsPage.tsx" "$GIT/frontend/src/pages/"
  cp "$TMP/frontend/src/pages/CallRecordsPage.tsx" "$GIT/frontend/src/pages/"
  cp "$TMP/database/099_native_dial_mode.sql" "$RUN/database/" 2>/dev/null || mkdir -p "$RUN/database" && cp "$TMP/database/099_native_dial_mode.sql" "$RUN/database/"
  rm -rf "$TMP"
  echo "已从 native-dial-src.tgz 同步源码"
elif [ -f /root/syqw-native-dial-backend.tgz ]; then
  tar xzf /root/syqw-native-dial-backend.tgz -C "$RUN"
  echo "已解压 syqw-native-dial-backend.tgz"
else
  echo "ERROR: 请上传以下任一文件到 /root/："
  echo "  - native-dial-src.tgz （推荐，约 23KB）"
  echo "  - syqw-native-dial-backend.tgz"
  exit 1
fi

if ! grep -q "dialMode === 'native'" "$RUN/backend/src/services/call.service.js"; then
  echo "ERROR: call.service.js 仍无 native 逻辑"
  exit 1
fi
echo "后端 native 逻辑: OK"

echo ""
echo "========== 2. 数据库 =========="
if [ -f "$RUN/database/099_native_dial_mode.sql" ]; then
  mysql_run < "$RUN/database/099_native_dial_mode.sql" || echo "[WARN] SQL 可能已执行"
fi
mysql_run -e "
UPDATE user_call_settings SET dial_mode='native' WHERE user_id=10000;
INSERT INTO user_call_settings (user_id, tenant_id, dial_mode, is_available)
SELECT id, tenant_id, 'native', 1 FROM users WHERE id=10000
  AND NOT EXISTS (SELECT 1 FROM user_call_settings WHERE user_id=10000);
SELECT user_id, dial_mode FROM user_call_settings WHERE user_id=10000;
" 2>/dev/null || mysql_run -e "
UPDATE user_call_settings SET dial_mode='native' WHERE user_id=10000;
SELECT user_id, dial_mode FROM user_call_settings WHERE user_id=10000;
"

echo ""
echo "========== 3. 前端 =========="
if [ -f /root/syqw-native-dial-frontend.tgz ]; then
  tar xzf /root/syqw-native-dial-frontend.tgz -C "$WEB"
  echo "已部署预构建前端 → $WEB"
else
  echo "在 $GIT/frontend 构建…"
  cd "$GIT/frontend"
  if [ ! -d node_modules ]; then
    npm install --prefer-offline --no-audit --no-fund
  fi
  npm run build
  rm -rf "$WEB"/*
  cp -r dist/* "$WEB/"
  echo "已构建并部署前端"
fi
grep -o 'index-[^"]*\.js' "$WEB/index.html" || true

echo ""
echo "========== 4. 重启 API =========="
pm2 restart syqw-api --update-env
sleep 3
curl -sS http://127.0.0.1:3010/health && echo ""

echo ""
echo "========== 完成 =========="
echo "1. 浏览器 Ctrl+Shift+R 强制刷新（或无痕窗口）"
echo "2. 用手机打开客户页点「一键外呼」→ 应弹出拨号盘"
echo "3. 验证: mysql ... -e \"SELECT id,dial_mode,status FROM call_records ORDER BY id DESC LIMIT 1;\""
