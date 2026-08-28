#!/usr/bin/env bash
# 美业增长闭环 P0 生产安装脚本（配合 scripts/pack-p0-upload.sh 产出的上传包）
#
# 用法（在 ECS 上，解压后的包目录内）：
#   sudo bash ./p0_install.sh
#
# 特性：
#   - 自动探测生产栈（zhiflow / wework-saas）
#   - 安装前备份后端 src、前端 dist、以及将被改动的 customers 表结构
#   - 数据库迁移幂等，可重复执行
#   - 健康检查失败自动回滚代码（数据库新增表/列保留，不影响旧逻辑）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date '+%Y%m%d-%H%M%S')"
BACKUP_ROOT="/var/backups/zhiflow-p0-${STAMP}"

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }

[[ -d "$SCRIPT_DIR/backend/src" ]] || { red "未找到 backend/src，请在解压后的包目录内运行本脚本"; exit 1; }

# ---------------------------------------------------------------
# 1. 探测生产栈
# ---------------------------------------------------------------
yellow "=== [1/7] 探测生产栈 ==="
if [[ -n "${BACKEND_DIR:-}" ]]; then
  : # 允许外部覆盖
elif [[ -d /var/www/zhiflow/backend/src ]]; then
  BACKEND_DIR=/var/www/zhiflow/backend
  FRONTEND_DIR=${FRONTEND_DIR:-/var/www/zhiflow/frontend/dist}
  PM2_APP=${PM2_APP:-zhiflow-api}
elif [[ -d /var/www/wework-saas/backend/src ]]; then
  BACKEND_DIR=/var/www/wework-saas/backend
  FRONTEND_DIR=${FRONTEND_DIR:-/var/www/zhiflow/frontend/dist}
  PM2_APP=${PM2_APP:-syqw-api}
else
  red "未找到已知的后端目录，请手动 export BACKEND_DIR / FRONTEND_DIR / PM2_APP 后重跑"
  exit 1
fi
ENV_FILE="$BACKEND_DIR/.env"
[[ -f "$ENV_FILE" ]] || { red "未找到 $ENV_FILE，无法读取数据库配置"; exit 1; }

# 从 .env 读取配置（不打印敏感值）
get_env() { grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r "' || true; }
DB_HOST=$(get_env DB_HOST); DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=$(get_env DB_PORT); DB_PORT=${DB_PORT:-3306}
DB_USER=$(get_env DB_USER)
DB_PASS=$(get_env DB_PASSWORD)
DB_NAME=$(get_env DB_NAME)
API_PORT=$(get_env PORT)
API_PORT=${API_PORT:-$([[ "$PM2_APP" == "zhiflow-api" ]] && echo 3002 || echo 3010)}

echo "  后端目录 : $BACKEND_DIR"
echo "  前端目录 : $FRONTEND_DIR"
echo "  PM2 应用 : $PM2_APP"
echo "  API 端口 : $API_PORT"
echo "  数据库   : ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
[[ -n "$DB_NAME" && -n "$DB_USER" ]] || { red "无法从 .env 解析数据库配置"; exit 1; }

MYSQL=(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME")
"${MYSQL[@]}" -e "SELECT 1" >/dev/null || { red "数据库连接失败"; exit 1; }

# ---------------------------------------------------------------
# 2. 备份
# ---------------------------------------------------------------
yellow "=== [2/7] 备份当前版本 ==="
mkdir -p "$BACKUP_ROOT"
tar czf "$BACKUP_ROOT/backend-src.tar.gz" -C "$BACKEND_DIR" src
tar czf "$BACKUP_ROOT/frontend-dist.tar.gz" -C "$(dirname "$FRONTEND_DIR")" "$(basename "$FRONTEND_DIR")"
# 只备份将被改动的 customers 表（全库备份太重，此处仅存结构 + 行数基线）
"${MYSQL[@]}" -e "SHOW CREATE TABLE customers\G" > "$BACKUP_ROOT/customers-schema-before.txt" 2>/dev/null || true
"${MYSQL[@]}" -N -e "SELECT COUNT(*) FROM customers" > "$BACKUP_ROOT/customers-count-before.txt" 2>/dev/null || true
green "  备份已写入 $BACKUP_ROOT"

# ---------------------------------------------------------------
# 3. 数据库迁移
# ---------------------------------------------------------------
yellow "=== [3/7] 执行数据库迁移（幂等）==="
MIGRATION="$SCRIPT_DIR/database/100_beauty_appointments_cards.sql"
[[ -f "$MIGRATION" ]] || { red "缺少迁移文件 $MIGRATION"; exit 1; }
"${MYSQL[@]}" < "$MIGRATION"
green "  迁移完成，校验新表："
for t in appointments customer_cards card_transactions service_records staff_schedules; do
  cnt=$("${MYSQL[@]}" -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='$t'")
  [[ "$cnt" == "1" ]] && echo "    ✓ $t" || { red "    ✗ $t 未创建"; exit 1; }
done
echo "  customers 新增列："
"${MYSQL[@]}" -N -e "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='customers' AND COLUMN_NAME IN ('next_appointment_at','last_visit_at','visit_count','total_paid_amount')" | sed 's/^/    ✓ /'

# ---------------------------------------------------------------
# 4. 同步代码
# ---------------------------------------------------------------
yellow "=== [4/7] 同步后端源码与前端静态 ==="
rsync -a --exclude='.env' "$SCRIPT_DIR/backend/src/" "$BACKEND_DIR/src/"
cp "$SCRIPT_DIR/backend/package.json" "$BACKEND_DIR/package.json"
[[ -f "$SCRIPT_DIR/backend/package-lock.json" ]] && cp "$SCRIPT_DIR/backend/package-lock.json" "$BACKEND_DIR/package-lock.json"
rsync -a --delete "$SCRIPT_DIR/frontend/dist/" "$FRONTEND_DIR/"
green "  前端版本: $(grep -o 'index-[^"]*\.js' "$FRONTEND_DIR/index.html" | head -1)"

# ---------------------------------------------------------------
# 5. 依赖
# ---------------------------------------------------------------
yellow "=== [5/7] 安装生产依赖 ==="
cd "$BACKEND_DIR"
npm install --omit=dev --prefer-offline 2>&1 | tail -8

# ---------------------------------------------------------------
# 6. 重启
# ---------------------------------------------------------------
yellow "=== [6/7] 重启 API ==="
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  pm2 start "$BACKEND_DIR/src/app.js" --name "$PM2_APP" -i 2 --cwd "$BACKEND_DIR" --update-env
  pm2 save
fi
sleep 8

# ---------------------------------------------------------------
# 7. 健康检查（失败则回滚代码）
# ---------------------------------------------------------------
yellow "=== [7/7] 健康检查 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/health" || echo 000)
echo "  /health -> $CODE"
if [[ "$CODE" != "200" ]]; then
  red "健康检查失败，正在回滚代码…"
  pm2 logs "$PM2_APP" --err --lines 40 --nostream || true
  rm -rf "$BACKEND_DIR/src"
  tar xzf "$BACKUP_ROOT/backend-src.tar.gz" -C "$BACKEND_DIR"
  rm -rf "$FRONTEND_DIR"
  tar xzf "$BACKUP_ROOT/frontend-dist.tar.gz" -C "$(dirname "$FRONTEND_DIR")"
  pm2 restart "$PM2_APP" --update-env
  red "已回滚到部署前版本。数据库新增表/列保留，不影响旧逻辑。"
  red "备份目录：$BACKUP_ROOT"
  exit 1
fi

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
