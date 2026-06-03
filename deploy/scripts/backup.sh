#!/usr/bin/env bash
# ============================================
#  MySQL 数据库备份脚本
#  用法: bash deploy/scripts/backup.sh
#  自动保留最近 7 天的每日备份 + 4 周的每周备份
# ============================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/opt/syqw/backups}"
PRODUCTION_ENV="$PROJECT_ROOT/backend/.env"

# ---- 加载数据库配置 ----
DB_HOST=$(grep '^DB_HOST=' "$PRODUCTION_ENV" | cut -d= -f2 | tr -d ' ')
DB_PORT=$(grep '^DB_PORT=' "$PRODUCTION_ENV" | cut -d= -f2 | tr -d ' ')
DB_NAME=$(grep '^DB_NAME=' "$PRODUCTION_ENV" | cut -d= -f2 | tr -d ' ')
DB_USER=$(grep '^DB_USER=' "$PRODUCTION_ENV" | cut -d= -f2 | tr -d ' ')
DB_PASSWORD=$(grep '^DB_PASSWORD=' "$PRODUCTION_ENV" | cut -d= -f2 | tr -d ' ')

: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=3306}"
: "${DB_NAME:=wework_saas}"
: "${DB_USER:=root}"

MYSQLDUMP_CMD="mysqldump -h${DB_HOST} -P${DB_PORT} -u${DB_USER}"
[ -n "$DB_PASSWORD" ] && MYSQLDUMP_CMD="$MYSQLDUMP_CMD -p${DB_PASSWORD}"

# ---- 创建备份目录 ----
mkdir -p "$BACKUP_DIR"/{daily,weekly}

# ---- 备份文件名 ----
DATE=$(date +%Y%m%d)
WEEK=$(date +%Y-W%U)
BACKUP_FILE="$BACKUP_DIR/daily/${DB_NAME}_${DATE}.sql.gz"
WEEKLY_FILE="$BACKUP_DIR/weekly/${DB_NAME}_${WEEK}.sql.gz"

# ---- 执行备份 ----
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始备份 $DB_NAME..."

$MYSQLDUMP_CMD \
    --single-transaction \
    --quick \
    --skip-lock-tables \
    --routines \
    --triggers \
    --events \
    "$DB_NAME" 2>/dev/null | gzip > "$BACKUP_FILE"

# 验证备份
if gzip -t "$BACKUP_FILE" 2>/dev/null; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 备份成功: $BACKUP_FILE ($BACKUP_SIZE)"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 备份失败！"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# ---- 周日创建周备份 ----
if [ "$(date +%u)" = "7" ]; then
    cp "$BACKUP_FILE" "$WEEKLY_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📦 周备份: $WEEKLY_FILE"
fi

# ---- 清理过期备份 ----
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 清理旧备份..."

# 保留最近 7 天的每日备份
find "$BACKUP_DIR/daily" -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true

# 保留最近 4 周的每周备份
find "$BACKUP_DIR/weekly" -name "*.sql.gz" -mtime +28 -delete 2>/dev/null || true

# 统计
DAILY_COUNT=$(find "$BACKUP_DIR/daily" -name "*.sql.gz" | wc -l | tr -d ' ')
WEEKLY_COUNT=$(find "$BACKUP_DIR/weekly" -name "*.sql.gz" | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 当前: 日备份 $DAILY_COUNT 份, 周备份 $WEEKLY_COUNT 份, 总计 $TOTAL_SIZE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份完成！"
