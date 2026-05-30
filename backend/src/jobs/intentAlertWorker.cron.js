/**
 * @file 意向预警 Worker（每 5 分钟）。
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { runIntentAlertWorkerOnce } from '../services/intentAlertWorker.service.js';

export function registerIntentAlertWorkerCron() {
  if (!env.enableIntentAlertCron) {
    console.log('[intent-alert] cron disabled (set ENABLE_INTENT_ALERT_CRON=1)');
    return;
  }

  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await runIntentAlertWorkerOnce(10);
      if (result.processed > 0 || result.stale_failed > 0) {
        console.log('[intent-alert] worker result', result);
      }
    } catch (e) {
      console.error('[intent-alert] worker failed', e);
    }
  });
  console.log('[intent-alert] cron enabled (every 5 minutes)');
}
