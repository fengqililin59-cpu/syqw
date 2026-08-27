#!/usr/bin/env bash
# 一键重种演示数据（仅租户 9999，不影响真实付费租户）
# Workbench：bash /var/www/wework-saas/deploy/ecs_reseed_demo.sh
# 或从 GitHub 拉最新后执行
set -euo pipefail

ROOT="${WEWORK_ROOT:-/var/www/wework-saas}"
BACKEND="$ROOT/backend"
ENVF="$BACKEND/.env"
SQL_LOCAL="$ROOT/deploy/sql/099_demo_reseed_safe.sql"
SQL_DB="$ROOT/database/099_demo_reseed_safe.sql"
TMP_SQL="/tmp/099_demo_reseed_safe.sql"

die() { echo "ERROR: $*" >&2; exit 1; }
ok() { echo "✅ $*"; }

[[ -f "$ENVF" ]] || die "缺少 $ENVF"

U=$(grep -m1 '^DB_USER=' "$ENVF" | cut -d= -f2- | tr -d '\r')
P=$(grep -m1 '^DB_PASSWORD=' "$ENVF" | cut -d= -f2- | tr -d '\r')
D=$(grep -m1 '^DB_NAME=' "$ENVF" | cut -d= -f2- | tr -d '\r')
H=$(grep -m1 '^DB_HOST=' "$ENVF" | cut -d= -f2- | tr -d '\r')
H=${H:-127.0.0.1}
[[ -n "$U" && -n "$P" && -n "$D" ]] || die "DB_ 配置不完整"

# 定位 SQL
SQL=""
for cand in "$SQL_LOCAL" "$SQL_DB" "$BACKEND/../database/099_demo_reseed_safe.sql" /tmp/syqw-demo/database/099_demo_reseed_safe.sql; do
  if [[ -f "$cand" ]]; then SQL="$cand"; break; fi
done
if [[ -z "$SQL" ]]; then
  echo "本地无 SQL，从 GitHub 拉取…"
  rm -rf /tmp/syqw-demo-reseed
  git clone --depth=1 https://github.com/fengqililin59-cpu/syqw.git /tmp/syqw-demo-reseed
  SQL=/tmp/syqw-demo-reseed/database/099_demo_reseed_safe.sql
fi
[[ -f "$SQL" ]] || die "找不到 099_demo_reseed_safe.sql"
cp "$SQL" "$TMP_SQL"

echo "=== [1] 确保演示相关列存在 ==="
mysql -h "$H" -u "$U" -p"$P" "$D" <<'SQL'
SET NAMES utf8mb4;
SET @c := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='tenants' AND column_name='is_demo');
SET @s := IF(@c=0,'ALTER TABLE tenants ADD COLUMN is_demo TINYINT(1) NOT NULL DEFAULT 0','SELECT 1');
PREPARE x FROM @s; EXECUTE x; DEALLOCATE PREPARE x;

SET @c := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='demo_mode');
SET @s := IF(@c=0,'ALTER TABLE users ADD COLUMN demo_mode TINYINT(1) NOT NULL DEFAULT 1','SELECT 1');
PREPARE x FROM @s; EXECUTE x; DEALLOCATE PREPARE x;

SET @c := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='role');
SET @s := IF(@c=0,'ALTER TABLE users ADD COLUMN `role` VARCHAR(32) NULL','SELECT 1');
PREPARE x FROM @s; EXECUTE x; DEALLOCATE PREPARE x;
SQL
ok "列检查完成"

echo "=== [2] 尝试创建演示租户默认角色 ==="
mysql -h "$H" -u "$U" -p"$P" "$D" -e "CALL create_default_roles_for_tenant(9999);" 2>/dev/null \
  && ok "角色存储过程已执行" \
  || echo "WARN: create_default_roles_for_tenant 不可用（可忽略）"

echo "=== [3] 重种演示数据（仅 tenant 9999）==="
# 若 customers 无 updated_at 列则去掉该列
if ! mysql -h "$H" -u "$U" -p"$P" "$D" -N -e "SHOW COLUMNS FROM customers LIKE 'updated_at'" | grep -q updated_at; then
  sed -i 's/, updated_at//' "$TMP_SQL"
  sed -i 's/,NOW())/);/' "$TMP_SQL" || true
fi
mysql -h "$H" -u "$U" -p"$P" "$D" < "$TMP_SQL"
ok "SQL 执行完成"

echo "=== [4] 结果核对 ==="
mysql -h "$H" -u "$U" -p"$P" "$D" -e "
SELECT id,name,is_demo FROM tenants WHERE id=9999;
SELECT id,tenant_id,username,status FROM users WHERE id IN (9997,9998);
SELECT stage, COUNT(*) cnt FROM customers WHERE tenant_id=9999 GROUP BY stage;
SELECT COUNT(*) AS follow_ups FROM customer_follow_ups fu
  JOIN customers c ON c.id=fu.customer_id WHERE c.tenant_id=9999;
SELECT COUNT(*) AS alerts FROM intent_alerts WHERE tenant_id=9999;
"

echo "=== [5] 访客登录冒烟 ==="
PORT=$(grep -m1 '^PORT=' "$ENVF" | cut -d= -f2- | tr -d '\r' || true)
PORT=${PORT:-3010}
curl -sS -m 8 -X POST "http://127.0.0.1:${PORT}/api/v1/auth/guest-login" \
  -H 'Content-Type: application/json' -d '{}' | head -c 200
echo
ok "演示数据已就绪。打开 https://wework.syzs.top/login → 免费体验演示系统"
