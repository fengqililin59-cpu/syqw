/**
 * @file 群发任务：scheduled 到期自动执行（默认关闭：ENABLE_BROADCAST_CRON=1）。
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { processDueScheduledBroadcastTasks } from '../services/broadcast.service.js';

export function registerBroadcastSchedulerCron() {
  if (!env.enableBroadcastCron) {
    console.log('[broadcast] cron disabled (set ENABLE_BROADCAST_CRON=1)');
    return;
  }

  cron.schedule('* * * * *', async () => {
    try {
      await processDueScheduledBroadcastTasks();
    } catch (e) {
      console.error('[broadcast] cron tick failed', e);
    }
  });
}
