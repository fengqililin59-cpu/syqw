#!/usr/bin/env bash
# Mac 本地开发冒烟：读 backend/.env → 可选 SQL 补丁 → DB 连通 → 可选 API 登录/审批/权限
# 用法（仓库根）: ./scripts/local-dev-smoke.sh
# 登录探测（勿提交密码）:
#   LOGIN_TENANT_ID=5 LOGIN_USERNAME=admin LOGIN_PASSWORD='***' ./scripts/local-dev-smoke.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/backend/.env}"
API_BASE="${API_BASE:-http://127.0.0.1:3000}"
API_V1="${API_BASE%/}/api/v1"
TIMEOUT_SEC="${TIMEOUT_SEC:-12}"

PASS=0
FAIL=0
WARN=0
SKIP=0

red() { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue() { printf "\033[34m%s\033[0m\n" "$*"; }

pass() { PASS=$((PASS + 1)); green "[PASS] $*"; }
fail() { FAIL=$((FAIL + 1)); red "[FAIL] $*"; }
warn() { WARN=$((WARN + 1)); yellow "[WARN] $*"; }
skip() { SKIP=$((SKIP + 1)); blue "[SKIP] $*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "缺少命令: $1"
    exit 1
  fi
}

env_get() {
  local key="$1"
  local default="${2:-}"
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "$default"
    return
  fi
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -n1 || true)"
  if [[ -z "$line" ]]; then
    echo "$default"
    return
  fi
  local val="${line#*=}"
  val="${val%$'\r'}"
  if [[ "$val" =~ ^\".*\"$ ]]; then val="${val:1:${#val}-2}"; fi
  if [[ "$val" =~ ^\'.*\'$ ]]; then val="${val:1:${#val}-2}"; fi
  echo "$val"
}

mysql_cmd() {
  local args=(-h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" "${DB_NAME}")
  if [[ -n "${DB_PASSWORD:-}" ]]; then
    MYSQL_PWD="$DB_PASSWORD" mysql "${args[@]}" "$@"
  else
    mysql "${args[@]}" "$@"
  fi
}

apply_sql_file() {
  local rel="$1"
  local path="$ROOT/$rel"
  if [[ ! -f "$path" ]]; then
    skip "SQL 不存在: $rel"
    return 0
  fi
  blue "应用 SQL: $rel"
  if mysql_cmd < "$path" >/dev/null 2>&1; then
    pass "SQL 已应用: $rel"
  else
    fail "SQL 应用失败: $rel（检查 DB 账号/权限）"
  fi
}

check_node_db_import() {
  if [[ "${SKIP_NODE:-0}" == "1" ]]; then
    skip "Node DB import（SKIP_NODE=1）"
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    warn "未安装 node，跳过 Sequelize 连通检查"
    return 0
  fi
  blue "检查 Node 能否连库（sequelize.authenticate）..."
  if (
    cd "$ROOT/backend"
    node --input-type=module -e "
      import { sequelize } from './src/models/index.js';
      await sequelize.authenticate();
      await sequelize.close();
      console.log('ok');
    "
  ) >/dev/null 2>&1; then
    pass "Node/Sequelize 数据库连通"
  else
    fail "Node/Sequelize 数据库连通失败（见 backend/.env）"
  fi
}

http_code() {
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' \
    --connect-timeout "$TIMEOUT_SEC" \
    --max-time "$TIMEOUT_SEC" \
    "$1" 2>/dev/null)" || true
  code="${code//$'\n'/}"
  if [[ -z "$code" || "$code" == "000" ]]; then
    echo "000"
  else
    echo "$code"
  fi
}

check_health() {
  if [[ "${SKIP_API:-0}" == "1" ]]; then
    skip "API health（SKIP_API=1）"
    return 0
  fi
  local url="${API_BASE%/}/health"
  local code
  code="$(http_code "$url")"
  code="${code//$'\n'/}"
  if [[ "$code" == "200" ]]; then
    pass "API health ($code)"
  elif [[ "$code" == "000" || -z "$code" ]]; then
    if [[ -n "${LOGIN_PASSWORD:-${PASSWORD:-}}" && -n "${LOGIN_USERNAME:-${USERNAME:-}}" ]]; then
      fail "API 未启动 ($url)，但已配置登录账号 — 请先 npm run dev:no-watch"
    else
      warn "API 未启动 ($url) — 先 cd backend && npm run dev:no-watch"
    fi
  else
    fail "API health HTTP $code ($url)"
  fi
}

extract_token() {
  local body="$1"
  node -e "
    let s = process.argv[1] || '';
    try {
      const j = JSON.parse(s);
      const t = j.data?.token || j.token || '';
      if (t) process.stdout.write(String(t));
    } catch (_) {}
  " "$body"
}

api_smoke_auth() {
  if [[ "${SKIP_API:-0}" == "1" ]]; then
    skip "API 登录冒烟（SKIP_API=1）"
    return 0
  fi

  local tenant="${LOGIN_TENANT_ID:-${TENANT_ID:-}}"
  local user="${LOGIN_USERNAME:-${USERNAME:-}}"
  local pass="${LOGIN_PASSWORD:-${PASSWORD:-}}"

  if [[ -z "$tenant" || -z "$user" || -z "$pass" ]]; then
    skip "API 登录（未设置 LOGIN_TENANT_ID / LOGIN_USERNAME / LOGIN_PASSWORD）"
    return 0
  fi

  local login_url="${API_V1}/auth/login"
  local body code token
  body="$(curl -sS --max-time "$TIMEOUT_SEC" -X POST "$login_url" \
    -H 'Content-Type: application/json' \
    -d "{\"tenant_id\":${tenant},\"username\":\"${user}\",\"password\":\"${pass}\"}" 2>/dev/null || true)"
  token="$(extract_token "$body")"

  if [[ -z "$token" ]]; then
    fail "POST /auth/login 未获得 token（账号或后端异常）"
    return 0
  fi
  pass "POST /auth/login 获得 token"

  code="$(curl -sS --max-time "$TIMEOUT_SEC" -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $token" "${API_V1}/auth/me" 2>/dev/null || echo "000")"
  if [[ "$code" == "200" ]]; then
    pass "GET /auth/me ($code)"
  else
    fail "GET /auth/me (HTTP $code)"
  fi

  code="$(curl -sS --max-time "$TIMEOUT_SEC" -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $token" "${API_V1}/auth/me/permissions" 2>/dev/null || echo "000")"
  if [[ "$code" == "200" ]]; then
    pass "GET /auth/me/permissions ($code)"
  else
    fail "GET /auth/me/permissions (HTTP $code)"
  fi

  code="$(curl -sS --max-time "$TIMEOUT_SEC" -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $token" "${API_V1}/approvals?page=1&page_size=5" 2>/dev/null || echo "000")"
  if [[ "$code" == "200" ]]; then
    pass "GET /approvals ($code)"
  elif [[ "$code" == "500" ]]; then
    fail "GET /approvals HTTP 500（常见：approval_* 表缺失，见 docs/deploy/local-dev-quickstart-zh.md）"
  elif [[ "$code" == "403" ]]; then
    fail "GET /approvals HTTP 403（检查 customer:view / customer:read 别名）"
  else
    fail "GET /approvals (HTTP $code)"
  fi

  local ep
  for ep in \
    "/customers?page=1&page_size=5" \
    "/pipeline/stages" \
    "/contracts?page=1&page_size=5" \
    "/inbox/threads?page=1&page_size=5" \
    "/inbox/sla/summary" \
    "/dashboard/smart-alerts" \
    "/ai-employee/stats" \
    "/dashboard/ai-employee-playbook" \
    "/tasks/stats"
  do
    code="$(curl -sS --max-time "$TIMEOUT_SEC" -o /dev/null -w '%{http_code}' \
      -H "Authorization: Bearer $token" "${API_V1}${ep}" 2>/dev/null || echo "000")"
    if [[ "$code" == "200" ]]; then
      pass "GET ${ep%%\?*} ($code)"
    elif [[ "$code" == "500" ]]; then
      if [[ "${ep%%\?*}" == "/contracts" ]]; then
        fail "GET /contracts HTTP 500（常见：Contract include 别名或 contracts 表缺列）"
      else
        fail "GET ${ep%%\?*} HTTP 500（检查 database/local_inbox_and_customers_no_fk.sql）"
      fi
    elif [[ "$code" == "403" ]]; then
      warn "GET ${ep%%\?*} HTTP 403（权限不足，可忽略）"
    else
      fail "GET ${ep%%\?*} (HTTP $code)"
    fi
  done
}

main() {
  require_cmd curl
  echo "==> local-dev-smoke"
  echo "ROOT: $ROOT"
  echo "ENV:  $ENV_FILE"
  echo ""

  DB_HOST="$(env_get DB_HOST 127.0.0.1)"
  DB_PORT="$(env_get DB_PORT 3306)"
  DB_NAME="$(env_get DB_NAME wework_saas)"
  DB_USER="$(env_get DB_USER root)"
  DB_PASSWORD="$(env_get DB_PASSWORD "")"
  export DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD

  if [[ ! -f "$ENV_FILE" ]]; then
    warn "未找到 $ENV_FILE，使用默认 DB_*"
  fi

  if [[ "${SKIP_SQL:-0}" != "1" ]] && command -v mysql >/dev/null 2>&1; then
    if mysql_cmd -e "SELECT 1" >/dev/null 2>&1; then
      pass "MySQL 连接 (${DB_USER}@${DB_HOST}/${DB_NAME})"
      apply_sql_file "database/local_cleanup_orphan_subscriptions.sql"
      apply_sql_file "database/local_fix_core_tables_no_fk.sql"
      apply_sql_file "database/local_missing_tables_no_fk.sql"
      apply_sql_file "database/local_schema_gaps_no_fk.sql"
      apply_sql_file "database/local_inbox_and_customers_no_fk.sql"
    else
      warn "MySQL 不可达，跳过 SQL 补丁（可设 SKIP_SQL=1 静默）"
    fi
  elif [[ "${SKIP_SQL:-0}" == "1" ]]; then
    skip "SQL 补丁（SKIP_SQL=1）"
  else
    warn "未安装 mysql 客户端，跳过 SQL"
  fi

  check_node_db_import
  check_health
  api_smoke_auth

  echo ""
  echo "==> Summary"
  echo "  PASS: $PASS"
  echo "  FAIL: $FAIL"
  echo "  WARN: $WARN"
  echo "  SKIP: $SKIP"

  if [[ "$FAIL" -gt 0 ]]; then
    red "本地冒烟未通过 — 修复后再推 ECS"
    exit 1
  fi
  if [[ "$WARN" -gt 0 ]]; then
    yellow "通过（有警告：例如 API 未启动或未配置登录账号）"
    exit 0
  fi
  green "本地冒烟通过"
  exit 0
}

main "$@"
