#!/usr/bin/env bash
# 部署后一键验收：健康检查、公域 Webhook 验签、本轮迭代 API 探活。
# 可在 ECS 上执行，也可在本地对远程 API 执行。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:3010}"
API_URL="${API_URL:-${BASE_URL%/}/api/v1}"
TENANT_ID="${TENANT_ID:-1}"
USERNAME="${USERNAME:-}"
PASSWORD="${PASSWORD:-}"
TOKEN="${TOKEN:-}"
TIMEOUT_SEC="${TIMEOUT_SEC:-20}"
PUBLIC_WEBHOOK_SECRET="${PUBLIC_INBOX_WEBHOOK_SECRET:-${PUBLIC_WEBHOOK_SECRET:-}}"
SKIP_WEBHOOK_INGEST="${SKIP_WEBHOOK_INGEST:-0}"
PHASE="${PHASE:-all}"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

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

load_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *=* ]] && continue
    local key="${line%%=*}"
    local val="${line#*=}"
    key="$(echo "$key" | tr -d '[:space:]')"
    val="$(echo "$val" | sed -e 's/^["'\'' ]*//' -e 's/["'\'' ]*$//')"
    case "$key" in
      PUBLIC_INBOX_WEBHOOK_SECRET)
        [[ -z "$PUBLIC_WEBHOOK_SECRET" ]] && PUBLIC_WEBHOOK_SECRET="$val"
        ;;
    esac
  done <"$f"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  green "[PASS] $*"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  red "[FAIL] $*"
}

skip() {
  SKIP_COUNT=$((SKIP_COUNT + 1))
  yellow "[SKIP] $*"
}

login_if_needed() {
  if [[ -n "$TOKEN" ]]; then
    return 0
  fi
  if [[ -z "$USERNAME" || -z "$PASSWORD" ]]; then
    return 1
  fi
  blue "管理员登录获取 Token..."
  TOKEN="$(
    curl -sS --max-time "$TIMEOUT_SEC" -X POST "$API_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"tenant_id\":${TENANT_ID},\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}" \
      | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(j.data?.token||'')}catch{process.stdout.write('')}})"
  )"
  [[ -n "$TOKEN" ]]
}

http_code() {
  local method="$1"
  local url="$2"
  shift 2
  curl -sS --max-time "$TIMEOUT_SEC" -o /dev/null -w "%{http_code}" -X "$method" "$url" "$@"
}

http_body() {
  local method="$1"
  local url="$2"
  shift 2
  curl -sS --max-time "$TIMEOUT_SEC" -X "$method" "$url" "$@"
}

