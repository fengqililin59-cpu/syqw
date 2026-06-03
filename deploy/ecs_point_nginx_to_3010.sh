#!/bin/bash
# 将 wework 站点 API 统一指向 syqw-api:3010（先备份配置）
set -euo pipefail
mapfile -t CONFS < <(grep -rl 'wework.syzs.top\|proxy_pass.*3002\|proxy_pass.*3010' /etc/nginx 2>/dev/null | sort -u)
if [ "${#CONFS[@]}" -eq 0 ]; then
  echo "找不到 nginx 配置"
  exit 1
fi
for CONF in "${CONFS[@]}"; do
  echo "修补: $CONF"
  cp -a "$CONF" "${CONF}.bak.$(date +%Y%m%d%H%M%S)"
  sed -i 's|proxy_pass http://127.0.0.1:3002|proxy_pass http://127.0.0.1:3010|g' "$CONF"
  sed -i 's|proxy_pass http://127.0.0.1:3000|proxy_pass http://127.0.0.1:3010|g' "$CONF"
  grep -E 'proxy_pass|server_name' "$CONF" | head -6 || true
done
nginx -t && nginx -s reload
echo "已 reload；验证: curl -sk https://wework.syzs.top/health"
