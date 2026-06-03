#!/bin/bash
# 修复注册：PROCEDURE create_default_roles_for_tenant does not exist
set -euo pipefail
ROOT="${ROOT:-/var/www/wework-saas}"
cd "$ROOT/backend"
ENV_FILE="${ENV_FILE:-.env}"

get_env() {
  grep -m1 "^${1}=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//'
}

DB_HOST=$(get_env DB_HOST); DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=$(get_env DB_PORT); DB_PORT=${DB_PORT:-3306}
DB_NAME=$(get_env DB_NAME); DB_NAME=${DB_NAME:-wework_saas}
DB_USER=$(get_env DB_USER); DB_USER=${DB_USER:-root}
DB_PASSWORD=$(get_env DB_PASSWORD)

SQL036="$ROOT/database/036_rbac_permissions.sql"
SQL037="$ROOT/database/037_rbac_seed_roles.sql"

for f in "$SQL036" "$SQL037"; do
  if [ ! -f "$f" ]; then
    echo "缺少 $f — 请从本机上传 database/ 目录到 $ROOT/database/"
    exit 1
  fi
done

mysql() {
  command mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$@"
}

echo "==> 检查 roles 表"
mysql "$DB_NAME" -N -e "SHOW TABLES LIKE 'roles';" | grep -q roles || {
  echo "roles 表不存在，先执行 036..."
  mysql "$DB_NAME" < "$SQL036"
}

echo "==> 安装存储过程 (037)"
mysql "$DB_NAME" < "$SQL037"

echo "==> 验证"
mysql "$DB_NAME" -e "SHOW PROCEDURE STATUS WHERE Db='$DB_NAME' AND Name='create_default_roles_for_tenant';"

echo ""
echo "完成。请无痕重新注册 https://wework.syzs.top/register"
