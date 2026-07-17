#!/bin/bash
# 查浏览器为何仍加载旧前端 / 支付宝按钮仍在
set -euo pipefail
echo "=== Nginx wework.syzs.top 与 root ==="
nginx -T 2>/dev/null | grep -B2 -A5 'server_name wework.syzs.top' | grep -E 'listen|server_name|root |proxy_pass' || true
echo ""
for dir in /var/www/wework /var/www/zhiflow/frontend/dist; do
  echo "=== $dir ==="
  if [ -f "$dir/index.html" ]; then
    echo "磁盘: $(grep -o 'index-[^"]*\.js' "$dir/index.html" | head -1)"
  else
    echo "无 index.html"
  fi
done
echo ""
echo "=== 本机 curl HTTPS 首页 JS ==="
JS_CURL=$(curl -sS https://wework.syzs.top/ 2>/dev/null | grep -o 'index-[^"]*\.js' | head -1 || true)
echo "${JS_CURL:-curl 失败}"
JS_W=$(grep -o 'index-[^"]*\.js' /var/www/wework/index.html 2>/dev/null | head -1 || true)
JS_Z=$(grep -o 'index-[^"]*\.js' /var/www/zhiflow/frontend/dist/index.html 2>/dev/null | head -1 || true)
if [ -n "$JS_CURL" ] && [ "$JS_CURL" = "$JS_Z" ] && [ "$JS_CURL" != "$JS_W" ]; then
  echo "!! HTTPS 与 /var/www/zhiflow/frontend/dist 一致，与 /var/www/wework 不同"
  echo "   修复: bash deploy/ecs_sync_frontend_to_wework.sh"
elif [ -n "$JS_CURL" ] && [ -n "$JS_W" ] && [ "$JS_CURL" != "$JS_W" ]; then
  echo "!! 磁盘与 HTTPS 不一致：检查 CDN/多机或 Nginx 另一 server 块"
fi
echo ""
echo "=== Nginx API proxy_pass (3002 vs 3010) ==="
grep -rn 'proxy_pass' /etc/nginx/ 2>/dev/null | grep -E '3002|3010|wework|zhiflow' | head -15 || true
echo ""
echo "=== 后端支付宝（syqw-api / wework-saas）==="
cd /var/www/wework-saas/backend
grep -q readPemFromEnvOrFile src/config/env.js 2>/dev/null && echo "env.js: 支持 PEM 路径" || echo "env.js: 过旧"
grep -q 'function loadPem' src/services/alipay.service.js 2>/dev/null && echo "alipay.service: 含 loadPem" || echo "alipay.service: 过旧"
node --input-type=module -e "
import { env } from './src/config/env.js';
import * as a from './src/services/alipay.service.js';
console.log('disabled', env.alipay.disabled);
console.log('appId', env.alipay.appId || '(空)');
console.log('privLen', env.alipay.privateKey.length);
console.log('isAlipayConfigured', a.isAlipayConfigured());
" 2>/dev/null || echo "node 检查失败"