run_public_phase() {
  blue "== 阶段 1：基础健康与公域回调（无需登录） =="

  local code
  code="$(http_code GET "$BASE_URL/health")"
  if [[ "$code" == "200" ]]; then pass "GET /health => 200"; else fail "GET /health => $code (expect 200)"; fi

  local deep_ok
  deep_ok="$(
    http_body GET "$BASE_URL/health?deep=1" \
      | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(j.database===true?'1':'0')}catch{process.stdout.write('0')}})"
  )"
  if [[ "$deep_ok" == "1" ]]; then pass "GET /health?deep=1 database=true"; else fail "GET /health?deep=1 数据库不可用"; fi

  local verify_url="$API_URL/callback/inbox/${TENANT_ID}/douyin"
  local verify_body='{"event":"verify_webhook","client_key":"acceptance","content":{"challenge":987654}}'
  local verify_resp
  verify_resp="$(http_body POST "$verify_url" -H "Content-Type: application/json" -d "$verify_body")"
  local challenge_ok
  challenge_ok="$(
    printf '%s' "$verify_resp" \
      | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(String(j.challenge)==='987654'?'1':'0')}catch{process.stdout.write('0')}})"
  )"
  if [[ "$challenge_ok" == "1" ]]; then
    pass "抖音 verify_webhook challenge 响应正确"
  else
    fail "抖音 verify_webhook 未返回 challenge（响应: ${verify_resp:0:120})"
  fi

  if [[ "$SKIP_WEBHOOK_INGEST" == "1" ]]; then
    skip "公域入站写入测试（SKIP_WEBHOOK_INGEST=1）"
  elif [[ -n "$PUBLIC_WEBHOOK_SECRET" ]]; then
    local ingest_body
    ingest_body="$(node -e "process.stdout.write(JSON.stringify({open_id:'acceptance_'+Date.now(),text:'[验收] legacy token',msg_id:'accept_'+Date.now()}))")"
    code="$(
      http_code POST "$verify_url" \
        -H "Content-Type: application/json" \
        -H "X-Inbox-Webhook-Token: $PUBLIC_WEBHOOK_SECRET" \
        -d "$ingest_body"
    )"
    if [[ "$code" == "200" ]]; then pass "Legacy Token 公域入站 => 200"; else fail "Legacy Token 公域入站 => $code"; fi

    code="$(
      http_code POST "$verify_url" \
        -H "Content-Type: application/json" \
        -H "X-Inbox-Webhook-Token: wrong-secret" \
        -d "$ingest_body"
    )"
    if [[ "$code" == "401" ]]; then pass "错误 Legacy Token => 401"; else fail "错误 Legacy Token => $code (expect 401)"; fi
  else
    skip "Legacy Token 入站（未设置 PUBLIC_INBOX_WEBHOOK_SECRET）"
  fi
}

api_get_field_ok() {
  local name="$1"
  local path="$2"
  local expr="$3"
  local body code
  body="$(http_body GET "$API_URL$path" -H "Authorization: Bearer $TOKEN")"
  code="$(
    printf '%s' "$body" \
      | node -e "
        let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
          try{
            const j=JSON.parse(s);
            const ok=(${expr});
            process.stdout.write(ok?'200':'0');
          }catch{process.stdout.write('0')}
        })"
  )"
  if [[ "$code" == "200" ]]; then pass "$name"; else fail "$name（请确认已部署最新后端并执行 059-061 迁移）"; fi
}

