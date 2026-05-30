/**
 * @file 工单 SLA 逾期提醒与升级（每 10 分钟）。
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { runTicketSlaReminderOnce } from '../services/ticketSlaReminder.service.js';

export function registerTicketSlaReminderCron() {
  if (!env.enableTicketSlaCron) {
    console.log('[ticket-sla] cron disabled (set ENABLE_TICKET_SLA_CRON=1)');
    return;
  }

  cron.schedule('*/10 * * * *', async () => {
    try {
      const result = await runTicketSlaReminderOnce(25);
      if (result.ownerNotified > 0 || result.escalated > 0) {
        console.log('[ticket-sla] processed', result);
      }
    } catch (e) {
      console.error('[ticket-sla] cron failed', e);
    }
  });
  console.log('[ticket-sla] cron enabled (every 10 min)');
}
