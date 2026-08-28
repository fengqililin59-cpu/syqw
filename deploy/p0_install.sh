#!/usr/bin/env bash
# 美业增长闭环 P0 生产安装脚本（配合 scripts/pack-p0-upload.sh 产出的上传包）
#
# 用法（在 ECS 上，解压后的包目录内）：
#   sudo bash ./p0_install.sh              # 正式安装
#   sudo DRY_RUN=1 bash ./p0_install.sh    # 只探测 + 校验，不改动任何东西
#
# 目标探测：从 nginx 实际配置反查，而不是猜目录。
#   生产真实拓扑是跨栈组合的（历史遗留），务必不要按目录名想当然：
#     wework.syzs.top(主应用) root=/var/www/zhiflow/frontend/dist
#                             API  → 127.0.0.1:3010 = pm2 syqw-api
#                             代码 → /var/www/wework-saas/backend（DB: wework_saas）
#     另一套 zhiflow 栈       pm2 zhiflow-api / 3002 / DB zhiflow_prod，
#                             只被 crm.syzs.top 的 /upload 用到，不接主 API 流量。
#   同一域名下还有第二个 server 块（root=/var/www/zhiflow/landing，反代 3000）是投流落地页。
#
# 逃生舱：可 export BACKEND_DIR / FRONTEND_DIR / PM2_APP 手工指定目标，
#         但三者必须同时给出，避免只给一半导致部署到半套栈上。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date '+%Y%m%d-%H%M%S')"
BACKUP_ROOT="/var/backups/zhiflow-p0-${STAMP}"
SITE_DOMAIN="${SITE_DOMAIN:-wework.syzs.top}"
DRY_RUN="${DRY_RUN:-0}"

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
die()    { red "$*"; exit 1; }

# DRY_RUN 下只打印将要执行的命令
run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf "\033[36m  [dry-run] %s\033[0m\n" "$*"
  else
    "$@"
  fi
}

