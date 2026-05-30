/**
 * @file 收件箱 SLA 提醒（每 5 分钟扫描）。
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { runInboxSlaReminderOnce } from '../services/inboxSlaReminder.service.js';

export function registerInboxSlaReminderCron() {
  if (!env.enableInboxSlaCron) {
    console.log('[inbox-sla] cron disabled (set ENABLE_INBOX_SLA_CRON=1)');
    return;
  }

  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await runInboxSlaReminderOnce(15);
      if (result.notified > 0) {
        console.log('[inbox-sla] reminders sent', result);
      }
    } catch (e) {
      console.error('[inbox-sla] cron failed', e);
    }
  });
  console.log(`[inbox-sla] cron enabled (every 5 min, threshold ${env.inboxSlaMinutes} min)`);
}
