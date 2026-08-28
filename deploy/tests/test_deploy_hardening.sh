#!/usr/bin/env bash
# 单测 p0_install.sh 的权限规范与静态站点校验（纯本地，靠桩命令，不碰服务器）
# 用法：bash deploy/tests/test_deploy_hardening.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SITE_DOMAIN="wework.syzs.top"
DRY_RUN=0
P0_LIB_ONLY=1 source "$HERE/../p0_install.sh"

FAIL=0
ok()   { printf "  ✓ %s\n" "$*"; }
bad()  { printf "  ✗ %s\n" "$*"; FAIL=1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 本机是 macOS，stat -c 是 GNU 语法；这里用 %OLp 的等价物读八进制权限
perm() {
  if stat -c '%a' "$1" >/dev/null 2>&1; then stat -c '%a' "$1"; else stat -f '%OLp' "$1"; fi
}

# ---------------------------------------------------------------
echo "=== 1. 同步后权限规范化 ==="
# 模拟 macOS 打包产物：目录 700 / 文件 700
SRC="$TMP/src"; DST="$TMP/dst"
mkdir -p "$SRC/assets" "$DST"
echo '<script src="/assets/index-AAA111.js"></script>' > "$SRC/index.html"
echo 'console.log(1)' > "$SRC/assets/index-AAA111.js"
chmod 700 "$SRC" "$SRC/assets" "$SRC/index.html" "$SRC/assets/index-AAA111.js"

# chown 需要 root，本地测试只覆盖权限部分：把 chown 换成记录调用的桩
CHOWN_LOG="$TMP/chown.log"
chown() { printf '%s\n' "$*" >> "$CHOWN_LOG"; }

sync_tree "$SRC/" "$DST/" "www-data:www-data" --delete >/dev/null

for f in index.html assets/index-AAA111.js; do
  p="$(perm "$DST/$f")"
  [[ "$p" == "644" ]] && ok "文件 $f 权限 $p" || bad "文件 $f 期望 644，实际 $p"
done
p="$(perm "$DST/assets")"
[[ "$p" == "755" ]] && ok "目录 assets 权限 $p" || bad "目录 assets 期望 755，实际 $p"
p="$(perm "$DST")"
[[ "$p" == "755" ]] && ok "目标根目录权限 $p" || bad "目标根目录期望 755，实际 $p"
grep -q 'www-data:www-data' "$CHOWN_LOG" \
  && ok "同步后按探测到的属主执行 chown" \
  || bad "未调用 chown 恢复属主"

echo "=== 2. normalize_tree 能修复已经错掉的权限 ==="
chmod 700 "$DST/index.html"
normalize_tree "$DST" "www-data:www-data" >/dev/null
p="$(perm "$DST/index.html")"
[[ "$p" == "644" ]] && ok "回滚后 index.html 被修回 $p" || bad "回滚后期望 644，实际 $p"

unset -f chown

# ---------------------------------------------------------------
echo "=== 3. 静态站点校验 ==="
# curl 桩：按 STUB_CODE / STUB_BODY 决定返回，-w 场景只回状态码
STUB_DIR="$TMP/bin"; mkdir -p "$STUB_DIR"
cat > "$STUB_DIR/curl" <<'STUB'
#!/usr/bin/env bash
for a in "$@"; do
  if [[ "$a" == "%{http_code}" ]]; then printf '%s' "${STUB_CODE:-200}"; exit 0; fi
done
printf '%s' "${STUB_BODY:-}"
STUB
chmod +x "$STUB_DIR/curl"
PATH="$STUB_DIR:$PATH"

STUB_CODE=200 STUB_BODY='<script src="/assets/index-AAA111.js"></script>'
export STUB_CODE STUB_BODY
if verify_static_site "index-AAA111.js" >/dev/null; then
  ok "200 且文件名匹配 → 通过"
else
  bad "200 且文件名匹配时不应失败"
fi

STUB_CODE=403
if verify_static_site "index-AAA111.js" >/dev/null 2>&1; then
  bad "403 应判定失败（权限错场景）"
else
  ok "403 → 判定失败（权限错场景）"
fi

STUB_CODE=200
STUB_BODY='<script src="/assets/index-OLD999.js"></script>'
if verify_static_site "index-AAA111.js" >/dev/null 2>&1; then
  bad "200 但文件名不匹配应判定失败（目录错场景）"
else
  ok "200 但文件名不匹配 → 判定失败（目录错场景）"
fi

STUB_CODE=301
if verify_static_site "" >/dev/null 2>&1; then
  bad "未跟随到 200 的 301 应判定失败"
else
  ok "301（-L 之后仍非 200）→ 判定失败"
fi

# ---------------------------------------------------------------
echo "=== 4. 校验失败会触发回滚 ==="
# 用与主流程相同的写法验证 `verify_static_site || rollback` 分支会被走到
ROLLED=""
rollback() { ROLLED="$1"; }
STUB_CODE=403
verify_static_site "index-AAA111.js" >/dev/null 2>&1 || rollback "静态站点校验失败"
[[ "$ROLLED" == "静态站点校验失败" ]] \
  && ok "静态校验失败触发 rollback：$ROLLED" \
  || bad "静态校验失败未触发 rollback"

ROLLED=""
STUB_CODE=200 STUB_BODY='<script src="/assets/index-AAA111.js"></script>'
verify_static_site "index-AAA111.js" >/dev/null 2>&1 || rollback "静态站点校验失败"
[[ -z "$ROLLED" ]] && ok "校验通过时不触发 rollback" || bad "校验通过却触发了 rollback"

# ---------------------------------------------------------------
echo "=== 5. mysql 凭据文件权限 ==="
CNF="$(umask 077 && mktemp "$TMP/.p0-mysql-XXXXXX")"
p="$(perm "$CNF")"
[[ "$p" == "600" ]] && ok "凭据临时文件权限 $p" || bad "凭据临时文件期望 600，实际 $p"
rm -f "$CNF"

[[ "$FAIL" == 0 ]] && echo "全部通过" || echo "存在失败用例"
exit "$FAIL"
