/**
 * @file 订阅到期处理与到期提醒（每天 09:00）。
 */
import cron from 'node-cron';
import { Op } from 'sequelize';
import dayjs from 'dayjs';
import { env } from '../config/env.js';
import { Subscription, Tenant, User } from '../models/index.js';
import { sendAgentTextMessage } from '../services/wework.service.js';
import { downgradeTenantToFree } from '../services/billing.service.js';

async function notifyTenantAdmins(tenantId, content) {
  const [tenant, admins] = await Promise.all([
    Tenant.findByPk(tenantId),
    User.findAll({
      where: { tenant_id: tenantId, status: 1, role: 'admin' },
      attributes: ['id', 'wework_userid'],
    }),
  ]);
  if (!tenant || !admins.length) return;

  for (const admin of admins) {
    const touser = admin.wework_userid ? String(admin.wework_userid).trim() : '';
    if (!touser) continue;
    sendAgentTextMessage(tenant, { touser, content }).catch((e) =>
      console.error('[billing] notify admin failed', tenantId, admin.id, e),
    );
  }
}

export function registerSubscriptionExpiryCron() {
  if (!env.enableSubscriptionExpiryCron) {
    console.log('[billing] subscription expiry cron disabled (set ENABLE_SUBSCRIPTION_EXPIRY_CRON=1)');
    return;
  }

  cron.schedule('0 9 * * *', async () => {
    try {
      const expiredTrials = await Subscription.findAll({
        where: {
          status: 'trialing',
          trial_ends_at: { [Op.lt]: new Date() },
        },
        attributes: ['id', 'tenant_id'],
      });
      for (const sub of expiredTrials) {
        await downgradeTenantToFree(Number(sub.tenant_id));
        await notifyTenantAdmins(
          Number(sub.tenant_id),
          `14 天专业版试用已结束，已切换为体验版（功能与配额受限）。升级续费：${String(env.appUrl || '').replace(/\/$/, '')}/app/billing`,
        );
      }

      const expiredPaid = await Subscription.findAll({
        where: {
          status: 'active',
          current_period_end: { [Op.lt]: new Date() },
          trial_ends_at: null,
        },
        attributes: ['id', 'tenant_id'],
      });
      for (const sub of expiredPaid) {
        await downgradeTenantToFree(Number(sub.tenant_id));
        await notifyTenantAdmins(
          Number(sub.tenant_id),
          `付费套餐已到期，已切换为体验版。续费恢复专业版/企业版：${String(env.appUrl || '').replace(/\/$/, '')}/app/billing`,
        );
      }

      const expiredLegacy = await Subscription.findAll({
        where: { status: 'expired', expiry_notified_at: null },
        attributes: ['id', 'tenant_id'],
      });
      for (const sub of expiredLegacy) {
        await downgradeTenantToFree(Number(sub.tenant_id));
        await notifyTenantAdmins(
          Number(sub.tenant_id),
          `您的套餐已到期，已切换为体验版，请及时续费：${String(env.appUrl || '').replace(/\/$/, '')}/app/billing`,
        );
        await sub.update({ expiry_notified_at: new Date() });
      }

      const in3days = dayjs().add(3, 'day').toDate();
      const remindSubs = await Subscription.findAll({
        where: {
          status: { [Op.in]: ['trialing', 'active'] },
          reminder_notified_at: null,
          [Op.or]: [
            { trial_ends_at: { [Op.between]: [new Date(), in3days] } },
            { current_period_end: { [Op.between]: [new Date(), in3days] } },
          ],
        },
        attributes: ['id', 'tenant_id', 'trial_ends_at', 'current_period_end'],
      });
      for (const sub of remindSubs) {
        const endAt = sub.current_period_end || sub.trial_ends_at;
        const days = endAt ? Math.max(0, dayjs(endAt).startOf('day').diff(dayjs().startOf('day'), 'day')) : 0;
        await notifyTenantAdmins(
          Number(sub.tenant_id),
          `您的套餐将于 ${days} 天后到期，请及时续费避免影响使用：${String(env.appUrl || '').replace(/\/$/, '')}/app/billing`,
        );
        await sub.update({ reminder_notified_at: new Date() });
      }
    } catch (e) {
      console.error('[billing] subscription expiry cron failed', e);
    }
  });
  console.log('[billing] subscription expiry cron enabled (09:00 daily)');
}
