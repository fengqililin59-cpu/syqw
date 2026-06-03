#!/bin/bash
# 生产暂时关闭支付宝（无需删密钥文件，恢复时设 ALIPAY_DISABLED=0 并 restart）
set -euo pipefail
ENV_FILE="${1:-/var/www/wework-saas/backend/.env}"
BACKEND="${2:-/var/www/wework-saas/backend}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: 找不到 $ENV_FILE"
  exit 1
fi

# 写入 ALIPAY_DISABLED=1
if grep -q '^ALIPAY_DISABLED=' "$ENV_FILE"; then
  sed -i 's/^ALIPAY_DISABLED=.*/ALIPAY_DISABLED=1/' "$ENV_FILE"
else
  echo '' >> "$ENV_FILE"
  echo '# 暂时关闭支付宝（deploy/ecs_disable_alipay.sh）' >> "$ENV_FILE"
  echo 'ALIPAY_DISABLED=1' >> "$ENV_FILE"
fi

# 双保险：清空 AppID，避免旧代码仍认为已配置
if grep -q '^ALIPAY_APP_ID=' "$ENV_FILE"; then
  sed -i 's/^ALIPAY_APP_ID=.*/ALIPAY_APP_ID=/' "$ENV_FILE"
fi

# 若已部署含 disabled 判断的 env.js / alipay.service.js，以下可选
if grep -q 'alipay.disabled' "$BACKEND/src/config/env.js" 2>/dev/null; then
  echo "OK 后端代码支持 ALIPAY_DISABLED"
else
  echo "WARN: 请上传最新 backend/src/config/env.js 与 alipay.service.js，否则仅清空 APP_ID 生效"
fi

cd "$BACKEND"
pm2 restart syqw-api --update-env 2>/dev/null || true

echo ""
echo "完成。验证："
echo "  curl -sS http://127.0.0.1:3010/api/v1/billing/payment/channels"
echo "  应看到 \"alipay\":{\"enabled\":false,...}"
echo ""
echo "恢复支付宝："
echo "  sed -i 's/^ALIPAY_DISABLED=.*/ALIPAY_DISABLED=0/' $ENV_FILE"
echo "  # 恢复 ALIPAY_APP_ID=2021000106623328 后 pm2 restart syqw-api --update-env"
