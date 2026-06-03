#!/usr/bin/env bash
# ============================================
#  一键内测部署脚本
#  用法: bash deploy/deploy.sh
# ============================================
set -euo pipefail

# ---- 颜色 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}==== $1 ====${NC}\n"; }

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRODUCTION_ENV="$PROJECT_ROOT/backend/.env"

# ---- 前置检查 ----
step "1/6 前置检查"

# Node.js
command -v node &>/dev/null  || err "Node.js 未安装"
NODE_V=$(node -v)
log "Node.js $NODE_V"

# npm
command -v npm &>/dev/null  || err "npm 未安装"
log "npm $(npm -v)"

# PM2
command -v pm2 &>/dev/null  || {
    warn "PM2 未安装，正在安装..."
    npm install -g pm2
}
log "PM2 $(pm2 -v)"

# MySQL
mysql --version &>/dev/null  || warn "MySQL 客户端未找到，跳过数据库连接检查"
log "MySQL 客户端可用"

# 生产环境配置
if [ ! -f "$PRODUCTION_ENV" ]; then
    warn "backend/.env 不存在，从 .env.production 复制模板"
    cp "$PROJECT_ROOT/backend/.env.production" "$PRODUCTION_ENV"
    echo ""
    err "请先编辑 backend/.env 填写真实配置后重新运行本脚本"
fi
log "生产环境配置已就绪"

# ---- 安装依赖 ----
step "2/6 安装依赖"

log "安装后端依赖..."
cd "$PROJECT_ROOT/backend"
npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -1 || npm install --omit=dev --no-audit --no-fund
log "后端依赖安装完成"

log "安装前端依赖..."
cd "$PROJECT_ROOT/frontend"
npm ci --no-audit --no-fund 2>&1 | tail -1 || npm install --no-audit --no-fund
log "前端依赖安装完成"

# ---- 数据库迁移 ----
step "3/6 数据库迁移"

DB_HOST=$(grep DB_HOST "$PRODUCTION_ENV" | cut -d= -f2)
DB_PORT=$(grep DB_PORT "$PRODUCTION_ENV" | cut -d= -f2)
DB_NAME=$(grep DB_NAME "$PRODUCTION_ENV" | cut -d= -f2)
DB_USER=$(grep DB_USER "$PRODUCTION_ENV" | cut -d= -f2)
DB_PASSWORD=$(grep DB_PASSWORD "$PRODUCTION_ENV" | cut -d= -f2)

MYSQL_CMD="mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER}"
[ -n "$DB_PASSWORD" ] && MYSQL_CMD="$MYSQL_CMD -p${DB_PASSWORD}"

if $MYSQL_CMD -e "SELECT 1" &>/dev/null 2>&1; then
    log "数据库连接成功"
    bash "$PROJECT_ROOT/deploy/scripts/db-migrate.sh"
else
    warn "数据库连接失败，跳过自动迁移。请手动执行 SQL:"
    echo "  ls database/*.sql | sort | while read f; do $MYSQL_CMD $DB_NAME < \$f; done"
fi

# ---- 构建前端 ----
step "4/6 构建前端"

cd "$PROJECT_ROOT/frontend"
log "TypeScript 编译 + Vite 打包..."
npm run build 2>&1 | tail -5
log "前端构建完成 → frontend/dist/"

# ---- 重启后端 ----
step "5/6 启动/重启后端"

cd "$PROJECT_ROOT"
if pm2 list | grep -q "syqw-api"; then
    log "重启 syqw-api..."
    pm2 reload deploy/ecosystem.config.cjs --env production --update-env
else
    log "首次启动 syqw-api..."
    pm2 start deploy/ecosystem.config.cjs --env production
fi
pm2 save --force
log "PM2 进程列表:"
pm2 list

# ---- 健康检查 ----
step "6/6 健康检查"

sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
    log "✅ 后端健康检查通过 (http://localhost:3000/health)"
else
    warn "后端健康检查返回 HTTP $HEALTH，请检查 PM2 日志: pm2 logs syqw-api"
fi

# ---- 完成 ----
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  API 状态:  http://localhost:3000/health"
echo "  PM2 管理:  pm2 list | pm2 logs syqw-api"
echo ""
echo "  下一步:"
echo "  1. 配置 Nginx: sudo cp deploy/nginx/production.conf /etc/nginx/sites-available/syqw"
echo "  2. 启用站点:   sudo ln -sf /etc/nginx/sites-available/syqw /etc/nginx/sites-enabled/"
echo "  3. SSL 证书:   sudo certbot --nginx -d wework.syzs.top"
echo "  4. 重启 Nginx: sudo nginx -t && sudo systemctl reload nginx"
echo "  5. 数据库备份: crontab deploy/scripts/crontab.txt"
echo ""
