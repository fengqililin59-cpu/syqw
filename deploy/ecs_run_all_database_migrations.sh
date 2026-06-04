#!/usr/bin/env bash
# 按编号顺序执行 database/*.sql（CREATE IF NOT EXISTS 为主，已存在列可能报 WARN）
# 推广前建议在 ECS 跑一遍，避免「本地有表、线上缺表」
set -euo pipefail

GIT="${GIT:-/var/www/wework-saas-git}"
ENV="${ENV:-/var/www/wework-saas/backend/.env}"
DB_HOST=$(grep -m1 '^DB_HOST=' "$ENV" | cut -d= -f2- | tr -d '\r"')
DB_PORT=$(grep -m1 '^DB_PORT=' "$ENV" | cut -d= -f2- | tr -d '\r"')
DB_NAME=$(grep -m1 '^DB_NAME=' "$ENV" | cut -d= -f2-)
DB_USER=$(grep -m1 '^DB_USER=' "$ENV" | cut -d= -f2-)
DB_PASS=$(grep '^DB_PASSWORD=' "$ENV" | cut -d= -f2-)
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}

shopt -s nullglob
files=("$GIT/database"/[0-9]*.sql)
IFS=$'\n' files=($(printf '%s\n' "${files[@]}" | sort -V))
unset IFS

echo "数据库: $DB_NAME @ $DB_HOST — 共 ${#files[@]} 个迁移文件"
for f in "${files[@]}"; do
  echo ">>> $(basename "$f")"
  if ! mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$f" 2>/tmp/mig_err.txt; then
    tail -3 /tmp/mig_err.txt | sed 's/^/  /'
    echo "  [WARN] 继续…"
  fi
done

pm2 restart syqw-api --update-env 2>/dev/null || true
echo "全部执行完毕。建议: curl -fsS https://wework.syzs.top/health?deep=1"
