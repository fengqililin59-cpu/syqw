#!/bin/bash
# 同步前端到 Nginx 实际 root（可能有多处，见 ecs_diagnose_wework_site.sh）
set -euo pipefail
SRC="${1:-/var/www/wework-saas-git/frontend/dist}"
if [ ! -f "$SRC/index.html" ]; then
  SRC="${SRC%-git/*}/frontend/dist"
fi
if [ ! -f "$SRC/index.html" ]; then
  echo "ERROR: 找不到 dist/index.html，请先 npm run build"
  exit 1
fi

sync_one() {
  local dst="$1"
  rsync -a --delete "$SRC/" "$dst/"
  find "$dst" -name '._*' -delete
  echo "OK synced -> $dst ($(grep -o 'index-[^"]*\.js' "$dst/index.html" | head -1))"
}

# HTTPS 443 实际 root（/etc/nginx/conf.d/wework.syzs.top.conf）
sync_one /var/www/zhiflow/frontend/dist

# HTTP 80 fallback root（/etc/nginx/sites-enabled/wework）
sync_one "${2:-/var/www/wework}"

JS_CURL=$(curl -sS https://wework.syzs.top/ 2>/dev/null | grep -o 'index-[^"]*\.js' | head -1 || true)
echo "HTTPS 首页 -> ${JS_CURL:-curl 失败}"
