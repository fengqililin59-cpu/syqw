#!/bin/bash
# 一键：修复支付宝配置 + 同步前端到 /var/www/wework（Workbench 整段粘贴执行）
set -euo pipefail
BACKEND="/var/www/wework-saas/backend"
ENV_FILE="$BACKEND/.env"
WEBROOT="/var/www/wework"
FRONTEND_DIST="/var/www/wework-saas/frontend/dist"
TARBALL="/var/www/wework-saas/frontend/frontend-dist-alipay-on.tar.gz"

cd "$BACKEND"

echo "========== A. 检查关键文件 =========="
for f in src/config/env.js src/services/alipay.service.js certs/alipay/app_private_key.pem certs/alipay/alipay_public_key.pem; do
  if [ ! -f "$f" ]; then echo "缺少: $f — 请从本机上传后再跑本脚本"; exit 1; fi
done
grep -q 'readPemFromEnvOrFile' src/config/env.js || {
  echo "ERROR: env.js 过旧，请上传本仓库 backend/src/config/env.js"
  exit 1
}
grep -q 'function loadPem' src/services/alipay.service.js || {
  echo "ERROR: 请上传含 loadPem 的 backend/src/services/alipay.service.js"
  exit 1
}

echo "========== B. PEM 能否被 Node 解析 =========="
node --input-type=module -e "
import fs from 'fs';
import crypto from 'crypto';
const priv = fs.readFileSync('certs/alipay/app_private_key.pem','utf8');
const pub = fs.readFileSync('certs/alipay/alipay_public_key.pem','utf8');
try { crypto.createPrivateKey(priv); console.log('私钥文件: OK'); }
catch (e) { console.error('私钥文件失败:', e.message); process.exit(1); }
try { crypto.createPublicKey(pub); console.log('公钥文件: OK'); }
catch (e) { console.error('公钥文件失败:', e.message); process.exit(1); }
"

echo "========== C. 写入 .env（只用文件路径，删掉内联 PEM）=========="
touch "$ENV_FILE"
sed -i '/^ALIPAY_PRIVATE_KEY=-----BEGIN/d' "$ENV_FILE"
sed -i '/^ALIPAY_PUBLIC_KEY=-----BEGIN/d' "$ENV_FILE"
set_kv() { k="$1"; v="$2"; grep -q "^${k}=" "$ENV_FILE" && sed -i "s|^${k}=.*|${k}=${v}|" "$ENV_FILE" || echo "${k}=${v}" >> "$ENV_FILE"; }
set_kv ALIPAY_DISABLED 0
set_kv ALIPAY_MOCK 0
set_kv ALIPAY_APP_ID 2021000106623328
set_kv ALIPAY_PRIVATE_KEY_PATH certs/alipay/app_private_key.pem
set_kv ALIPAY_PUBLIC_KEY_PATH certs/alipay/alipay_public_key.pem
set_kv BILLING_NOTIFY_BASE_URL https://wework.syzs.top
# 清空内联变量（避免优先读坏数据）
set_kv ALIPAY_PRIVATE_KEY ""
set_kv ALIPAY_PUBLIC_KEY ""

echo "========== D. 去掉临时「暂未开放」硬拦截 =========="
python3 << 'PY'
from pathlib import Path
p = Path("/var/www/wework-saas/backend/src/controllers/billing.controller.js")
t = p.read_text(encoding="utf-8")
old = "  if (pay_channel === 'alipay') {\n    throw new HttpError(503, '支付宝支付暂未开放，请使用微信或线下转账', 503);\n"
if old in t:
    t = t.replace(old, "  if (pay_channel === 'alipay') {\n", 1)
    p.write_text(t, encoding="utf-8")
    print("已移除 python 临时 throw")
PY

echo "========== E. 重启 API =========="
pm2 delete syqw-api 2>/dev/null || true
pm2 start "$BACKEND/src/app.js" --name syqw-api -i 2 --cwd "$BACKEND" --update-env
pm2 save
sleep 2

node --input-type=module -e "
import { env } from './src/config/env.js';
import * as alipay from './src/services/alipay.service.js';
console.log('disabled', env.alipay.disabled);
console.log('APP_ID', env.alipay.appId);
console.log('notifyBaseUrl', env.alipay.notifyBaseUrl);
console.log('privateKey len', env.alipay.privateKey.length);
console.log('publicKey len', env.alipay.publicKey.length);
console.log('isAlipayConfigured', alipay.isAlipayConfigured());
if (!alipay.isAlipayConfigured()) process.exit(2);
"

echo "========== F. 同步前端到 Nginx root =========="
if [ -f "$TARBALL" ]; then
  mkdir -p "$FRONTEND_DIST"
  tar xzf "$TARBALL" -C "$FRONTEND_DIST" --strip-components=1 2>/dev/null || tar xzf "$TARBALL" -C /tmp/alipay-dist && rsync -a /tmp/alipay-dist/dist/ "$FRONTEND_DIST/"
fi
if [ ! -f "$FRONTEND_DIST/index.html" ]; then
  echo "WARN: 无 $FRONTEND_DIST — 请上传 frontend-dist-alipay-on.tar.gz"
else
  find "$FRONTEND_DIST" -name '._*' -delete
  rsync -a --delete "$FRONTEND_DIST/" "$WEBROOT/"
fi

JS_LOCAL=$(grep -o 'index-[^"]*\.js' "$WEBROOT/index.html" | head -1)
JS_CURL=$(curl -sS https://wework.syzs.top/ | grep -o 'index-[^"]*\.js' | head -1)
echo "磁盘 index.html -> $JS_LOCAL"
echo "HTTPS 首页     -> $JS_CURL"
if [ "$JS_LOCAL" != "$JS_CURL" ]; then
  echo "WARN: 磁盘与 HTTPS 不一致，检查 CDN/多机；本机已 rsync 到 $WEBROOT"
fi
ls -la "$WEBROOT/assets/index-"*.js 2>/dev/null | tail -3

echo ""
echo "完成。浏览器无痕打开 https://wework.syzs.top/app/billing 再试支付宝。"
