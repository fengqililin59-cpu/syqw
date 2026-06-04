#!/bin/bash
# 生产注册仅保留手机号（短信验证码）
set -euo pipefail
ENV="${ENV_FILE:-/var/www/wework-saas/backend/.env}"

# 删除 SMTP，避免 API 返回 email 渠道
sed -i '/^SMTP_/d' "$ENV"

grep -q '^REGISTER_OTP_REQUIRED=' "$ENV" || echo 'REGISTER_OTP_REQUIRED=1' >> "$ENV"
sed -i 's/^REGISTER_OTP_REQUIRED=.*/REGISTER_OTP_REQUIRED=1/' "$ENV"

grep -q '^REGISTER_OTP_SMS_ONLY=' "$ENV" || echo 'REGISTER_OTP_SMS_ONLY=1' >> "$ENV"
sed -i 's/^REGISTER_OTP_SMS_ONLY=.*/REGISTER_OTP_SMS_ONLY=1/' "$ENV"

grep -q '^NODE_ENV=' "$ENV" || echo 'NODE_ENV=production' >> "$ENV"
sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "$ENV"

pm2 restart syqw-api --update-env
sleep 5
curl -sS https://wework.syzs.top/api/v1/auth/register/options
echo
