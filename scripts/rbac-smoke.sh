#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000/api/v1}"
TENANT_ID="${TENANT_ID:-}"
USERNAME="${USERNAME:-}"
PASSWORD="${PASSWORD:-}"
TOKEN="${TOKEN:-}"
SCENARIO="${SCENARIO:-customer_view}"
TIMEOUT_SEC="${TIMEOUT_SEC:-15}"

PASS_COUNT=0
FAIL_COUNT=0

red() { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue() { printf "\033[34m%s\033[0m\n" "$*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "缺少命令: $1"
    exit 1
  fi
}

login_if_needed() {
  if [[ -n "$TOKEN" ]]; then
    return 0
  fi
  if [[ -z "$TENANT_ID" || -z "$USERNAME" || -z "$PASSWORD" ]]; then
    red "未提供 TOKEN，且 TENANT_ID/USERNAME/PASSWORD 不完整。"
    exit 1
  fi
  blue "登录并获取测试 Token..."
  TOKEN="$(
    curl -sS --max-time "$TIMEOUT_SEC" -X POST "$BASE_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"tenant_id\":$TENANT_ID,\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(j.data?.token||'')}catch(e){process.stdout.write('')}})"
  )"
  if [[ -z "$TOKEN" ]]; then
    red "登录失败：未拿到 token。请检查账号密码或 BASE_URL。"
    exit 1
  fi
  green "Token 获取成功。"
}

run_case() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected="$4"
  local body="${5:-}"

  local code
  if [[ -n "$body" ]]; then
    code="$(
      curl -sS --max-time "$TIMEOUT_SEC" -o /dev/null -w "%{http_code}" \
        -X "$method" "$BASE_URL$path" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$body"
    )"
  else
    code="$(
      curl -sS --max-time "$TIMEOUT_SEC" -o /dev/null -w "%{http_code}" \
        -X "$method" "$BASE_URL$path" \
        -H "Authorization: Bearer $TOKEN"
    )"
  fi

  if [[ "$code" == "$expected" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    green "[PASS] $name ($method $path => $code)"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    red "[FAIL] $name ($method $path => got $code, expect $expected)"
  fi
}

run_customer_view() {
  blue "场景: customer_view（读应通过，写应拒绝）"
  run_case "customers list" "GET" "/customers?page=1&page_size=5" "200"
  run_case "customer create forbidden" "POST" "/customers" "403" '{"name":"rbac-smoke","phone":"13800000000"}'
}

run_broadcast_view() {
  blue "场景: broadcast_view（读应通过，发送应拒绝）"
  run_case "broadcast list" "GET" "/broadcast-tasks?page=1&page_size=5" "200"
  run_case "broadcast create forbidden" "POST" "/broadcast-tasks" "403" '{"name":"rbac-smoke","content_type":"text","content_text":"hi","run_now":false}'
}

run_dashboard_view() {
  blue "场景: dashboard_view（报表应通过，任务控制应拒绝）"
  run_case "dashboard overview" "GET" "/dashboard/overview" "200"
  run_case "ads roi" "GET" "/ads/roi?start_date=2026-05-01&end_date=2026-05-06" "200"
  run_case "agg enqueue forbidden" "POST" "/ads/jobs" "403" '{"job_type":"ads_roi_daily","job_date":"2026-05-06"}'
}

run_settings_manage_no_audit() {
  blue "场景: settings_manage_no_audit（系统管理通过，审计日志拒绝）"
  run_case "users list" "GET" "/users?page=1&page_size=5" "200"
  run_case "audit logs forbidden" "GET" "/settings/audit-logs?page=1&page_size=5" "403"
}

print_usage() {
  cat <<'EOF'
用法:
  TOKEN="..." SCENARIO=customer_view scripts/rbac-smoke.sh
  TENANT_ID=1 USERNAME=qa_user PASSWORD=xxx SCENARIO=broadcast_view scripts/rbac-smoke.sh

环境变量:
  BASE_URL   默认 http://127.0.0.1:3000/api/v1
  TOKEN      已有 token（优先）
  TENANT_ID  登录租户 ID（TOKEN 为空时必填）
  USERNAME   登录账号（TOKEN 为空时必填）
  PASSWORD   登录密码（TOKEN 为空时必填）
  SCENARIO   customer_view | broadcast_view | dashboard_view | settings_manage_no_audit | all
EOF
}

main() {
  require_cmd curl
  require_cmd node

  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    print_usage
    exit 0
  fi

  login_if_needed

  case "$SCENARIO" in
    customer_view) run_customer_view ;;
    broadcast_view) run_broadcast_view ;;
    dashboard_view) run_dashboard_view ;;
    settings_manage_no_audit) run_settings_manage_no_audit ;;
    all)
      run_customer_view
      run_broadcast_view
      run_dashboard_view
      run_settings_manage_no_audit
      ;;
    *)
      red "未知 SCENARIO: $SCENARIO"
      print_usage
      exit 1
      ;;
  esac

  echo
  blue "结果汇总: pass=$PASS_COUNT, fail=$FAIL_COUNT"
  if [[ "$FAIL_COUNT" -gt 0 ]]; then
    exit 1
  fi
  green "RBAC 冒烟通过。"
}

main "$@"
