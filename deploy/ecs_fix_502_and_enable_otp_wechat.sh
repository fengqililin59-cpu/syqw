#!/bin/bash
# 502 后恢复：同步完整 backend + 写入 .env（注册验证码 / 微信 MOCK）
set -euo pipefail
GIT=/var/www/wework-saas-git
RUN=/var/www/wework-saas/backend
ENV_FILE="$RUN/.env"

echo "=== 1. 同步 backend（含 registrationOtp 等）==="
rsync -av --exclude node_modules --exclude .env \
  "$GIT/backend/" "$RUN/"

echo ""
echo "=== 2. 检查关键文件 ==="
for f in src/services/registrationOtp.service.js src/controllers/auth.controller.js; do
  if [ -f "$RUN/$f" ]; then echo "OK $f"; else echo "缺失 $f"; exit 1; fi
done

echo ""
echo "=== 3. 写入 .env 开关（不覆盖整文件）==="
set_kv() {
  local k="$1" v="$2"
  if grep -q "^${k}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${k}=.*|${k}=${v}|" "$ENV_FILE"
  else
    echo "${k}=${v}" >> "$ENV_FILE"
  fi
}
set_kv REGISTER_OTP_REQUIRED 1
set_kv WECHAT_PAY_MOCK 1
grep -q '^BILLING_NOTIFY_BASE_URL=' "$ENV_FILE" || set_kv BILLING_NOTIFY_BASE_URL https://wework.syzs.top

echo ""
echo "=== 4. SMTP 是否已配置（未配置则 channels 为空）==="
grep -E '^SMTP_HOST=|^REGISTER_OTP_ALIYUN_KEY_ID=' "$ENV_FILE" | sed 's/=.*/=…/' || echo "!! 未配 SMTP/阿里云短信，注册页会提示未配置发信"

echo ""
echo "=== 5. 安装依赖并重启 ===="
cd "$RUN"
npm ci --omit=dev
node --check src/controllers/balance.controller.js
pm2 restart syqw-api --update-env
sleep 2

echo ""
echo "=== 6. 本机 health ==="
curl -sS http://127.0.0.1:3010/health; echo

echo ""
echo "=== 7. 注册 options ==="
curl -sS https://wework.syzs.top/api/v1/auth/register/options; echo

echo ""
echo "若仍 502: pm2 logs syqw-api --err --lines 40 --nostream"
