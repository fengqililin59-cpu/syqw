#!/usr/bin/env bash
# 用桩命令（假 pm2 / mysql / curl / stat）跑一遍 DRY_RUN=1 全流程，断言新增步骤都被打印
# 用法：bash deploy/tests/test_dry_run_flow.sh
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

# 桩命令：全部只回显/返回成功，绝不碰真实服务
cat > "$BIN/pm2" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in
  describe) exit 0 ;;
  jlist) echo '[]' ;;
  *) echo "pm2 $*" ;;
esac
EOF
cat > "$BIN/mysql" <<'EOF'
#!/usr/bin/env bash
# 断言凭据走 --defaults-extra-file，命令行上不再出现密码
for a in "$@"; do
  case "$a" in
    -p*) echo "STUB-FAIL: 命令行仍带密码: $a" >&2; exit 9 ;;
  esac
done
case "${1:-}" in
  --defaults-extra-file=*) : ;;
  *) echo "STUB-FAIL: 未使用 --defaults-extra-file" >&2; exit 9 ;;
esac
echo 1
EOF
cat > "$BIN/curl" <<'EOF'
#!/usr/bin/env bash
for a in "$@"; do [[ "$a" == "%{http_code}" ]] && { printf 200; exit 0; }; done
printf ''
EOF
# GNU stat 桩：本机 macOS 没有 stat -c，脚本里用的是服务器上的 GNU 语法
cat > "$BIN/stat" <<'EOF'
#!/usr/bin/env bash
[[ "${1:-}" == "-c" ]] && { echo "www-data:www-data"; exit 0; }
exit 1
EOF
chmod +x "$BIN"/*

OUT="$TMP/out.txt"
PATH="$BIN:$PATH" \
BACKEND_DIR="$BACKEND" FRONTEND_DIR="$FRONTEND" PM2_APP="syqw-api" \
DRY_RUN=1 bash "$PKG/p0_install.sh" > "$OUT" 2>&1
RC=$?

FAIL=0
expect() {
  if grep -q -- "$1" "$OUT"; then printf "  ✓ %s\n" "$2"; else printf "  ✗ 缺少输出：%s\n" "$2"; FAIL=1; fi
}

echo "=== DRY_RUN 全流程 ==="
[[ "$RC" == 0 ]] && echo "  ✓ 退出码 0" || { echo "  ✗ 退出码 $RC"; FAIL=1; }
expect "同步后将恢复属主" "打印同步后要恢复的属主"
expect "rlpt" "rsync 使用 -rlpt（不带 -o -g）"
expect "chmod 755" "目录权限规范化"
expect "chmod 644" "文件权限规范化"
expect "chown -R www-data:www-data" "按探测到的属主 chown"
expect "curl http://127.0.0.1:3010/health" "后端健康检查"
expect "resolve ${SITE_DOMAIN:-wework.syzs.top}:80:127.0.0.1" "静态站点校验"
expect "DRY_RUN 完成" "流程走到结尾"
if grep -q -- '\-a --delete' "$OUT"; then
  echo "  ✗ 仍在使用 rsync -a"; FAIL=1
else
  echo "  ✓ 不再使用 rsync -a"
fi

[[ "$FAIL" == 0 ]] || sed 's/^/    /' "$OUT"
[[ "$FAIL" == 0 ]] && echo "全部通过" || echo "存在失败用例"
exit "$FAIL"
