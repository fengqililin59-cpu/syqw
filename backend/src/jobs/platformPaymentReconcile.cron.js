/**
 * @file 每月 1 日 09:00 发送上月支付对账 Excel 邮件。
 */
import cron from 'node-cron';
import { sendMonthlyPaymentReconcileEmail } from '../services/platformPaymentReconcile.service.js';

export function registerPlatformPaymentReconcileCron() {
  if (process.env.ENABLE_PLATFORM_PAYMENT_RECONCILE_CRON !== '1') {
    console.log('[paymentReconcile] cron disabled (set ENABLE_PLATFORM_PAYMENT_RECONCILE_CRON=1)');
    return;
  }

  cron.schedule('0 9 1 * *', async () => {
    try {
      const r = await sendMonthlyPaymentReconcileEmail();
      console.log('[paymentReconcile] monthly email', r);
    } catch (e) {
      console.error('[paymentReconcile] cron failed', e);
    }
  });
  console.log('[paymentReconcile] cron enabled (monthly 1st 09:00, previous month)');
}
