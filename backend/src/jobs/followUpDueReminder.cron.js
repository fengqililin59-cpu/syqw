/**
 * @file 跟进到期提醒（每 15 分钟扫描 next_follow_at）。
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { runFollowUpDueReminderOnce } from '../services/followUpDueReminder.service.js';

export function registerFollowUpDueReminderCron() {
  if (!env.enableFollowupDueCron) {
    console.log('[followup-due] cron disabled (set ENABLE_FOLLOWUP_DUE_CRON=1)');
    return;
  }

  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await runFollowUpDueReminderOnce(25);
      if (result.notified > 0) {
        console.log('[followup-due] reminders sent', result);
      }
    } catch (e) {
      console.error('[followup-due] cron failed', e);
    }
  });
  console.log('[followup-due] cron enabled (every 15 min)');
}
