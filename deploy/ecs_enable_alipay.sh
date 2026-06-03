#!/bin/bash
# 恢复支付宝（ECS Workbench 执行）
# 前提：certs/alipay/*.pem 已存在，且 src/services/alipay.service.js 含 loadPem
set -euo pipefail
BACKEND="/var/www/wework-saas/backend"
ENV_FILE="$BACKEND/.env"
CTRL="$BACKEND/src/controllers/billing.controller.js"

cd "$BACKEND"

echo "==> 1. 检查 PEM 与 loadPem"
test -f certs/alipay/app_private_key.pem
test -f certs/alipay/alipay_public_key.pem
grep -q 'function loadPem' src/services/alipay.service.js || {
  echo "ERROR: 请上传含 loadPem 的 alipay.service.js"
  exit 1
}

node --input-type=module -e "
import fs from 'fs';
import crypto from 'crypto';
const priv = fs.readFileSync('certs/alipay/app_private_key.pem','utf8');
const pub = fs.readFileSync('certs/alipay/alipay_public_key.pem','utf8');
crypto.createPrivateKey(priv);
crypto.createPublicKey(pub);
console.log('PEM 解析: OK');
"

echo "==> 2. 配置 .env（优先 PEM 路径，去掉易损坏的内联密钥）"
grep -q '^ALIPAY_DISABLED=' "$ENV_FILE" && sed -i 's/^ALIPAY_DISABLED=.*/ALIPAY_DISABLED=0/' "$ENV_FILE" || echo 'ALIPAY_DISABLED=0' >> "$ENV_FILE"
grep -q '^ALIPAY_APP_ID=' "$ENV_FILE" && sed -i 's/^ALIPAY_APP_ID=.*/ALIPAY_APP_ID=2021000106623328/' "$ENV_FILE" || echo 'ALIPAY_APP_ID=2021000106623328' >> "$ENV_FILE"
grep -q '^ALIPAY_PRIVATE_KEY_PATH=' "$ENV_FILE" && sed -i 's|^ALIPAY_PRIVATE_KEY_PATH=.*|ALIPAY_PRIVATE_KEY_PATH=certs/alipay/app_private_key.pem|' "$ENV_FILE" || echo 'ALIPAY_PRIVATE_KEY_PATH=certs/alipay/app_private_key.pem' >> "$ENV_FILE"
grep -q '^ALIPAY_PUBLIC_KEY_PATH=' "$ENV_FILE" && sed -i 's|^ALIPAY_PUBLIC_KEY_PATH=.*|ALIPAY_PUBLIC_KEY_PATH=certs/alipay/alipay_public_key.pem|' "$ENV_FILE" || echo 'ALIPAY_PUBLIC_KEY_PATH=certs/alipay/alipay_public_key.pem' >> "$ENV_FILE"
grep -q '^BILLING_NOTIFY_BASE_URL=' "$ENV_FILE" || echo 'BILLING_NOTIFY_BASE_URL=https://wework.syzs.top' >> "$ENV_FILE"
sed -i 's/^ALIPAY_MOCK=.*/ALIPAY_MOCK=0/' "$ENV_FILE" 2>/dev/null || echo 'ALIPAY_MOCK=0' >> "$ENV_FILE"
# 删除内联密钥行（避免 DECODER）
sed -i '/^ALIPAY_PRIVATE_KEY=-----BEGIN/d' "$ENV_FILE"
sed -i '/^ALIPAY_PUBLIC_KEY=-----BEGIN/d' "$ENV_FILE"

echo "==> 3. 去掉临时「暂未开放」硬拦截（若曾 python patch）"
python3 << 'PY'
from pathlib import Path
p = Path("/var/www/wework-saas/backend/src/controllers/billing.controller.js")
t = p.read_text(encoding="utf-8")
old = "  if (pay_channel === 'alipay') {\n    throw new HttpError(503, '支付宝支付暂未开放，请使用微信或线下转账', 503);\n"
if old in t:
    t = t.replace(old, "  if (pay_channel === 'alipay') {\n", 1)
    p.write_text(t, encoding="utf-8")
    print("已移除临时 throw")
else:
    print("无需移除")
PY

echo "==> 4. 重启并验证"
pm2 delete syqw-api 2>/dev/null || true
pm2 start "$BACKEND/src/app.js" --name syqw-api -i 2 --cwd "$BACKEND" --update-env
pm2 save
sleep 2

node --input-type=module -e "
import { env } from './src/config/env.js';
import * as alipay from './src/services/alipay.service.js';
console.log('APP_ID', env.alipay.appId);
console.log('isAlipayConfigured', alipay.isAlipayConfigured());
console.log('privateKey len', env.alipay.privateKey.length);
"

echo ""
echo "==> 5. 前端须为「开启支付宝」的 dist，并同步到 Nginx root："
echo "   rsync -a --delete /var/www/wework-saas/frontend/dist/ /var/www/wework/"
echo ""
echo "若 verify-alipay 报 ACCESS_FORBIDDEN：开放平台签约「电脑网站支付」"
