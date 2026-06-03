#!/bin/bash
# 查浏览器为何仍加载旧前端 / 支付宝按钮仍在
set -euo pipefail
echo "=== Nginx 443 与 root ==="
nginx -T 2>/dev/null | grep -A3 'server_name wework' | head -40 || true
echo ""
echo "=== /var/www/wework ==="
ls -la /var/www/wework/index.html 2>/dev/null || echo "无 index"
JS_LOCAL=$(grep -o 'index-[^"]*\.js' /var/www/wework/index.html 2>/dev/null | head -1 || true)
echo "磁盘: ${JS_LOCAL:-无}"
echo ""
echo "=== 本机 curl 首页 JS ==="
JS_CURL=$(curl -sS https://wework.syzs.top/ 2>/dev/null | grep -o 'index-[^"]*\.js' | head -1 || true)
echo "${JS_CURL:-curl 失败}"
if [ -n "${JS_LOCAL:-}" ] && [ -n "${JS_CURL:-}" ] && [ "$JS_LOCAL" != "$JS_CURL" ]; then
  echo "!! 磁盘 index 与 HTTPS 不一致：请 rsync dist 到 /var/www/wework 并排除 CDN 缓存"
fi
echo ""
echo "=== assets 是否存在 ==="
for j in "$JS_LOCAL" "$JS_CURL"; do
  [ -z "$j" ] && continue
  f="/var/www/wework/assets/$j"
  if [ -f "$f" ]; then echo "OK $f"; else echo "缺失 $f"; fi
done
echo ""
echo "=== 后端支付宝（详细）==="
cd /var/www/wework-saas/backend
grep -q readPemFromEnvOrFile src/config/env.js 2>/dev/null && echo "env.js: 支持 PEM 路径" || echo "env.js: 过旧，请上传新 env.js"
grep -q 'function loadPem' src/services/alipay.service.js 2>/dev/null && echo "alipay.service: 含 loadPem" || echo "alipay.service: 过旧"
grep -E '^ALIPAY_|^BILLING_NOTIFY' .env 2>/dev/null | sed 's/=.*/=…/' || echo "无 .env 支付宝项"
node --input-type=module -e "
import { env } from './src/config/env.js';
import * as a from './src/services/alipay.service.js';
console.log('disabled', env.alipay.disabled);
console.log('appId', env.alipay.appId || '(空)');
console.log('privLen', env.alipay.privateKey.length);
console.log('pubLen', env.alipay.publicKey.length);
console.log('notify', env.alipay.notifyBaseUrl || '(空)');
console.log('isAlipayConfigured', a.isAlipayConfigured());
"
