#!/bin/bash
# 修复 coachingEvaluator.cron.js 在 8:00 触发 unhandledRejection 导致 syqw-api 502
# ECS Workbench: bash deploy/ecs_hotfix_coaching_cron.sh
set -euo pipefail

TARGET="/var/www/wework-saas/backend/src/jobs/coachingEvaluator.cron.js"

if grep -q 'coachingService\.__lastDailyKey' "$TARGET" 2>/dev/null; then
  echo "检测到旧版 __lastDailyKey，正在写入修复..."
elif grep -q '^let lastDailyKey = null;' "$TARGET" 2>/dev/null; then
  echo "已是修复版 (let lastDailyKey)，跳过写入"
  pm2 restart syqw-api --update-env
  exit 0
else
  echo "WARN: 文件格式未知，仍将覆盖为修复版"
fi

cat > "$TARGET" << 'EOF'
/**
 * @file AI 教练建议每日定时生成（每天 8:00 自动分析并生成）
 */
import * as coachingService from '../services/coaching.service.js';

let intervalId = null;
/** @type {string | null} */
let lastDailyKey = null;

export function registerCoachingEvaluatorCron() {
  if (intervalId) return;

  // 每 10 分钟检查一次是否到了早上 8 点（防止重复生成）
  intervalId = setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // 每天 8:00-8:09 之间触发一次
    if (hour !== 8 || minute > 9) return;

    // 检查今天是否已生成（用日期标记防止 10 分钟内重复执行）
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (lastDailyKey === todayKey) return;
    lastDailyKey = todayKey;

    console.log('[coaching:cron] 开始每日教练建议生成...');
    try {
      // 遍历所有租户
      const { Tenant } = await import('../models/index.js');
      const tenants = await Tenant.findAll({ attributes: ['id'] });
      for (const t of tenants) {
        try {
          const r = await coachingService.generateAllCoaching({ tenantId: t.id });
          console.log(`[coaching:cron] 租户 ${t.id}: 生成 ${r.generated} 条建议`);
        } catch (e) {
          console.error(`[coaching:cron] 租户 ${t.id} 失败:`, e.message);
        }
      }
    } catch (err) {
      console.error('[coaching:cron] 批量生成失败:', err.message);
    }
  }, 5 * 60 * 1000); // 每 5 分钟检查一次

  console.log('[coaching:cron] 教练建议定时器已注册（每天 8:00）');
}
EOF

node --check "$TARGET"
grep -n 'lastDailyKey' "$TARGET" | head -5
pm2 restart syqw-api --update-env
pm2 save
sleep 2
curl -sS http://127.0.0.1:3010/health; echo
echo "完成。明天 8:00 不应再因 __lastDailyKey 崩溃。"
