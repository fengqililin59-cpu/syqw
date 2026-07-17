#!/bin/bash
# 诊断一键外呼：Mock 模式、TCCC 配置、个人手机号、最近通话记录
# ECS Workbench: bash /root/ecs_diagnose_outbound_call.sh
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
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" "$@"
}

echo "=== 1. 环境变量 TCCC ==="
grep -E '^TCCC_' "$ENV_FILE" 2>/dev/null || echo "(无 TCCC_ 变量)"
if grep -q '^TCCC_MOCK=1' "$ENV_FILE" 2>/dev/null; then
  echo "⚠️  TCCC_MOCK=1 → 所有外呼均为模拟，不会真实拨号"
fi

echo ""
echo "=== 2. 租户 TCCC 配置（脱敏）==="
mysql_run -N -e "
SELECT id, name,
  IF(tccc_sdk_app_id IS NULL OR tccc_sdk_app_id='', '空', '已填') AS sdk_app,
  IF(tccc_secret_id IS NULL OR tccc_secret_id='', '空', '已填') AS secret_id,
  IF(tccc_secret_key IS NULL OR tccc_secret_key='', '空', '已填') AS secret_key,
  IF(tccc_server_number IS NULL OR tccc_server_number='', '空', '已填') AS server_no
FROM tenants LIMIT 5;
" 2>/dev/null || echo "查询 tenants 失败（可能缺 TCCC 列，先运行 ecs_fix_call_schema.sh）"

echo ""
echo "=== 3. 用户外呼设置（个人手机号）==="
mysql_run -e "
SELECT u.id, u.username, u.real_name,
  ucs.dial_mode, ucs.phone_number, ucs.is_available
FROM users u
LEFT JOIN user_call_settings ucs ON ucs.user_id = u.id
ORDER BY u.id LIMIT 10;
" 2>/dev/null || echo "user_call_settings 表不存在"

echo ""
echo "=== 4. 最近 5 条通话记录 ==="
mysql_run -e "
SELECT id, customer_id, caller_user_id, status, dial_mode,
  LEFT(tccc_session_id, 24) AS session_prefix,
  LEFT(failure_reason, 60) AS fail_reason, created_at
FROM call_records ORDER BY id DESC LIMIT 5;
" 2>/dev/null || echo "call_records 表不存在"

echo ""
echo "=== 5. PM2 最近 TCCC 日志 ==="
pm2 logs syqw-api --lines 30 --nostream 2>/dev/null | grep -i tccc || echo "(无 TCCC 相关日志)"

echo ""
echo "=== 修复步骤 ==="
echo "1. 腾讯云控制台开通「云联络中心 TCCC」，获取 SdkAppId、SecretId、SecretKey、外呼号码"
echo "2. 后台「设置 → 云服务配置」填写上述四项"
echo "3. 「设置 → 个人设置 → 我的外呼设置」：拨号方式=手机，填写您接听的手机号"
echo "4. 编辑 $ENV_FILE：TCCC_MOCK=0"
echo "5. pm2 restart syqw-api --update-env"
echo "6. TCCC 回调 URL: https://wework.syzs.top/api/v1/callback/tccc"
