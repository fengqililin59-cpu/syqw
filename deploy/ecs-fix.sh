#!/bin/bash
# ===================================
# ECS 快速修复 & 部署脚本
# 在 ECS 服务器上以 root 身份运行
# ===================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

PROJECT_DIR="/opt/syqw"
DEPLOY_DIR="/tmp/syqw-deploy"

echo "========================================"
echo "  ZhiFlow ECS 诊断 & 修复"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

# ============================================
# 步骤 1: 诊断当前状态
# ============================================
info "步骤 1: 诊断当前状态..."

echo "--- PM2 进程列表 ---"
pm2 list 2>/dev/null || warn "PM2 未安装或未运行"

echo ""
echo "--- 端口 3000 监听状态 ---"
ss -tlnp 2>/dev/null | grep ':3000' || warn "端口 3000 无监听"

echo ""
echo "--- 后端进程 ---"
ps aux | grep 'node.*app.js\|node.*backend' | grep -v grep || warn "无后端 node 进程"

echo ""
echo "--- MySQL 连接 ---"
mysqladmin ping -h127.0.0.1 -usyqw_app -p'9jzym8v7ZKri1qjQvZ69lazh' 2>/dev/null && log "MySQL 可连接" || warn "MySQL 连接失败！"

echo ""
echo "--- 磁盘使用 ---"
df -h / | tail -1

echo ""
echo "--- 内存使用 ---"
free -m | head -2

# ============================================
# 步骤 2: 强制重启后端
# ============================================
info "步骤 2: 重启后端以解除冻结..."

if pm2 list 2>/dev/null | grep -q 'syqw-api'; then
    info "发现 syqw-api 进程，强制重启..."
    pm2 restart syqw-api --update-env 2>&1 || {
        warn "重启失败，尝试 kill & 重新启动..."
        pm2 delete syqw-api 2>/dev/null
        cd "$PROJECT_DIR"
        pm2 start deploy/ecosystem.ecs.cjs --env production 2>&1
    }
else
    warn "未找到 syqw-api，尝试启动..."
    if [ -f "$PROJECT_DIR/deploy/ecosystem.ecs.cjs" ]; then
        cd "$PROJECT_DIR"
        pm2 start deploy/ecosystem.ecs.cjs --env production 2>&1
    else
        warn "ecosystem.ecs.cjs 不存在，需要上传新版部署包"
    fi
fi

sleep 3

echo ""
echo "--- PM2 状态 ---"
pm2 list 2>/dev/null | grep syqw-api

# ============================================
# 步骤 3: 验证
# ============================================
info "步骤 3: 验证修复..."

echo -n "本地端口测试: "
RET=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/health 2>&1 || echo "000")
if [ "$RET" = "200" ]; then
    log "后端恢复！(HTTP $RET)"
else
    err "后端仍未响应 (HTTP $RET)，查看日志..."
    echo ""
    info "=== PM2 错误日志（最后20行）==="
    pm2 logs syqw-api --nostream --lines 20 --err 2>/dev/null || echo "(无日志)"
    echo ""
    info "=== PM2 输出日志（最后10行）==="
    pm2 logs syqw-api --nostream --lines 10 --out 2>/dev/null || echo "(无日志)"
    echo ""
    info "请手动检查:"
    echo "  1. cd $PROJECT_DIR/backend && node src/app.js 看启动报错"
    echo "  2. cat .env 确认数据库凭证正确"
    echo "  3. systemctl status mysql 确认 MySQL 运行中"
fi

# ============================================
# 步骤 4: 更新前端（如有新包）
# ============================================
if [ -d "$DEPLOY_DIR/frontend" ]; then
    info "步骤 4: 发现新前端包，正在更新..."
    rm -rf "$PROJECT_DIR/frontend/dist.bak" 2>/dev/null
    mv "$PROJECT_DIR/frontend/dist" "$PROJECT_DIR/frontend/dist.bak" 2>/dev/null
    cp -r "$DEPLOY_DIR/frontend/dist" "$PROJECT_DIR/frontend/"
    log "前端已更新"
elif [ -d "$DEPLOY_DIR/dist" ]; then
    info "步骤 4: 发现新前端 dist，正在更新..."
    rm -rf "$PROJECT_DIR/frontend/dist.bak" 2>/dev/null
    [ -d "$PROJECT_DIR/frontend/dist" ] && mv "$PROJECT_DIR/frontend/dist" "$PROJECT_DIR/frontend/dist.bak"
    cp -r "$DEPLOY_DIR/dist" "$PROJECT_DIR/frontend/dist"
    log "前端已更新"
else
    info "步骤 4: 无新前端包，跳过"
fi

# ============================================
# 步骤 5: 更新后端（如有新包）
# ============================================
if [ -d "$DEPLOY_DIR/backend" ]; then
    info "步骤 5: 发现新后端代码，正在更新..."
    cd "$PROJECT_DIR/backend"
    
    # 备份
    tar czf "/tmp/syqw-backend-bak-$(date +%Y%m%d-%H%M%S).tar.gz" src/ --exclude=node_modules 2>/dev/null
    
    # 更新代码（保留 .env）
    rsync -av --exclude='.env' --exclude='node_modules' --exclude='.git' \
        "$DEPLOY_DIR/backend/" "$PROJECT_DIR/backend/" 2>&1 | tail -3
    
    # 安装依赖
    info "安装依赖..."
    npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -3
    
    # 迁移
    info "执行数据库迁移..."
    bash "$PROJECT_DIR/deploy/scripts/db-migrate.sh" 2>&1 | tail -5
    
    # 重启
    pm2 reload deploy/ecosystem.ecs.cjs --env production --update-env 2>&1
    log "后端已更新并重启"
fi

echo ""
echo "========================================"
echo "  修复完成"
echo "========================================"
echo ""
echo "访问地址:  https://wework.syzs.top"
echo "查看状态:  pm2 list"
echo "查看日志:  pm2 logs syqw-api"
echo ""
