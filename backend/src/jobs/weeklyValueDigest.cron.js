/**
 * @file 每周一 09:30 向租户管理员推送「价值战报」企微消息。
 */
import cron from 'node-cron';
import { sendWeeklyDigestAllTenants } from '../services/weeklyDigest.service.js';

export function registerWeeklyValueDigestCron() {
  if (process.env.ENABLE_WEEKLY_DIGEST_CRON !== '1') {
    console.log('[digest] weekly value cron disabled (set ENABLE_WEEKLY_DIGEST_CRON=1)');
    return;
  }

  cron.schedule('30 9 * * 1', async () => {
    try {
      const r = await sendWeeklyDigestAllTenants();
      console.log('[digest] weekly value sent', r);
    } catch (e) {
      console.error('[digest] weekly value cron failed', e);
    }
  });
  console.log('[digest] weekly value cron enabled (Mon 09:30 Asia/Shanghai)');
}
