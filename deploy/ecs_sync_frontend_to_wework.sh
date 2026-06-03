#!/bin/bash
# 生产 Nginx root 是 /var/www/wework，不是 wework-saas/frontend/dist
# 每次更新前端后执行本脚本
set -euo pipefail
SRC="${1:-/var/www/wework-saas/frontend/dist}"
DST="${2:-/var/www/wework}"
rsync -a --delete "$SRC/" "$DST/"
find "$DST" -name '._*' -delete
echo "OK synced $SRC -> $DST"
grep -o 'index-[^"]*\.js' "$DST/index.html" || true
ls -la "$DST/assets/index-*.js" 2>/dev/null || ls -la "$DST/assets/"index-*.js
