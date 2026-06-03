#!/usr/bin/env bash
# ZhiFlow 部署后冒烟测试（无需鉴权）：API 健康 + 可选静态页。
# 用法: ./scripts/smoke-test.sh [BASE_URL]
# 默认 http://127.0.0.1:3000，或环境变量 SMOKE_BASE_URL。
# 本地未启动服务时，默认可仅告警不阻断；显式传入 BASE_URL 时健康检查失败 exit 1。
set -euo pipefail

TIMEOUT_SEC="${SMOKE_TIMEOUT_SEC:-10}"

BASE_URL_EXPLICIT=0
if [[ $# -ge 1 ]]; then
  BASE_URL="${1%/}"
  BASE_URL_EXPLICIT=1
elif [[ -n "${SMOKE_BASE_URL:-}" ]]; then
  BASE_URL="${SMOKE_BASE_URL%/}"
  BASE_URL_EXPLICIT=1
else
  BASE_URL="http://127.0.0.1:3000"
fi

HEALTH_PATH="/health"
OK_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
CRITICAL_FAIL=0

red() { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "[FAIL] 缺少命令: $1"
    exit 1
  fi
}

# curl 返回 HTTP 状态码；连接失败返回 000
http_code() {
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' \
    --connect-timeout "$TIMEOUT_SEC" \
    --max-time "$TIMEOUT_SEC" \
    "$1" 2>/dev/null || true)"
  if [[ -z "${code}" || "${code}" == "000" ]]; then
    echo "000"
  else
    echo "${code}"
  fi
}

ok() {
  OK_COUNT=$((OK_COUNT + 1))
  green "[OK] $*"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  red "[FAIL] $*"
}

fail_critical() {
  fail "$@"
  CRITICAL_FAIL=$((CRITICAL_FAIL + 1))
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  yellow "[WARN] $*"
}

check_http() {
  local label="$1"
  local url="$2"
  local optional="${3:-0}"
  local code
  code="$(http_code "$url")"

  if [[ "${code}" == "200" || "${code}" == "304" ]]; then
    ok "$label (${code}) $url"
    return 0
  fi

  if [[ "${code}" == "000" ]]; then
    if [[ "$optional" == "1" ]]; then
      warn "$label 不可达（连接失败，可选检查） $url"
    else
      fail_critical "$label 不可达（连接失败） $url"
    fi
    return 1
  fi

  if [[ "$optional" == "1" ]]; then
    warn "$label HTTP ${code} (optional) $url"
  else
    fail_critical "$label HTTP ${code} $url"
  fi
  return 1
}

check_health_body() {
  local url="$1"
  local body
  body="$(curl -sS --connect-timeout "$TIMEOUT_SEC" --max-time "$TIMEOUT_SEC" "$url" 2>/dev/null || true)"
  if echo "$body" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
    return 0
  fi
  return 1
}

require_cmd curl

echo "==> ZhiFlow smoke-test"
echo "Base: $BASE_URL"
echo "Health: ${BASE_URL}${HEALTH_PATH}"
echo ""

# 1. API 健康（关键）
health_url="${BASE_URL}${HEALTH_PATH}"
health_code="$(http_code "$health_url")"
if [[ "${health_code}" == "200" ]] && check_health_body "$health_url"; then
  ok "API health (${health_code}) $health_url"
elif [[ "${health_code}" == "000" ]]; then
  if [[ "$BASE_URL_EXPLICIT" == 1 ]]; then
    fail_critical "API health 不可达（连接失败） $health_url"
  else
    fail_critical "API health 不可达（连接失败） $health_url"
    yellow "      提示: 本地未启动 backend 时常见；部署后请执行 ./scripts/smoke-test.sh https://你的域名"
  fi
else
  fail_critical "API health HTTP ${health_code} $health_url"
fi

# 2. 首页 / 静态（可选：前后端分域部署时可能不在同 host）
check_http "Frontend root" "${BASE_URL}/" 1 || true

# 3. 合规静态页（同 host 时可选）
check_http "privacy.html" "${BASE_URL}/privacy.html" 1 || true
check_http "terms.html" "${BASE_URL}/terms.html" 1 || true

echo ""
echo "==> Summary"
echo "  OK:   $OK_COUNT"
echo "  FAIL: $FAIL_COUNT"
echo "  WARN: $WARN_COUNT"

if [[ "$CRITICAL_FAIL" -gt 0 ]]; then
  if [[ "$BASE_URL_EXPLICIT" == 1 ]]; then
    red "Smoke test FAILED (critical: API health)"
    exit 1
  fi
  yellow "Smoke test: 本地默认地址无服务，未显式指定 BASE_URL — 仅告警"
  exit 0
fi

if [[ "$WARN_COUNT" -gt 0 ]]; then
  yellow "Smoke test PASSED (with optional warnings)"
else
  green "Smoke test PASSED"
fi
exit 0
