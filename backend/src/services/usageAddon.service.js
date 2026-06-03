/**
 * @file 用量加购包服务：购买、消耗、配额增强查询。
 */
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import {
  UsageAddonPackage,
  TenantUsageAddon,
  PaymentRecord,
} from '../models/index.js';
import * as balanceService from './balance.service.js';
import { HttpError } from '../utils/httpError.js';

/**
 * 获取可用的加购包列表
 */
export async function listAddonPackages() {
  return UsageAddonPackage.findAll({
    where: { is_active: true },
    order: [['sort_order', 'ASC']],
  });
}

/**
 * 获取租户当前有效的加购汇总（按资源类型）
 */
export async function getActiveAddons(tenantId) {
  const today = new Date().toISOString().slice(0, 10);
  const addons = await TenantUsageAddon.findAll({
    where: {
      tenant_id: tenantId,
      is_active: true,
      expires_at: { [Op.gte]: today },
    },
    include: [{ model: UsageAddonPackage, as: 'addonPackage', required: false }],
  });

  // 汇总每种资源的额外配额
  const summary = { customers: 0, seats: 0, broadcasts: 0, ai_calls: 0 };
  const list = [];
  for (const a of addons) {
    const remaining = a.quantity - a.consumed;
    summary[a.resource_type] += remaining;
    list.push({
      id: a.id,
      resource_type: a.resource_type,
      addon_name: a.addonPackage?.name || '加购包',
      quantity: a.quantity,
      consumed: a.consumed,
      remaining,
      expires_at: a.expires_at,
      created_at: a.created_at,
    });
  }

  return { summary, list };
}

/**
 * 购买加购包（从余额扣款）
 */
export async function purchaseAddon(tenantId, addonPackageId) {
  const pkg = await UsageAddonPackage.findByPk(addonPackageId);
  if (!pkg || !pkg.is_active) throw new HttpError(400, '加购包不存在或已下架');

  // 从余额扣款
  await balanceService.consumeBalance(
    tenantId,
    Number(pkg.price),
    'addon_purchase',
    null,
    `购买加购包：${pkg.name}`,
  );

  // 计算过期时间
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + pkg.duration_months);

  // 创建加购记录
  return sequelize.transaction(async (t) => {
    const addon = await TenantUsageAddon.create(
      {
        tenant_id: tenantId,
        addon_package_id: pkg.id,
        resource_type: pkg.resource_type,
        quantity: pkg.quantity,
        consumed: 0,
        expires_at: expiresAt.toISOString().slice(0, 10),
        is_active: true,
      },
      { transaction: t },
    );

    // 创建支付记录
    await PaymentRecord.create(
      {
        tenant_id: tenantId,
        plan_id: null,
        billing_cycle: 'monthly',
        amount: Number(pkg.price),
        currency: 'CNY',
        status: 'paid',
        pay_channel: 'manual',
        out_trade_no: `ADDON-${tenantId}-${addon.id}-${Date.now()}`,
        paid_at: new Date(),
        remark: `余额购买加购包：${pkg.name}`,
      },
      { transaction: t },
    );

    return addon;
  });
}

/**
 * 消耗加购配额（优先使用加购包，再使用套餐配额）
 * 返回 { hasCapacity, source: 'plan' | 'addon' }
 */
export async function consumeAddonQuota(tenantId, resourceType, amount = 1) {
  const today = new Date().toISOString().slice(0, 10);
  const activeAddons = await TenantUsageAddon.findAll({
    where: {
      tenant_id: tenantId,
      resource_type: resourceType,
      is_active: true,
      expires_at: { [Op.gte]: today },
    },
    order: [['expires_at', 'ASC']], // 优先消耗快过期的
  });

  let remaining = amount;

  for (const addon of activeAddons) {
    const available = addon.quantity - addon.consumed;
    if (available <= 0) continue;

    const consume = Math.min(remaining, available);
    await addon.update({ consumed: addon.consumed + consume });

    // 如果用完了就标记失效
    if (addon.consumed + consume >= addon.quantity) {
      await addon.update({ is_active: false });
    }

    remaining -= consume;
    if (remaining <= 0) return { hasCapacity: true, source: 'addon' };
  }

  return { hasCapacity: false, source: 'none' };
}

/**
 * 获取加购后的实际配额上限（套餐配额 + 加购配额）
 */
export async function getEffectiveQuota(tenantId, planLimit, resourceType) {
  const { summary } = await getActiveAddons(tenantId);
  const addonExtra = summary[resourceType] || 0;
  if (planLimit === -1) return -1; // 不限
  return planLimit + addonExtra;
}
