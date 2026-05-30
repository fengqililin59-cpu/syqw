/**
 * @file 自动跟进扫描（默认关闭；生产需 ENABLE_AUTOMATION_CRON=1）。
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { runAutomationScanOnce } from '../services/automation.service.js';
import { runIntentLinkedFollowupScan } from '../services/intentLinkedFollowup.service.js';

export function registerAutomationFollowupCron() {
  if (!env.enableAutomationCron && !env.enableIntentLinkedFollowup) {
    console.log(
      '[automation-followup] cron disabled (set ENABLE_AUTOMATION_CRON=1 and/or ENABLE_INTENT_LINKED_FOLLOWUP=1)',
    );
    return;
  }

  cron.schedule('*/5 * * * *', async () => {
    const started = new Date().toISOString();
    console.log('[follow-up] scan start', started);
    try {
      if (env.enableAutomationCron) {
        await runAutomationScanOnce();
      }
      if (env.enableIntentLinkedFollowup) {
        await runIntentLinkedFollowupScan();
      }
    } catch (e) {
      console.error('[follow-up] scan failed', e);
    }
  });
}
