#!/bin/bash
# 修复：HTTPS 走 3002(zhiflow) 导致 DECODER；并清理 sites-enabled 里误放的 .bak 导致 nginx -t 失败
set -euo pipefail

echo "==> 1. 删除 sites-enabled 下的备份（会导致 duplicate default server）"
rm -f /etc/nginx/sites-enabled/*.bak.* 2>/dev/null || true
ls -la /etc/nginx/sites-enabled/

echo ""
echo "==> 2. 仅修改生效的 HTTPS 配置 wework-https.conf"
HTTPS_CONF="/etc/nginx/conf.d/wework-https.conf"
if [ ! -f "$HTTPS_CONF" ]; then
  echo "找不到 $HTTPS_CONF"
  exit 1
fi
cp -a "$HTTPS_CONF" "${HTTPS_CONF}.bak.$(date +%Y%m%d%H%M%S)"
sed -i 's|proxy_pass http://127.0.0.1:3002|proxy_pass http://127.0.0.1:3010|g' "$HTTPS_CONF"
sed -i 's|proxy_pass http://127.0.0.1:3000|proxy_pass http://127.0.0.1:3010|g' "$HTTPS_CONF"
grep -n 'proxy_pass' "$HTTPS_CONF"

echo ""
echo "==> 3. 测试并重载 nginx"
nginx -t
nginx -s reload

echo ""
echo "==> 4. 验证（公网应仍 ok；API 经 HTTPS 应打到 3010）"
curl -sk https://wework.syzs.top/health; echo
echo "若浏览器仍异常，请无痕重试 /app/billing"
