#!/usr/bin/env bash
# ECS：从 /var/www/zhiflow/database 或 /tmp 下的迁移包执行生产 SQL（读 backend/.env）
# 用法:
#   sudo bash deploy/scripts/ecs-apply-prod-schema.sh
#   sudo APPLY_FILE=zhiflow_prod_phase10_12_no_fk.sql bash deploy/scripts/ecs-apply-prod-schema.sh
#   sudo bash deploy/scripts/ecs-apply-prod-schema.sh /tmp/zhiflow-migrate-*/database/zhiflow_prod_phase10_12_no_fk.sql
set -euo pipefail

DEFAULT_SQL="zhiflow_prod_phase10_12_no_fk.sql"
SITE_ROOT="${SITE_ROOT:-/var/www/zhiflow}"
ENV_FILE="${ENV_FILE:-$SITE_ROOT/backend/.env}"
APPLY_FILE="${APPLY_FILE:-$DEFAULT_SQL}"

die() { echo "错误: $*" >&2; exit 1; }

if [[ ! -f "$ENV_FILE" ]]; then
  die "未找到 $ENV_FILE（请先部署 backend 并配置 .env）"
fi

DB_HOST=$(grep -E '^DB_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d ' "' || true)
DB_PORT=$(grep -E '^DB_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d ' "' || true)
DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d ' "' || true)
DB_USER=$(grep -E '^DB_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d ' "' || true)
DB_PASSWORD=$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d ' "' || true)

: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=3306}"
: "${DB_NAME:=zhiflow_prod}"
: "${DB_USER:=zhiflow}"

echo "==> 目标库: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

find_sql_file() {
  local name="$1"
  local candidate

  if [[ -f "$name" && "$name" == *.sql ]]; then
    echo "$name"
    return 0
  fi

  local bases=(
    "$SITE_ROOT/database"
    "/var/www/zhiflow/database"
    "/tmp/zhiflow-migrate/database"
  )
  shopt -s nullglob
  for base in "${bases[@]}" /tmp/zhiflow-migrate-*; do
    [[ -d "$base" ]] || continue
    if [[ -d "$base/database" ]]; then
      candidate="$base/database/$name"
    else
      candidate="$base/$name"
    fi
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  shopt -u nullglob
  return 1
}

resolve_input() {
  if [[ $# -ge 1 && -n "${1:-}" ]]; then
    if [[ -f "$1" ]]; then
      echo "$1"
      return 0
    fi
    find_sql_file "$(basename "$1")" && return 0
    die "找不到 SQL 文件: $1"
  fi
  find_sql_file "$APPLY_FILE" || die "找不到 $APPLY_FILE。请先上传 zhiflow-migrate 包: bash deploy/scripts/pack-migrate-upload.sh（Mac）"
}

SQL_PATH="$(resolve_input "${1:-}")"
echo "==> 执行: $SQL_PATH"

MYSQL_ARGS=(-h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER")
if [[ -n "$DB_PASSWORD" ]]; then
  MYSQL_ARGS+=(-p"$DB_PASSWORD")
fi

mysql "${MYSQL_ARGS[@]}" "$DB_NAME" < "$SQL_PATH"
echo "==> 完成: $(basename "$SQL_PATH") → ${DB_NAME}"
