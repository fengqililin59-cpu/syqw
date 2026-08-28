#!/usr/bin/env bash
# 单测 p0_install.sh 的 nginx 配置解析逻辑（纯本地，不碰服务器）
# 用法：bash deploy/tests/test_detect_stack.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE="$HERE/fixtures/nginx-T-production.conf"

P0_LIB_ONLY=1 source "$HERE/../p0_install.sh"

FAIL=0
check() {
  local name="$1" domain="$2" want_root="$3" want_port="$4"
  local out root port
  out="$(parse_nginx_site "$domain" < "$FIXTURE")"
  root="$(printf '%s\n' "$out" | sed -n 's/^root=//p' | head -1)"
  port="$(printf '%s\n' "$out" | sed -n 's/^port=//p' | head -1)"
  if [[ "$root" == "$want_root" && "$port" == "$want_port" ]]; then
    printf "  ✓ %-28s root=%s port=%s\n" "$name" "${root:-<空>}" "${port:-<空>}"
  else
    printf "  ✗ %-28s 期望 root=%s port=%s，实际 root=%s port=%s\n" \
      "$name" "$want_root" "$want_port" "${root:-<空>}" "${port:-<空>}"
    printf '%s\n' "$out" | sed 's/^/      /'
    FAIL=1
  fi
}

echo "=== nginx 解析单测 ==="
check "主应用 wework.syzs.top" wework.syzs.top /var/www/zhiflow/frontend/dist 3010
check "crm.syzs.top（排除 /upload）" crm.syzs.top /var/www/crm/dist 3001
check "ai.syzs.top（无 root）" ai.syzs.top "" 8787
check "growth.syzs.top" growth.syzs.top /var/www/growth/dist 3000
check "www.syzs.top（多域名同块）" www.syzs.top /var/www/site/dist 3011
check "不存在的域名" nope.example.com "" ""

echo "=== wework.syzs.top 全部候选 ==="
parse_nginx_site wework.syzs.top < "$FIXTURE" | sed 's/^/  /'

echo "=== pm2 按端口反查单测 ==="
if command -v node >/dev/null 2>&1; then
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  mkdir -p "$TMP/wework-saas/backend" "$TMP/zhiflow/backend"
  printf 'PORT=3010\nDB_NAME=wework_saas\n' > "$TMP/wework-saas/backend/.env"
  printf 'PORT=3002\nDB_NAME=zhiflow_prod\n' > "$TMP/zhiflow/backend/.env"
  JLIST="$(cat <<EOF
[
 {"name":"syqw-api","pid":111,"pm2_env":{"pm_cwd":"$TMP/wework-saas/backend","exec_mode":"cluster_mode"}},
 {"name":"syqw-api","pid":112,"pm2_env":{"pm_cwd":"$TMP/wework-saas/backend","exec_mode":"cluster_mode"}},
 {"name":"zhiflow-api","pid":211,"pm2_env":{"pm_cwd":"$TMP/zhiflow/backend","exec_mode":"cluster_mode"}},
 {"name":"ai-router-1","pid":311,"pm2_env":{"pm_cwd":"$TMP/nonexistent"}}
]
EOF
)"
  got="$(printf '%s' "$JLIST" | pm2_app_by_port 3010 2>/dev/null | cut -f1,3 | tr '\t' ' ')"
  [[ "$got" == "syqw-api cluster_mode" ]] \
    && printf "  ✓ 端口 3010 → %s\n" "$got" \
    || { printf "  ✗ 端口 3010 期望 'syqw-api cluster_mode'，实际 '%s'\n" "$got"; FAIL=1; }
  got="$(printf '%s' "$JLIST" | pm2_app_by_port 3002 2>/dev/null | cut -f1)"
  [[ "$got" == "zhiflow-api" ]] \
    && printf "  ✓ 端口 3002 → %s\n" "$got" \
    || { printf "  ✗ 端口 3002 期望 zhiflow-api，实际 '%s'\n" "$got"; FAIL=1; }
  if printf '%s' "$JLIST" | pm2_app_by_port 9999 >/dev/null 2>&1; then
    echo "  ✗ 端口 9999 应无匹配并以非 0 退出"; FAIL=1
  else
    echo "  ✓ 端口 9999 无匹配，非 0 退出"
  fi
else
  echo "  - 本机无 node，跳过"
fi

[[ "$FAIL" == 0 ]] && echo "全部通过" || echo "存在失败用例"
exit "$FAIL"
