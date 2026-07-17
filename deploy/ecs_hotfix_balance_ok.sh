#!/bin/bash
# 修复 balance.controller.js 未使用 ok() 导致前端余额「加载中…」
set -euo pipefail
TARGET="/var/www/wework-saas/backend/src/controllers/balance.controller.js"
SRC="/var/www/wework-saas-git/backend/src/controllers/balance.controller.js"

if [ -f "$SRC" ] && grep -q 'return ok(res' "$SRC" 2>/dev/null; then
  cp "$SRC" "$TARGET"
  echo "已从 git 目录复制: $SRC"
elif grep -q 'return ok(res' "$TARGET" 2>/dev/null; then
  echo "已包含 ok()，无需修复"
else
  echo "ERROR: $TARGET 无 ok()，且 $SRC 不可用。"
  echo "请 git pull 或从本机上传 balance.controller.js 到 $TARGET"
  exit 1
fi

grep -n 'return ok(res' "$TARGET" | head -3
pm2 restart syqw-api --update-env
echo "完成。浏览器退出无痕重新登录后再打开 /app/billing"