run_admin_phase() {
  blue "== 阶段 2：管理端 API 探活（需 settings:manage / dashboard:view） =="

  if ! login_if_needed; then
    skip "管理端 API（请设置 TOKEN 或 USERNAME+PASSWORD）"
    return 0
  fi

  local code
  code="$(http_code GET "$API_URL/settings/lead-assignment" -H "Authorization: Bearer $TOKEN")"
  if [[ "$code" == "200" ]]; then pass "GET /settings/lead-assignment => 200"; else fail "GET /settings/lead-assignment => $code"; fi

  code="$(http_code GET "$API_URL/settings/public-webhooks" -H "Authorization: Bearer $TOKEN")"
  if [[ "$code" == "200" ]]; then pass "GET /settings/public-webhooks => 200"; else fail "GET /settings/public-webhooks => $code"; fi

  api_get_field_ok "GET /dashboard/stats 含 overdue_ticket_count" "/dashboard/stats" "j.data && typeof j.data.overdue_ticket_count==='number'"

  code="$(http_code GET "$API_URL/service/tickets/overdue" -H "Authorization: Bearer $TOKEN")"
  if [[ "$code" == "200" ]]; then pass "GET /service/tickets/overdue => 200"; else fail "GET /service/tickets/overdue => $code"; fi

  code="$(http_code GET "$API_URL/follow-ups/overdue" -H "Authorization: Bearer $TOKEN")"
  if [[ "$code" == "200" ]]; then pass "GET /follow-ups/overdue => 200"; else fail "GET /follow-ups/overdue => $code"; fi

  code="$(http_code GET "$API_URL/inbox/webhook-info" -H "Authorization: Bearer $TOKEN")"
  if [[ "$code" == "200" ]]; then
    local wh_ok
    wh_ok="$(
      http_body GET "$API_URL/inbox/webhook-info" -H "Authorization: Bearer $TOKEN" \
        | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(j.data?.platform_headers?.douyin?'1':'0')}catch{process.stdout.write('0')}})"
    )"
    if [[ "$wh_ok" == "1" ]]; then pass "GET /inbox/webhook-info 含 platform_headers"; else fail "GET /inbox/webhook-info 缺少 platform_headers"; fi
  else
    fail "GET /inbox/webhook-info => $code"
  fi

  code="$(http_code GET "$API_URL/customers?page=1&size=1&keyword=1" -H "Authorization: Bearer $TOKEN")"
  if [[ "$code" == "200" ]]; then pass "GET /customers?keyword= ID 搜索 => 200"; else fail "GET /customers keyword => $code"; fi

  if [[ "$SKIP_WEBHOOK_INGEST" != "1" ]]; then
    local preview_body sample_body sig verify_url
    sample_body='{"open_id":"acceptance_signed","text":"[验收] douyin sig","msg_id":"accept_sig_'$(date +%s)'"}'
    preview_body="$(http_body POST "$API_URL/settings/public-webhooks/sign-preview" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"sample_body\":$(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$sample_body")}")"
    sig="$(
      printf '%s' "$preview_body" \
        | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(j.data?.douyin_signature||'')}catch{process.stdout.write('')}})"
    )"
    if [[ -n "$sig" ]]; then
      verify_url="$API_URL/callback/inbox/${TENANT_ID}/douyin"
      code="$(
        http_code POST "$verify_url" \
          -H "Content-Type: application/json" \
          -H "X-Douyin-Signature: $sig" \
          -d "$sample_body"
      )"
      if [[ "$code" == "200" ]]; then pass "抖音官方签名入站（租户已配 Secret）=> 200"; else fail "抖音官方签名入站 => $code"; fi
    else
      skip "抖音官方签名入站（租户未配置 client_secret）"
    fi
  fi

  code="$(http_code GET "$API_URL/settings/health-monitor" -H "Authorization: Bearer $TOKEN")"
  if [[ "$code" == "200" ]]; then pass "GET /settings/health-monitor => 200"; else fail "GET /settings/health-monitor => $code"; fi
}

print_usage() {
  cat <<EOF
用法:
  bash scripts/post-deploy-acceptance.sh
  TENANT_ID=1 USERNAME=admin PASSWORD='***' bash scripts/post-deploy-acceptance.sh
  TOKEN='...' PHASE=public bash scripts/post-deploy-acceptance.sh

环境变量:
  BASE_URL                 默认 http://127.0.0.1:3010
  API_URL                  默认 \$BASE_URL/api/v1
  TENANT_ID                默认 1
  TOKEN                    管理员 JWT（优先）
  USERNAME / PASSWORD      无 TOKEN 时登录
  PUBLIC_INBOX_WEBHOOK_SECRET / PUBLIC_WEBHOOK_SECRET
  SKIP_WEBHOOK_INGEST=1    跳过会写入收件箱的 POST 测试
  PHASE                    public | admin | all（默认 all）

自动读取（若存在）: \$ROOT_DIR/backend/.env 中的 PUBLIC_INBOX_WEBHOOK_SECRET
EOF
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    print_usage
    exit 0
  fi

  require_cmd curl
  require_cmd node

  load_env_file "$ROOT_DIR/backend/.env"

  blue "验收目标: BASE_URL=$BASE_URL TENANT_ID=$TENANT_ID PHASE=$PHASE"
  echo

  case "$PHASE" in
    public) run_public_phase ;;
    admin) run_admin_phase ;;
    all)
      run_public_phase
      echo
      run_admin_phase
      ;;
    *)
      red "未知 PHASE: $PHASE"
      print_usage
      exit 1
      ;;
  esac

  echo
  blue "汇总: pass=$PASS_COUNT fail=$FAIL_COUNT skip=$SKIP_COUNT"
  if [[ "$FAIL_COUNT" -gt 0 ]]; then
    red "验收未通过。"
    exit 1
  fi
  green "验收通过。"
}

main "$@"
