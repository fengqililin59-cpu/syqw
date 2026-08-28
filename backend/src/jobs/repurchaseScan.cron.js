/**
 * @file 复购扫描（每日 09:30）：疗程将用完、卡将到期、余额不足、久未到店。
 * 默认关闭：ENABLE_REPURCHASE_SCAN_CRON=1
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { runRepurchaseScanOnce } from '../services/repurchaseScanner.service.js';

export function registerRepurchaseScanCron() {
  if (!env.enableRepurchaseScanCron) {
    console.log('[repurchase] cron disabled (set ENABLE_REPURCHASE_SCAN_CRON=1)');
    return;
  }

  // 放在上午 9:30，避免过早给客户发消息
  cron.schedule('30 9 * * *', async () => {
    try {
      const result = await runRepurchaseScanOnce();
      console.log('[repurchase] scan result', result);
    } catch (e) {
      console.error('[repurchase] scan failed', e);
    }
  });
  console.log('[repurchase] cron enabled (daily 09:30)');
}
