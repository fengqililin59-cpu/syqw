#!/usr/bin/env bash
# ============================================
#  数据库迁移脚本
#  用法: bash deploy/scripts/db-migrate.sh
# ============================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PRODUCTION_ENV="$PROJECT_ROOT/backend/.env"

# ---- 加载数据库配置 ----
DB_HOST=$(grep '^DB_HOST=' "$PRODUCTION_ENV" | cut -d= -f2 | tr -d ' ')
DB_PORT=$(grep '^DB_PORT=' "$PRODUCTION_ENV" | cut -d= -f2 | tr -d ' ')
DB_NAME=$(grep '^DB_NAME=' "$PRODUCTION_ENV" | cut -d= -f2 | tr -d ' ')
DB_USER=$(grep '^DB_USER=' "$PRODUCTION_ENV" | cut -d= -f2 | tr -d ' ')
DB_PASSWORD=$(grep '^DB_PASSWORD=' "$PRODUCTION_ENV" | cut -d= -f2 | tr -d ' ')

MYSQL_CMD="mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -D${DB_NAME}"
[ -n "$DB_PASSWORD" ] && MYSQL_CMD="$MYSQL_CMD -p${DB_PASSWORD}"

# ---- 迁移记录表（幂等）----
$MYSQL_CMD -e "
CREATE TABLE IF NOT EXISTS schema_migrations (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    filename  VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
" 2>/dev/null

echo "[$(date '+%H:%M:%S')] 开始执行数据库迁移..."

COUNT=0
MIGRATIONS_DIR="$PROJECT_ROOT/database"

for file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
    FILENAME=$(basename "$file")

    # 跳过已执行的
    ALREADY_RUN=$($MYSQL_CMD -N -e "SELECT COUNT(*) FROM schema_migrations WHERE filename='$FILENAME';" 2>/dev/null || echo "0")
    if [ "$ALREADY_RUN" -gt 0 ]; then
        echo "  ⏭  跳过 ${FILENAME} (已执行)"
        continue
    fi

    echo "  📄 执行 ${FILENAME}..."
    if $MYSQL_CMD < "$file" 2>/dev/null; then
        $MYSQL_CMD -e "INSERT INTO schema_migrations (filename) VALUES ('$FILENAME');" 2>/dev/null
        echo "     ✅ 完成"
        COUNT=$((COUNT + 1))
    else
        echo "     ❌ 失败！请手动检查"
        exit 1
    fi
done

echo "[$(date '+%H:%M:%S')] 迁移完成，共执行 $COUNT 个新脚本"
