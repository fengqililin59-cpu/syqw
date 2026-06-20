#!/usr/bin/env bash
# 激活留存/价值类定时任务（零 AI 成本，仅发企微消息）
# - ENABLE_TODAY_ACTIONS_CRON：每日 09:00 今日必做晨报（老板全局 + 每个销售个人清单）
# - ENABLE_WEEKLY_DIGEST_CRON：每周一 09:30 周价值战报（发老板，续费理由）
# 用法：bash /var/www/wework-saas/deploy/ecs_enable_value_crons.sh
set -euo pipefail

ROOT="${ROOT:-/var/www/wework-saas}"
ENV_FILE="${ENV_FILE:-$ROOT/backend/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 未找到 .env: $ENV_FILE"
  exit 1
fi

ensure_flag() {
  local key="$1"
  local val="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # 已存在则就地改为目标值
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    echo "  [更新] ${key}=${val}"
  else
    printf '\n%s=%s\n' "$key" "$val" >> "$ENV_FILE"
    echo "  [新增] ${key}=${val}"
  fi
}

echo "=== 写入环境变量 ==="
ensure_flag ENABLE_TODAY_ACTIONS_CRON 1
ensure_flag ENABLE_WEEKLY_DIGEST_CRON 1

echo "=== 重启 API 使配置生效 ==="
pm2 restart syqw-api --update-env
sleep 6
API_PORT=$(grep -m1 '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r "' || echo "3000")
API_PORT=${API_PORT:-3000}
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/health" 2>/dev/null || echo "000")
echo "API 健康检查: $HTTP_CODE (port ${API_PORT})"

echo ""
echo "✅ 已激活。下一次触发时间："
echo "   - 今日必做晨报：每日 09:00（Asia/Shanghai）"
echo "   - 周价值战报：  每周一 09:30"
echo ""
echo "💡 想立即验证晨报，可在服务器上跑（替换 TENANT_ID 为已配企微的真实租户）："
echo "   cd $ROOT/backend && node -e \"import('./src/services/todayActionsDigest.service.js').then(m=>m.sendTodayActionsMorningDigestForTenant(TENANT_ID,{force:true}).then(r=>{console.log(r);process.exit(0)}))\""
