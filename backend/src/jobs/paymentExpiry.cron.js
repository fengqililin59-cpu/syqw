/**
 * @file 超时未支付订单标记为失败（每小时）。
 */
import cron from 'node-cron';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { PaymentRecord } from '../models/index.js';

const PENDING_TTL_HOURS = Math.max(1, Number(process.env.PAYMENT_PENDING_TTL_HOURS) || 24);

export function registerPaymentExpiryCron() {
  if (process.env.ENABLE_PAYMENT_EXPIRY_CRON !== '1') {
    console.log('[billing] payment expiry cron disabled (set ENABLE_PAYMENT_EXPIRY_CRON=1)');
    return;
  }

  cron.schedule('15 * * * *', async () => {
    try {
      const before = new Date(Date.now() - PENDING_TTL_HOURS * 3600 * 1000);
      const [n] = await PaymentRecord.update(
        { status: 'failed', remark: '超时未支付（系统自动关闭）' },
        {
          where: {
            status: 'pending',
            pay_channel: { [Op.in]: ['wechat', 'alipay'] },
            created_at: { [Op.lt]: before },
          },
        },
      );
      if (n > 0) console.log(`[billing] expired ${n} stale pending payment(s)`);
    } catch (e) {
      console.error('[billing] payment expiry cron failed', e);
    }
  });
  console.log(`[billing] payment expiry cron enabled (hourly, TTL ${PENDING_TTL_HOURS}h)`);
}
