#!/bin/bash
# 公网仍 DECODER/500 时：多半是 Nginx 指向 zhiflow-api:3002，而只修了 syqw-api:3010
set -euo pipefail

echo "========== 1. 谁在监听 =========="
ss -tlnp | grep -E ':3002|:3010' || true

echo ""
echo "========== 2. Nginx proxy_pass =========="
grep -rn 'proxy_pass' /etc/nginx/ 2>/dev/null | grep -E '3002|3010|wework|zhiflow' || true

echo ""
echo "========== 3. 本机 health =========="
for p in 3002 3010; do
  code=$(curl -sS -o /tmp/h.json -w '%{http_code}' "http://127.0.0.1:${p}/health" 2>/dev/null || echo "000")
  svc=$(grep -o '"service":"[^"]*"' /tmp/h.json 2>/dev/null || true)
  echo "port ${p} -> HTTP ${code} ${svc}"
done

echo ""
echo "========== 4. 各后端 isAlipayConfigured =========="
for dir in /var/www/wework-saas/backend /var/www/zhiflow/backend; do
  if [ -f "$dir/src/services/alipay.service.js" ]; then
    echo "--- $dir ---"
    (cd "$dir" && node --input-type=module -e "
import { env } from './src/config/env.js';
import * as a from './src/services/alipay.service.js';
console.log('privLen', (env.alipay.privateKey||'').length);
console.log('isAlipayConfigured', a.isAlipayConfigured());
" 2>&1) || echo "node 检查失败"
  fi
done

echo ""
echo "========== 5. 公网 API 实际落到哪（对比 service 字段）=========="
curl -sk https://wework.syzs.top/health 2>/dev/null | head -c 200 || true
echo ""
