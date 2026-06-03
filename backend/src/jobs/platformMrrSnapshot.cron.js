/**
 * @file 每日 23:55 写入当月 MRR 快照（月末最后一次接近月终值）。
 */
import cron from 'node-cron';
import dayjs from 'dayjs';
import { env } from '../config/env.js';
import { captureMrrSnapshot } from '../services/platformMrrSnapshot.service.js';

export function registerPlatformMrrSnapshotCron() {
  if (!env.enablePlatformMrrSnapshotCron) {
    console.log('[mrrSnapshot] cron disabled (set ENABLE_PLATFORM_MRR_SNAPSHOT_CRON=1)');
    return;
  }

  cron.schedule('55 23 * * *', async () => {
    try {
      const key = dayjs().format('YYYY-MM');
      const r = await captureMrrSnapshot(key);
      console.log('[mrrSnapshot] captured', r);
    } catch (e) {
      console.error('[mrrSnapshot] cron failed', e);
    }
  });
  console.log('[mrrSnapshot] cron enabled (daily 23:55, current month upsert)');
}
