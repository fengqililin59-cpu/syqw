/**
 * @file AI 教练建议每日定时生成（每天 8:00 自动分析并生成）
 */
import * as coachingService from '../services/coaching.service.js';

let intervalId = null;

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
    if (coachingService.__lastDailyKey === todayKey) return;
    coachingService.__lastDailyKey = todayKey;

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
