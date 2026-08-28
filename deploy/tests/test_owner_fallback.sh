#!/usr/bin/env bash
# 属主探测的兜底行为：目标目录属主是「服务器上不存在的 uid」时（历史上从 macOS
# rsync -a 同步残留的 501），GNU stat 的 %U 会输出字面量 UNKNOWN 且退出码 0，
# 必须不能被当成合法属主传给 chown。用桩命令跑 DRY_RUN 全流程验证。
# 用法：bash deploy/tests/test_owner_fallback.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PKG="$TMP/pkg"; BACKEND="$TMP/backend"; FRONTEND="$TMP/frontend/dist"; BIN="$TMP/bin"
mkdir -p "$PKG/backend/src" "$PKG/frontend/dist" "$PKG/database" "$BACKEND/src" "$FRONTEND" "$BIN"

cp "$HERE/../p0_install.sh" "$PKG/p0_install.sh"
echo 'module.exports = {}' > "$PKG/backend/src/app.js"
echo '{"name":"x"}' > "$PKG/backend/package.json"
echo '<script src="/assets/index-NEW123.js"></script>' > "$PKG/frontend/dist/index.html"
: > "$PKG/database/100_beauty_appointments_cards.sql"
echo 'old' > "$BACKEND/src/app.js"
echo '<script src="/assets/index-OLD000.js"></script>' > "$FRONTEND/index.html"
cat > "$BACKEND/.env" <<'EOF'
PORT=3010
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=zf
DB_PASSWORD=secret
DB_NAME=wework_saas
EOF

cat > "$BIN/mysql" <<'EOF'
#!/usr/bin/env bash
echo 1
EOF
cat > "$BIN/curl" <<'EOF'
#!/usr/bin/env bash
for a in "$@"; do [[ "$a" == "%{http_code}" ]] && { printf 200; exit 0; }; done
printf ''
EOF
# stat 桩：本机是 macOS（BSD stat，没有 -c），这里模拟服务器上的 GNU stat。
# STUB_NUM 给数值属主，STUB_NAME 给「名字」输出——孤儿 uid 时 GNU stat 会给 UNKNOWN。
cat > "$BIN/stat" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "-c" ]]; then
  case "${2:-}" in
    '%u:%g') echo "${STUB_NUM:-33:33}"; exit 0 ;;
    '%U:%G') echo "${STUB_NAME:-www-data:www-data}"; exit 0 ;;
    *) echo ""; exit 0 ;;
  esac
fi
exit 1
EOF
# id / getent 桩：只认 www-data(33) 和 staff(50)；uid 501 与 macos-only 一律解析失败
cat > "$BIN/id" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  "-nu 33"|"-u www-data") [[ "$1" == "-nu" ]] && echo "www-data" || echo "33" ;;
  *) exit 1 ;;
esac
EOF
cat > "$BIN/getent" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  "group 33"|"group www-data") echo "www-data:x:33:" ;;
  "group 50"|"group staff") echo "staff:x:50:" ;;
  *) exit 2 ;;
esac
EOF
chmod +x "$BIN"/*

FAIL=0
OUT="$TMP/out.txt"

# $1 用例名 $2 STUB_NUM $3 STUB_NAME $4 pm2 进程用户（空 = pm2 里查不到）
run_case() {
  local name="$1" num="$2" nm="$3" pm2user="$4"
  if [[ -n "$pm2user" ]]; then
    cat > "$BIN/pm2" <<EOF
#!/usr/bin/env bash
case "\${1:-}" in
  describe) exit 0 ;;
  jlist) echo '[{"name":"syqw-api","pm2_env":{"username":"$pm2user"}}]' ;;
  *) echo "pm2 \$*" ;;
esac
EOF
  else
    cat > "$BIN/pm2" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in
  describe) exit 0 ;;
  jlist) echo '[]' ;;
  *) echo "pm2 $*" ;;
esac
EOF
  fi
  chmod +x "$BIN/pm2"
  echo "=== $name ==="
  PATH="$BIN:$PATH" STUB_NUM="$num" STUB_NAME="$nm" \
  BACKEND_DIR="$BACKEND" FRONTEND_DIR="$FRONTEND" PM2_APP="syqw-api" \
  DRY_RUN=1 bash "$PKG/p0_install.sh" > "$OUT" 2>&1
  RC=$?
}

expect() {
  if grep -q -- "$1" "$OUT"; then printf "  ✓ %s\n" "$2"; else printf "  ✗ 缺少输出：%s\n" "$2"; FAIL=1; fi
}
reject() {
  if grep -q -- "$1" "$OUT"; then printf "  ✗ 不应出现：%s\n" "$2"; FAIL=1; else printf "  ✓ %s\n" "$2"; fi
}
rc0() {
  [[ "$RC" == 0 ]] && echo "  ✓ 流程未中断，退出码 0" || { echo "  ✗ 退出码 $RC"; FAIL=1; }
}

# ---------------------------------------------------------------
# 生产现场：/var/www/wework-saas/backend/src 属主是孤儿 uid 501，组 staff(50) 存在
run_case "1. 孤儿 uid（stat 输出 UNKNOWN）→ 回退到 PM2 进程用户" "501:50" "UNKNOWN:staff" "www-data"
rc0
expect "孤儿" "醒目提示原目录属主是孤儿 uid"
expect "uid=501" "把无法解析的 uid 数值打出来"
expect "chown -R www-data:www-data" "chown 使用兜底属主（PM2 进程用户）"
reject "chown -R UNKNOWN" "没有把 UNKNOWN 传给 chown"
reject "chown -R 501" "没有把裸 uid 传给 chown"

# 组也解析不了 + pm2 里查不到用户 → 最终兜底 root:root
run_case "2. uid/gid 都不可解析且 PM2 取不到用户 → 回退 root:root" "501:20" "UNKNOWN:UNKNOWN" ""
rc0
expect "gid=20" "把无法解析的 gid 数值打出来"
expect "chown -R root:root" "chown 回退到 root:root"
reject "chown -R UNKNOWN" "没有把 UNKNOWN 传给 chown"

# PM2 报出来的用户本身也不存在（比如已被删号）→ 同样不能信
run_case "3. PM2 进程用户也无法解析 → 回退 root:root" "501:50" "UNKNOWN:staff" "macos-only"
rc0
expect "chown -R root:root" "不可解析的 PM2 用户被忽略"
reject "chown -R macos-only" "没有把不存在的 PM2 用户传给 chown"

# 不回归：属主正常时行为与原先一致，且不打孤儿提示
run_case "4. 属主可正常解析 → 与原行为一致" "33:33" "www-data:www-data" "www-data"
rc0
expect "chown -R www-data:www-data" "按目标目录当前属主 chown"
reject "孤儿" "属主正常时不打孤儿提示"
reject "回退为" "属主正常时不走兜底"

[[ "$FAIL" == 0 ]] || sed 's/^/    /' "$OUT"
[[ "$FAIL" == 0 ]] && echo "全部通过" || echo "存在失败用例"
exit "$FAIL"
