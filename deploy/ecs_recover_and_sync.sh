#!/usr/bin/env bash
# 一键：修复 syqw-api（DB 鉴权 + PM2 路径）→ 从 GitHub 同步最新前后端 → 健康检查
# 用法（阿里云 Workbench / 已登录 root 的 shell）：
#   bash /var/www/wework-saas/deploy/ecs_recover_and_sync.sh
# 或先上传本脚本再执行。
set -euo pipefail

ROOT="/var/www/wework-saas"
BACKEND="$ROOT/backend"
ENVF="$BACKEND/.env"
DEPLOY="$ROOT/deploy"
REPO="${REPO_URL:-https://github.com/fengqililin59-cpu/syqw.git}"
TMP="/tmp/syqw-deploy-$$"
WEB_HTTPS="/var/www/zhiflow/frontend/dist"
WEB_HTTP="/var/www/wework"

die() { echo "ERROR: $*" >&2; exit 1; }
ok() { echo "✅ $*"; }

[[ -d "$BACKEND" ]] || die "缺少 $BACKEND"
[[ -f "$ENVF" ]] || die "缺少 $ENVF"

echo "=== [0] 对齐 Nginx 上游端口与 .env PORT ==="
NGINX_PORT=$(
  nginx -T 2>/dev/null | grep -E 'proxy_pass\s+http://127\.0\.0\.1:[0-9]+' \
    | grep -Eo ':[0-9]+' | head -1 | tr -d ':' || true
)
NGINX_PORT=${NGINX_PORT:-3010}
if grep -q '^PORT=' "$ENVF"; then
  sed -i "s/^PORT=.*/PORT=${NGINX_PORT}/" "$ENVF"
else
  echo "PORT=${NGINX_PORT}" >> "$ENVF"
fi
ok "PORT=${NGINX_PORT}"

echo "=== [1] 修复 DB 账号与 .env 一致 ==="
DB_USER=$(grep -m1 '^DB_USER=' "$ENVF" | cut -d= -f2- | tr -d '\r')
DB_PASS=$(grep -m1 '^DB_PASSWORD=' "$ENVF" | cut -d= -f2- | tr -d '\r')
DB_HOST=$(grep -m1 '^DB_HOST=' "$ENVF" | cut -d= -f2- | tr -d '\r')
DB_NAME=$(grep -m1 '^DB_NAME=' "$ENVF" | cut -d= -f2- | tr -d '\r')
DB_HOST=${DB_HOST:-127.0.0.1}
DB_NAME=${DB_NAME:-wework_saas}
DB_USER=${DB_USER:-syqw_app}
[[ -n "$DB_PASS" ]] || die "DB_PASSWORD 为空"

if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e 'SELECT 1' &>/dev/null; then
  ok "MySQL 鉴权已通过"
else
  echo "MySQL 拒绝当前 .env 密码，尝试用 root 套接字把账号密码对齐到 .env …"
  mysql -u root <<SQL
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e 'SELECT 1' \
    || die "对齐后仍无法连接 MySQL"
  ok "已对齐 MySQL 密码到 .env"
fi

# 确保用 TCP 127.0.0.1（避免 localhost→socket 与 user@'%' 差异）
sed -i 's/^DB_HOST=.*/DB_HOST=127.0.0.1/' "$ENVF"
grep -q '^DB_HOST=' "$ENVF" || echo 'DB_HOST=127.0.0.1' >> "$ENVF"

echo "=== [2] 从 GitHub 同步最新代码 ==="
rm -rf "$TMP"
git clone --depth=1 "$REPO" "$TMP"

echo "--- 构建前端 ---"
cd "$TMP/frontend"
npm install --prefer-offline 2>&1 | tail -8
npm run build

mkdir -p "$WEB_HTTPS" "$WEB_HTTP"
rsync -a --delete "$TMP/frontend/dist/" "$WEB_HTTPS/"
rsync -a --delete "$TMP/frontend/dist/" "$WEB_HTTP/"
ok "前端: $(grep -oE 'index-[^\"/]+\.js' "$WEB_HTTPS/index.html" | head -1)"

echo "--- 同步后端源码 & deploy 脚本 ---"
rsync -a --exclude='.env' --exclude='node_modules' "$TMP/backend/src/" "$BACKEND/src/"
# 同步 package.json 后按需安装依赖
if ! cmp -s "$TMP/backend/package.json" "$BACKEND/package.json" 2>/dev/null; then
  cp "$TMP/backend/package.json" "$BACKEND/package.json"
  cp "$TMP/backend/package-lock.json" "$BACKEND/package-lock.json" 2>/dev/null || true
  cd "$BACKEND" && npm install --omit=dev --prefer-offline 2>&1 | tail -8
fi
rsync -a "$TMP/deploy/" "$DEPLOY/"
ok "后端与 deploy 已同步"

echo "=== [3] 付费墙 / 计费 schema 兜底（幂等）==="
if [[ -f "$TMP/database/098_paywall_plans.sql" ]]; then
  mysql -h 127.0.0.1 -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$TMP/database/098_paywall_plans.sql" \
    && ok "098_paywall_plans 已执行" || echo "WARN: 098 执行有告警（可忽略已存在对象）"
fi
if [[ -f "$DEPLOY/ecs_fix_billing.sql" ]]; then
  mysql -h 127.0.0.1 -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$DEPLOY/ecs_fix_billing.sql" \
    && ok "ecs_fix_billing 已执行" || echo "WARN: billing fix 有告警"
fi

echo "=== [4] 用绝对路径重建 PM2 syqw-api ==="
pm2 delete syqw-api 2>/dev/null || true
cd "$BACKEND"
# 写一份 ECS 专用 ecosystem，避免相对路径 cwd 跑偏
cat > "$DEPLOY/ecosystem.wework-saas.cjs" <<EOF
module.exports = {
  apps: [{
    name: 'syqw-api',
    cwd: '${BACKEND}',
    script: 'src/app.js',
    node_args: '--max-old-space-size=512',
    instances: 2,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '400M',
    max_restarts: 20,
    restart_delay: 3000,
    kill_timeout: 10000,
    env: { NODE_ENV: 'production' },
    env_production: { NODE_ENV: 'production' },
  }],
};
EOF
pm2 start "$DEPLOY/ecosystem.wework-saas.cjs" --env production
pm2 save
sleep 6

echo "=== [5] 健康检查 ==="
HTTP=$(curl -s -o /tmp/syqw_health.json -w '%{http_code}' "http://127.0.0.1:${NGINX_PORT}/health" || echo 000)
echo "local health HTTP=${HTTP} body=$(head -c 200 /tmp/syqw_health.json 2>/dev/null || true)"
[[ "$HTTP" == "200" ]] || {
  echo "--- pm2 ---"; pm2 list
  echo "--- recent errors ---"; pm2 logs syqw-api --err --lines 30 --nostream || true
  die "本地健康检查失败"
}

PUB=$(curl -sk -o /dev/null -w '%{http_code}' https://wework.syzs.top/health || echo 000)
PUB_API=$(curl -sk -o /dev/null -w '%{http_code}' https://wework.syzs.top/api/v1/auth/register/options || echo 000)
echo "public /health=${PUB}  /api/v1/auth/register/options=${PUB_API}"

rm -rf "$TMP"
ok "恢复并同步完成（commit 以 GitHub main 为准）"
echo ""
echo "建议再跑：bash $DEPLOY/ecs_check_payment_and_register.sh"
echo "计费页验证：https://wework.syzs.top/app/billing"
