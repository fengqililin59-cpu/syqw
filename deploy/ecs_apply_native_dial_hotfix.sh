#!/bin/bash
# ECS 一键部署「本机直接拨打」
# 前置：上传 /root/syqw-native-dial-backend.tgz 与（可选）/root/syqw-native-dial-frontend.tgz
set -euo pipefail

RUN="${RUN:-/var/www/wework-saas}"
WEB="${WEB:-/var/www/wework}"
ENV_FILE="${ENV_FILE:-$RUN/backend/.env}"

echo "=== 1. 解压后端 ==="
if [ ! -f /root/syqw-native-dial-backend.tgz ]; then
  echo "缺少 /root/syqw-native-dial-backend.tgz"
  exit 1
fi
tar xzf /root/syqw-native-dial-backend.tgz -C "$RUN"

echo "=== 2. 数据库（native 枚举，可重复执行）==="
DB_HOST=$(grep -m1 '^DB_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PORT=$(grep -m1 '^DB_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_NAME=$(grep -m1 '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_USER=$(grep -m1 '^DB_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' "$ENV_FILE" | sed 's/^DB_PASSWORD=//' | tr -d '\r')
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}

mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$RUN/database/099_native_dial_mode.sql" \
  || echo "[WARN] SQL 可能已执行过"

echo "=== 3. 验证后端代码 ==="
if grep -q "dialMode === 'native'" "$RUN/backend/src/services/call.service.js"; then
  echo "call.service.js native 逻辑: OK"
else
  echo "ERROR: call.service.js 仍是旧版"
  exit 1
fi

echo "=== 4. 前端（可选）==="
if [ -f /root/syqw-native-dial-frontend.tgz ]; then
  tar xzf /root/syqw-native-dial-frontend.tgz -C "$WEB"
  echo "前端 dist 已更新 → $WEB"
  grep -o 'index-[^"]*\.js' "$WEB/index.html" || true
else
  echo "跳过：无 /root/syqw-native-dial-frontend.tgz（可在 git 仓库 frontend 里 npm run build 后上传）"
fi

echo "=== 5. 重启 API ==="
pm2 restart syqw-api --update-env
sleep 3
curl -sS http://127.0.0.1:3010/health && echo ""

echo ""
echo "=== 6. 将当前用户改为本机拨打（演示租户 9999 / 用户 10000）==="
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
INSERT INTO user_call_settings (user_id, tenant_id, dial_mode, phone_number, is_available)
SELECT id, tenant_id, 'native', NULL, 1 FROM users WHERE id=10000 LIMIT 1
ON DUPLICATE KEY UPDATE dial_mode='native';
SELECT user_id, dial_mode FROM user_call_settings WHERE user_id=10000;
" 2>/dev/null || echo "请手动在 设置→个人设置 选择「本机直接拨打」"

echo ""
echo "完成。手机打开客户页点电话按钮，应直接弹出拨号盘。"
