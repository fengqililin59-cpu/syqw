#!/bin/bash
# 检查：微信支付通道 / 注册验证码是否已配置
set -euo pipefail
ENV_FILE="${ENV_FILE:-/var/www/wework-saas/backend/.env}"
echo "=== .env 关键项（脱敏）==="
grep -E '^REGISTER_OTP_REQUIRED=|^WECHAT_PAY_MOCK=|^WECHAT_PAY_MCH_ID=|^SMTP_HOST=|^REGISTER_OTP_ALIYUN' "$ENV_FILE" 2>/dev/null | sed 's/=.*/=…/' || echo "无相关项"

echo ""
echo "=== 注册 options（公网）==="
curl -sS https://wework.syzs.top/api/v1/auth/register/options
echo ""

echo ""
echo "=== 支付 channels（需登录 token，无 token 会 401）==="
echo "curl -sS -H 'Authorization: Bearer TOKEN' https://wework.syzs.top/api/v1/billing/payment/channels"

echo ""
echo "=== 本机 channels 诊断（Node）==="
cd /var/www/wework-saas/backend
node --input-type=module -e "
import { env } from './src/config/env.js';
import * as w from './src/services/wechatPay.service.js';
import * as r from './src/services/registrationOtp.service.js';
console.log('wechatPay.mock', env.wechatPay.mock);
console.log('isWechatPayConfigured', w.isWechatPayConfigured());
console.log('registerOtp.required', env.registerOtp.required);
console.log('registerOtp.channels', r.getRegisterOtpChannels());
"
