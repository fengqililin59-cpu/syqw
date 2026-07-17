#!/bin/bash
# 生产 tenants 缺 tccc_* / sms_* 列时执行（修复 Unknown column 'tccc_sdk_app_id'）
set -euo pipefail
GIT="${GIT_ROOT:-/var/www/wework-saas-git}"
DB="${MYSQL_DB:-wework_saas}"

for f in database/047_call_records.sql database/049_sms.sql; do
  if [[ ! -f "$GIT/$f" ]]; then
    echo "缺少 $GIT/$f，请先 git pull"
    exit 1
  fi
  echo "=== $f ==="
  mysql "$DB" < "$GIT/$f"
done

echo "=== 校验 tenants 列 ==="
mysql "$DB" -e "
SELECT column_name FROM information_schema.columns
WHERE table_schema='$DB' AND table_name='tenants'
  AND column_name IN (
    'tccc_sdk_app_id','tccc_secret_id','tccc_secret_key','tccc_server_number',
    'sms_access_key_id','sms_access_key_secret','sms_default_sign'
  );"

echo "完成。请: pm2 restart syqw-api --update-env && sleep 5 && curl -sS http://127.0.0.1:3010/health"
