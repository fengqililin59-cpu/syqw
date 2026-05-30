/**
 * @file API 健康巡检（默认每 2 分钟，连续失败企微告警）。
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { runHealthMonitorOnce } from '../services/healthMonitor.service.js';

export function registerHealthMonitorCron() {
  if (!env.enableHealthMonitorCron) {
    console.log('[health-monitor] cron disabled (set ENABLE_HEALTH_MONITOR_CRON=1)');
    return;
  }
  const mins = Math.max(1, Math.min(15, Number(env.healthMonitorIntervalMin) || 2));
  const expr = mins === 1 ? '* * * * *' : `*/${mins} * * * *`;

  cron.schedule(expr, async () => {
    try {
      const result = await runHealthMonitorOnce();
      if (result.status === 'alerted' || result.status === 'recovered') {
        console.log('[health-monitor]', result.status, result.probe);
      }
    } catch (e) {
      console.error('[health-monitor] cron failed', e);
    }
  });
  console.log(`[health-monitor] cron enabled (every ${mins} min, threshold ${env.healthMonitorFailThreshold})`);
}