# ---------------------------------------------------------------
# nginx 配置解析：stdin 读 `nginx -T` 输出，$1 为域名
# 输出（stdout，key=value 行）：
#   cand=<root>|<port>|<location>|<proxy 路径后缀>|<得分>   诊断用，全部候选
#   root=<前端目录>
#   port=<后端端口>
# 选择规则：同域名可能有多个 server 块，取「带主 API 反代」的那个：
#   proxy_pass 不带路径后缀（/health、/upload 这类是探针或子功能）得分最高，
#   location /api 优先于 location /，root 含 landing 的块直接排除。
# ---------------------------------------------------------------
parse_nginx_site() {
  awk -v domain="$1" '
    function process_block(   i, line, loc, root, root_any, sn_match, n, url, port, suffix, score, best, best_port, best_loc, best_suffix) {
      sn_match = 0; root = ""; root_any = ""; loc = ""
      best = -999; best_port = ""; best_loc = ""; best_suffix = ""
      for (i = 1; i <= nb; i++) {
        line = buf[i]
        if (line == "}") loc = ""
        if (line ~ /^server_name[ \t]/) {
          if (line ~ ("(^|[ \t])" domain "([ \t]|;|$)")) sn_match = 1
        }
        if (line ~ /^location[ \t]/) {
          loc = line
          sub(/^location[ \t]+/, "", loc)
          sub(/[ \t]*\{.*$/, "", loc)
          sub(/^[=~^*[:space:]]+/, "", loc)
          sub(/[ \t]+$/, "", loc)
        }
        if (line ~ /^root[ \t]/) {
          n = line; sub(/^root[ \t]+/, "", n); sub(/[ \t]*;.*$/, "", n)
          if (root_any == "") root_any = n
          if (loc == "") root = n
        }
        if (line ~ /^proxy_pass[ \t]/) {
          url = line; sub(/^proxy_pass[ \t]+/, "", url); sub(/[ \t]*;.*$/, "", url)
          if (url ~ /^https?:\/\/127\.0\.0\.1:[0-9]+/) {
            port = url; sub(/^https?:\/\/127\.0\.0\.1:/, "", port); sub(/[^0-9].*$/, "", port)
            suffix = url; sub(/^https?:\/\/127\.0\.0\.1:[0-9]+/, "", suffix)
            score = 0
            if (suffix == "" || suffix == "/") score += 10
            else score -= 10
            if (loc ~ /^\/api/) score += 5
            else if (loc == "/") score += 2
            if (score > best) { best = score; best_port = port; best_loc = loc; best_suffix = suffix }
            if (sn_match) cands[++nc] = root_any "|" port "|" loc "|" suffix "|" score
          }
        }
      }
      if (!sn_match) return
      if (root == "") root = root_any
      if (best_port == "") return
      if (root ~ /landing/) return
      if (best > block_best) {
        block_best = best; sel_root = root; sel_port = best_port; sel_loc = best_loc; sel_suffix = best_suffix
      }
    }

    # 把一行里的 `{` `}` `;` 拆成独立 token，兼容 `location / { proxy_pass ...; }` 这种单行写法
    function handle(p) {
      if (in_srv == 0 && p == "server") { in_srv = 1; srvdepth = depth; nb = 0 }
      if (in_srv) buf[++nb] = p
      if (p == "{") depth++
      else if (p == "}") depth--
      if (in_srv && depth <= srvdepth && nb > 1) { process_block(); in_srv = 0; nb = 0 }
    }

    BEGIN { depth = 0; in_srv = 0; nb = 0; nc = 0; block_best = -999 }
    {
      line = $0
      sub(/#.*$/, "", line)
      gsub(/\{/, "\n{\n", line)
      gsub(/\}/, "\n}\n", line)
      gsub(/;/,  ";\n",   line)
      n = split(line, parts, "\n")
      for (pi = 1; pi <= n; pi++) {
        tok = parts[pi]
        sub(/;[ \t]*$/, "", tok)
        gsub(/^[ \t]+|[ \t]+$/, "", tok)
        if (tok != "") handle(tok)
      }
    }
    END {
      for (i = 1; i <= nc; i++) print "cand=" cands[i]
      if (sel_port != "") { print "root=" sel_root; print "port=" sel_port; print "location=" sel_loc }
    }
  '
}

# ---------------------------------------------------------------
# 按端口反查 PM2：遍历 pm2 jlist，读每个应用 pm_cwd/.env 的 PORT
# stdin 为 pm2 jlist 的 JSON，$1 为端口；输出 "<name>\t<pm_cwd>\t<exec_mode>"
# ---------------------------------------------------------------
pm2_app_by_port() {
  node -e '
    const fs = require("fs");
    let raw = "";
    process.stdin.on("data", d => raw += d).on("end", () => {
      const port = process.argv[1];
      let apps;
      try { apps = JSON.parse(raw); } catch (e) {
        process.stderr.write("pm2 jlist 输出不是合法 JSON\n"); process.exit(3);
      }
      const seen = new Set(), hits = [];
      for (const a of apps) {
        const cwd = a.pm2_env && a.pm2_env.pm_cwd;
        if (!cwd) continue;
        const key = a.name + "|" + cwd;
        if (seen.has(key)) continue;
        seen.add(key);
        let p = null;
        try {
          const m = fs.readFileSync(cwd + "/.env", "utf8")
            .match(/^[ \t]*PORT[ \t]*=[ \t]*"?([0-9]+)"?/m);
          if (m) p = m[1];
        } catch (e) { /* 无 .env 的应用直接跳过 */ }
        if (p === port) hits.push([a.name, cwd, (a.pm2_env && a.pm2_env.exec_mode) || "fork"].join("\t"));
      }
      if (hits.length !== 1) {
        process.stderr.write("按端口 " + port + " 匹配到 " + hits.length + " 个 PM2 应用\n");
        for (const h of hits) process.stderr.write("  " + h + "\n");
        process.exit(4);
      }
      process.stdout.write(hits[0] + "\n");
    });
  ' "$1"
}

# stdin 为 pm2 jlist 的 JSON，$1 为应用名；输出运行该应用的用户名（取不到则输出空）
pm2_user_by_app() {
  node -e '
    let raw = "";
    process.stdin.on("data", d => raw += d).on("end", () => {
      let apps = [];
      try { apps = JSON.parse(raw); } catch (e) { /* 拿不到就回退 */ }
      const a = apps.find(x => x && x.name === process.argv[1]);
      const env = (a && a.pm2_env) || {};
      process.stdout.write(String(env.username || env.USER || ""));
    });
  ' "$1"
}

# ---------------------------------------------------------------
# 目录同步：绝不把打包机的属主/属组/权限带到生产
# 打包机是 macOS（uid 501 / staff / 0700），rsync -a 含 -o -g -p，
# 会把这套元数据原样搬到服务器，nginx(www-data) stat() 失败 → 整站 403。
# ---------------------------------------------------------------
detect_owner() { stat -c '%U:%G' "$1" 2>/dev/null || true; }

# --chmod 必须配合 -p 才生效（rsync 只在「要设置权限」时才套用 --chmod 规则），
# 所以用 -rlpt 保留 -p 而丢掉 -o -g -D；老版本 rsync（如 macOS 自带 openrsync）
# 没有 --chmod，此时退回纯 -rlpt，由后面的显式 chmod 兜底。
rsync_perm_flags() {
  printf '%s\n' '-rlpt'
  if rsync --chmod=D755,F644 --version >/dev/null 2>&1; then
    printf '%s\n' '--chmod=D755,F644'
  fi
}

# 把目录权限规范成 目录 755 / 文件 644，并 chown 到 $2
normalize_tree() {
  local dir="$1" owner="$2"
  run find "$dir" -type d -exec chmod 755 {} +
  run find "$dir" -type f -exec chmod 644 {} +
  run chown -R "$owner" "$dir"
  echo "  ${dir} 属主 → ${owner}，权限 → 目录 755 / 文件 644"
}

# $1 源目录 $2 目标目录 $3 属主 其余参数透传给 rsync
sync_tree() {
  local src="$1" dst="$2" owner="$3"; shift 3
  local flags=()
  while IFS= read -r f; do flags+=("$f"); done < <(rsync_perm_flags)
  run rsync "${flags[@]}" "$@" "$src" "$dst"
  normalize_tree "${dst%/}" "$owner"
}

# ---------------------------------------------------------------
# 静态站点校验：仅看状态码会漏掉「发到了错误目录」（旧站点照样 200），
# 仅比对文件名会漏掉权限错（403 时根本没有 HTML）。两者都查才能同时覆盖。
# $1 期望在首页 HTML 中出现的构建产物文件名，可为空
# ---------------------------------------------------------------
verify_static_site() {
  local expect_asset="${1:-}" code body
  local args=(-s -k -L -m 10
    --resolve "${SITE_DOMAIN}:80:127.0.0.1"
    --resolve "${SITE_DOMAIN}:443:127.0.0.1")
  code="$(curl "${args[@]}" -o /dev/null -w '%{http_code}' "http://${SITE_DOMAIN}/" || echo 000)"
  echo "  静态站点 http://${SITE_DOMAIN}/ -> $code"
  if [[ "$code" != "200" ]]; then
    red "  静态站点未返回 200（403 通常是 dist 属主/权限不对）"
    return 1
  fi
  [[ -n "$expect_asset" ]] || return 0
  body="$(curl "${args[@]}" "http://${SITE_DOMAIN}/" || true)"
  if printf '%s' "$body" | grep -q -- "$expect_asset"; then
    echo "  首页引用构建产物 $expect_asset ✓"
    return 0
  fi
  red "  首页 HTML 未引用本次构建产物 ${expect_asset}（可能发到了错误目录）"
  return 1
}

# 供 deploy/tests/ 单测解析/校验函数用，不执行安装流程
if [[ "${P0_LIB_ONLY:-0}" == "1" ]]; then
  return 0 2>/dev/null || exit 0
fi

[[ -d "$SCRIPT_DIR/backend/src" ]] || die "未找到 backend/src，请在解压后的包目录内运行本脚本"

# ---------------------------------------------------------------
# 1. 探测生产栈
# ---------------------------------------------------------------
yellow "=== [1/8] 探测生产栈（域名：${SITE_DOMAIN}）==="

OVERRIDE_COUNT=0
for v in BACKEND_DIR FRONTEND_DIR PM2_APP; do
  if [[ -n "${!v:-}" ]]; then OVERRIDE_COUNT=$((OVERRIDE_COUNT + 1)); fi
done
if [[ "$OVERRIDE_COUNT" -gt 0 && "$OVERRIDE_COUNT" -lt 3 ]]; then
  red "BACKEND_DIR / FRONTEND_DIR / PM2_APP 必须三者同时指定，当前只给了 $OVERRIDE_COUNT 个："
  echo "  BACKEND_DIR =${BACKEND_DIR:-<未设置>}"
  echo "  FRONTEND_DIR=${FRONTEND_DIR:-<未设置>}"
  echo "  PM2_APP     =${PM2_APP:-<未设置>}"
  die "只覆盖一部分会把代码发到半套栈上（历史事故原因），已中止。"
fi

if [[ "$OVERRIDE_COUNT" == 3 ]]; then
  yellow "  使用外部指定的目标（跳过 nginx 探测）"
  DETECT_SOURCE="手工指定"
  NGINX_PORT=""
else
  command -v nginx >/dev/null 2>&1 || die "未找到 nginx 命令，无法探测；请 export BACKEND_DIR / FRONTEND_DIR / PM2_APP 手工指定"
  command -v node  >/dev/null 2>&1 || die "未找到 node 命令，无法解析 pm2 jlist"

  NGINX_DUMP="$(nginx -T 2>/dev/null)" || die "执行 nginx -T 失败（需要 root），无法探测生产栈"
  PARSED="$(printf '%s\n' "$NGINX_DUMP" | parse_nginx_site "$SITE_DOMAIN")"

  echo "  nginx 候选反代："
  printf '%s\n' "$PARSED" | sed -n 's/^cand=/    /p' || true

  FRONTEND_DIR="$(printf '%s\n' "$PARSED" | sed -n 's/^root=//p' | head -1)"
  NGINX_PORT="$(printf '%s\n' "$PARSED"  | sed -n 's/^port=//p' | head -1)"
  NGINX_LOC="$(printf '%s\n' "$PARSED"   | sed -n 's/^location=//p' | head -1)"
  [[ -n "$FRONTEND_DIR" && -n "$NGINX_PORT" ]] || die "未能从 nginx 配置中解析出 $SITE_DOMAIN 的 root 与主 API 端口，请检查域名或手工指定目标"
  echo "  选定 location : ${NGINX_LOC:-/}"

  PM2_JLIST="$(pm2 jlist 2>/dev/null)" || die "执行 pm2 jlist 失败"
  PM2_INFO="$(printf '%s\n' "$PM2_JLIST" | pm2_app_by_port "$NGINX_PORT")" \
    || die "无法按端口 $NGINX_PORT 唯一确定 PM2 应用，请手工指定目标"
  PM2_APP="$(printf '%s' "$PM2_INFO" | cut -f1)"
  BACKEND_DIR="$(printf '%s' "$PM2_INFO" | cut -f2)"
  PM2_EXEC_MODE="$(printf '%s' "$PM2_INFO" | cut -f3)"
  DETECT_SOURCE="nginx($SITE_DOMAIN) + pm2(port $NGINX_PORT)"

  # 端口的实际监听进程应属于选定的 PM2 应用；lsof 缺失时仅提示
  if command -v lsof >/dev/null 2>&1; then
    LISTEN_PIDS="$(lsof -nP -iTCP:"$NGINX_PORT" -sTCP:LISTEN -t 2>/dev/null | tr '\n' ' ' || true)"
    echo "  端口 $NGINX_PORT 监听 PID: ${LISTEN_PIDS:-<无>}"
    [[ -n "$LISTEN_PIDS" ]] || die "端口 $NGINX_PORT 当前没有进程监听，探测结果不可信"
  else
    yellow "  未安装 lsof，跳过监听进程交叉验证"
  fi
fi

BACKEND_DIR="${BACKEND_DIR%/}"
FRONTEND_DIR="${FRONTEND_DIR%/}"
ENV_FILE="$BACKEND_DIR/.env"
[[ -f "$ENV_FILE" ]] || die "未找到 ${ENV_FILE}，无法读取数据库配置"

get_env() { grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r "' || true; }
DB_HOST=$(get_env DB_HOST); DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=$(get_env DB_PORT); DB_PORT=${DB_PORT:-3306}
DB_USER=$(get_env DB_USER)
DB_PASS=$(get_env DB_PASSWORD)
DB_NAME=$(get_env DB_NAME)
API_PORT=$(get_env PORT)
[[ -n "$API_PORT" ]] || die "$ENV_FILE 中没有 PORT，无法确定 API 端口（不做硬编码兜底）"

PM2_EXEC_MODE="${PM2_EXEC_MODE:-}"
if [[ -z "$PM2_EXEC_MODE" ]]; then
  if pm2 describe "$PM2_APP" 2>/dev/null | grep -qi 'exec mode.*cluster'; then
    PM2_EXEC_MODE="cluster_mode"
  else
    PM2_EXEC_MODE="fork"
  fi
fi

# ---------------------------------------------------------------
# 2. 一致性校验（任何一项对不上就退出，绝不猜测）
# ---------------------------------------------------------------
yellow "=== [2/8] 探测结果与一致性校验 ==="
echo "  探测来源 : $DETECT_SOURCE"
echo "  后端目录 : $BACKEND_DIR"
echo "  前端目录 : $FRONTEND_DIR"
echo "  PM2 应用 : $PM2_APP (exec_mode=$PM2_EXEC_MODE)"
echo "  API 端口 : $API_PORT"
echo "  数据库   : ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

[[ -d "$BACKEND_DIR/src" ]]        || die "后端目录 $BACKEND_DIR 下没有 src/"
[[ -f "$FRONTEND_DIR/index.html" ]] || die "前端目录 $FRONTEND_DIR 下没有 index.html"

if [[ -n "$NGINX_PORT" && "$NGINX_PORT" != "$API_PORT" ]]; then
  die "nginx 反代端口($NGINX_PORT) 与 $ENV_FILE 的 PORT($API_PORT) 不一致，拒绝继续"
fi

HEALTH_CODE=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/health" || echo 000)
echo "  部署前 /health -> $HEALTH_CODE"
[[ "$HEALTH_CODE" == "200" ]] || die "端口 $API_PORT 的 /health 未返回 200，目标可能不对或服务异常"

pm2 describe "$PM2_APP" >/dev/null 2>&1 || die "PM2 中不存在应用 $PM2_APP"

[[ -n "$DB_NAME" && -n "$DB_USER" ]] || die "无法从 .env 解析数据库配置"
# 不走 -p<密码>：既避免每条命令的 Warning，也避免密码短暂出现在 ps 的进程列表里。
# trap 覆盖 EXIT/INT/TERM/HUP，保证 set -e 提前退出或被中断时凭据文件也会被删除。
MYSQL_CNF="$(umask 077 && mktemp "${TMPDIR:-/tmp}/.p0-mysql-XXXXXX")"
trap 'rm -f "$MYSQL_CNF"' EXIT INT TERM HUP
cat > "$MYSQL_CNF" <<EOF
[client]
host=$DB_HOST
port=$DB_PORT
user=$DB_USER
password=$DB_PASS
EOF
MYSQL=(mysql --defaults-extra-file="$MYSQL_CNF" "$DB_NAME")
"${MYSQL[@]}" -e "SELECT 1" >/dev/null || die "数据库 $DB_NAME 连接失败"
green "  校验通过"

if [[ "$DRY_RUN" == "1" ]]; then
  yellow ""
  yellow "DRY_RUN=1：以下操作将被跳过，仅打印"
fi

# ---------------------------------------------------------------
# 3. 备份
# ---------------------------------------------------------------
yellow "=== [3/8] 备份当前版本 ==="
run mkdir -p "$BACKUP_ROOT"
run tar czf "$BACKUP_ROOT/backend-src.tar.gz" -C "$BACKEND_DIR" src
# 备份 dist 内容而非目录本身：回滚时不删除目录 inode，避免 nginx root 指向失效
run tar czf "$BACKUP_ROOT/frontend-dist.tar.gz" -C "$FRONTEND_DIR" .
if [[ "$DRY_RUN" != "1" ]]; then
  "${MYSQL[@]}" -e "SHOW CREATE TABLE customers\G" > "$BACKUP_ROOT/customers-schema-before.txt" 2>/dev/null || true
  "${MYSQL[@]}" -N -e "SELECT COUNT(*) FROM customers" > "$BACKUP_ROOT/customers-count-before.txt" 2>/dev/null || true
fi
green "  备份已写入 $BACKUP_ROOT"

# ---------------------------------------------------------------
# 4. 数据库迁移
# ---------------------------------------------------------------
yellow "=== [4/8] 执行数据库迁移（幂等，目标库 ${DB_NAME}）==="
# 按文件名排序执行包内全部迁移，避免新增迁移时漏改这里。
# 不用 mapfile：macOS 自带 bash 3.2 没有该内建，本地测试会跑不到这段。
MIGRATIONS=()
while IFS= read -r f; do
  MIGRATIONS+=("$f")
done < <(find "$SCRIPT_DIR/database" -maxdepth 1 -name '*.sql' -type f | sort)
[[ ${#MIGRATIONS[@]} -gt 0 ]] || die "包内 database/ 下没有迁移文件"
for MIGRATION in "${MIGRATIONS[@]}"; do
  if [[ "$DRY_RUN" == "1" ]]; then
    run mysql "...$DB_NAME < $MIGRATION"
  else
    echo "  执行 $(basename "$MIGRATION")"
    "${MYSQL[@]}" < "$MIGRATION"
  fi
done

if [[ "$DRY_RUN" != "1" ]]; then
  green "  迁移完成，校验关键表："
  for t in appointments customer_cards card_transactions service_records staff_schedules \
           products notifications approval_templates approval_instances; do
    cnt=$("${MYSQL[@]}" -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='$t'")
    [[ "$cnt" == "1" ]] && echo "    ✓ $t" || die "    ✗ $t 未创建"
  done
  echo "  customers 新增列："
  "${MYSQL[@]}" -N -e "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='customers' AND COLUMN_NAME IN ('next_appointment_at','last_visit_at','visit_count','total_paid_amount')" | sed 's/^/    ✓ /'
fi

# ---------------------------------------------------------------
# 5. 同步代码
# ---------------------------------------------------------------
yellow "=== [5/8] 同步后端源码与前端静态 ==="
# 属主取目标目录当前值，不硬编码；探测不到时前端回退 root:root，后端回退 PM2 进程用户
FRONTEND_OWNER="$(detect_owner "$FRONTEND_DIR")"
FRONTEND_OWNER="${FRONTEND_OWNER:-root:root}"
BACKEND_OWNER="$(detect_owner "$BACKEND_DIR/src")"
if [[ -z "$BACKEND_OWNER" ]]; then
  PM2_USER="$(pm2 jlist 2>/dev/null | pm2_user_by_app "$PM2_APP" || true)"
  BACKEND_OWNER="${PM2_USER:+$PM2_USER:$PM2_USER}"
  BACKEND_OWNER="${BACKEND_OWNER:-root:root}"
fi
echo "  同步后将恢复属主：前端 $FRONTEND_OWNER / 后端 $BACKEND_OWNER"

sync_tree "$SCRIPT_DIR/backend/src/" "$BACKEND_DIR/src/" "$BACKEND_OWNER" --exclude='.env'
run cp "$SCRIPT_DIR/backend/package.json" "$BACKEND_DIR/package.json"
if [[ -f "$SCRIPT_DIR/backend/package-lock.json" ]]; then
  run cp "$SCRIPT_DIR/backend/package-lock.json" "$BACKEND_DIR/package-lock.json"
fi
sync_tree "$SCRIPT_DIR/frontend/dist/" "$FRONTEND_DIR/" "$FRONTEND_OWNER" --delete

if [[ "$DRY_RUN" != "1" ]]; then
  FRONTEND_ASSET="$(grep -o 'index-[^"]*\.js' "$FRONTEND_DIR/index.html" | head -1)"
  green "  前端版本: ${FRONTEND_ASSET:-<未识别>}"
else
  FRONTEND_ASSET=""
fi

# ---------------------------------------------------------------
# 6. 依赖
# ---------------------------------------------------------------
yellow "=== [6/8] 安装生产依赖 ==="
if [[ "$DRY_RUN" == "1" ]]; then
  run npm install --omit=dev --prefer-offline "（cwd=${BACKEND_DIR}）"
else
  cd "$BACKEND_DIR"
  npm install --omit=dev --prefer-offline 2>&1 | tail -8
fi

# ---------------------------------------------------------------
# 7. 重启
# ---------------------------------------------------------------
yellow "=== [7/8] 重启 API ==="
# cluster 模式用 reload 逐实例滚动重启，避免 2 个实例同时下线出现 502
restart_api() {
  if [[ "$PM2_EXEC_MODE" == "cluster_mode" || "$PM2_EXEC_MODE" == "cluster" ]]; then
    run pm2 reload "$PM2_APP" --update-env
  else
    run pm2 restart "$PM2_APP" --update-env
  fi
}
restart_api
[[ "$DRY_RUN" == "1" ]] || sleep 8

# ---------------------------------------------------------------
# 8. 健康检查（失败则回滚代码）
# ---------------------------------------------------------------
yellow "=== [8/8] 健康检查（后端 /health + nginx 静态站点）==="
if [[ "$DRY_RUN" == "1" ]]; then
  run curl "http://127.0.0.1:${API_PORT}/health"
  run curl "--resolve ${SITE_DOMAIN}:80:127.0.0.1 http://${SITE_DOMAIN}/ （校验 200 + 首页引用的 index-*.js）"
  green ""
  green "✅ DRY_RUN 完成：探测与校验均通过，未改动任何东西。确认目标无误后去掉 DRY_RUN 重跑。"
  exit 0
fi

# 备份是在服务器上打的，归档内元数据本来就正确；tar 以 root 解开时默认 --same-owner，
# 属主会照归档恢复。这里仍再规范一次，避免历史遗留的错误权限被原样还原回去。
rollback() {
  red "$1，正在回滚代码…"
  pm2 logs "$PM2_APP" --err --lines 40 --nostream || true
  rm -rf "$BACKEND_DIR/src"
  tar xzf "$BACKUP_ROOT/backend-src.tar.gz" -C "$BACKEND_DIR"
  normalize_tree "$BACKEND_DIR/src" "$BACKEND_OWNER"
  find "$FRONTEND_DIR" -mindepth 1 -delete
  tar xzf "$BACKUP_ROOT/frontend-dist.tar.gz" -C "$FRONTEND_DIR"
  normalize_tree "$FRONTEND_DIR" "$FRONTEND_OWNER"
  restart_api
  sleep 8

  yellow "  回滚后复验："
  local back_code
  back_code=$(curl -s -m 10 -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/health" || echo 000)
  echo "  /health -> $back_code"
  verify_static_site "" || red "  回滚后静态站点仍不可用，需要人工介入"
  [[ "$back_code" == "200" ]] || red "  回滚后 /health 仍非 200，需要人工介入"

  red "已回滚到部署前版本。数据库新增表/列保留，不影响旧逻辑。"
  red "备份目录：$BACKUP_ROOT"
  exit 1
}

CODE=$(curl -s -m 10 -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/health" || echo 000)
echo "  /health -> $CODE"
[[ "$CODE" == "200" ]] || rollback "后端健康检查失败"

verify_static_site "$FRONTEND_ASSET" || rollback "静态站点校验失败"

green ""
green "✅ P0 部署完成"
echo "备份目录（确认无误后可删除）：$BACKUP_ROOT"
echo ""
echo "下一步："
echo "  1. 浏览器打开站点，确认侧边栏出现：今日到店 / 预约档期 / 复购提醒台"
echo "  2. 首页应为「经营驾驶舱」，原报表在 /app/dashboard"
echo "  3. 给角色授予新权限码后功能才可见："
echo "     appointment:view appointment:edit card:view card:edit card:adjust cockpit:view"
echo "  4. 确认无误后再开启每日复购扫描（默认关闭）："
echo "     echo 'ENABLE_REPURCHASE_SCAN_CRON=1' >> $ENV_FILE && pm2 restart $PM2_APP --update-env"
