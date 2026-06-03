/**
 * @file 每日 09:00 向租户管理员企微推送「今日必做」摘要。
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { sendTodayActionsMorningDigestAllTenants } from '../services/todayActionsDigest.service.js';

export function registerTodayActionsDigestCron() {
  if (!env.enableTodayActionsCron) {
    console.log('[todayActions] cron disabled (set ENABLE_TODAY_ACTIONS_CRON=1)');
    return;
  }

  cron.schedule('0 9 * * *', async () => {
    try {
      const r = await sendTodayActionsMorningDigestAllTenants();
      if (r.messages > 0) {
        console.log('[todayActions] morning digest sent', r);
      }
    } catch (e) {
      console.error('[todayActions] cron failed', e);
    }
  });
  console.log('[todayActions] cron enabled (daily 09:00, tenants with pending actions)');
}
