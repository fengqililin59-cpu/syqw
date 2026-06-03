/**
 * @file 余额服务：充值、消费、退款、自动续费。
 */
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { TenantBalance, BalanceTransaction, RechargePackage } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';

/**
 * 获取或创建租户余额账户
 */
export async function getOrCreateBalance(tenantId, transaction = null) {
  const [balance] = await TenantBalance.findOrCreate({
    where: { tenant_id: tenantId },
    defaults: { tenant_id: tenantId, balance: 0, total_recharged: 0, total_consumed: 0 },
    transaction,
  });
  return balance;
}

/**
 * 充值余额
 */
export async function rechargeBalance(tenantId, amount, channel, reference = null, description = null) {
  if (amount <= 0) throw new HttpError(400, '充值金额必须大于0');

  return sequelize.transaction(async (t) => {
    const balance = await getOrCreateBalance(tenantId, t);

    const newBalance = Number(balance.balance) + Number(amount);
    await balance.update(
      {
        balance: newBalance,
        total_recharged: Number(balance.total_recharged) + Number(amount),
      },
      { transaction: t },
    );

    await BalanceTransaction.create(
      {
        tenant_id: tenantId,
        type: 'recharge',
        amount,
        balance_after: newBalance,
        channel,
        reference,
        description: description || `余额充值 ¥${Number(amount).toFixed(2)}`,
      },
      { transaction: t },
    );

    return { balance: newBalance, amount };
  });
}

/**
 * 余额消费（自动续费/购买加购包等）
 * 余额不足时抛出 HttpError 402
 */
export async function consumeBalance(tenantId, amount, channel, reference = null, description = null) {
  if (amount <= 0) throw new HttpError(400, '消费金额必须大于0');

  return sequelize.transaction(async (t) => {
    const balance = await getOrCreateBalance(tenantId, t);

    if (Number(balance.balance) < Number(amount)) {
      throw new HttpError(402, `余额不足：当前余额 ¥${Number(balance.balance).toFixed(2)}，需支付 ¥${Number(amount).toFixed(2)}`);
    }

    const newBalance = Number(balance.balance) - Number(amount);
    await balance.update(
      {
        balance: newBalance,
        total_consumed: Number(balance.total_consumed) + Number(amount),
      },
      { transaction: t },
    );

    await BalanceTransaction.create(
      {
        tenant_id: tenantId,
        type: 'consume',
        amount: -amount,
        balance_after: newBalance,
        channel,
        reference,
        description: description || `余额消费 ¥${Number(amount).toFixed(2)}`,
      },
      { transaction: t },
    );

    return { balance: newBalance, amount };
  });
}

/**
 * 退款到余额
 */
export async function refundBalance(tenantId, amount, reference = null, description = null) {
  if (amount <= 0) throw new HttpError(400, '退款金额必须大于0');

  return sequelize.transaction(async (t) => {
    const balance = await getOrCreateBalance(tenantId, t);

    const newBalance = Number(balance.balance) + Number(amount);
    await balance.update({ balance: newBalance }, { transaction: t });

    await BalanceTransaction.create(
      {
        tenant_id: tenantId,
        type: 'refund',
        amount,
        balance_after: newBalance,
        channel: 'manual',
        reference,
        description: description || `余额退款 ¥${Number(amount).toFixed(2)}`,
      },
      { transaction: t },
    );

    return { balance: newBalance, amount };
  });
}

/**
 * 获取余额交易流水
 */
export async function listBalanceTransactions(tenantId, { page = 1, size = 20, type } = {}) {
  const where = { tenant_id: tenantId };
  if (type && ['recharge', 'consume', 'refund'].includes(type)) {
    where.type = type;
  }
  const { rows, count } = await BalanceTransaction.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
  });
  return { list: rows, total: count, page, size };
}

/**
 * 获取充值面额列表
 */
export async function listRechargePackages() {
  return RechargePackage.findAll({
    where: { is_active: true },
    order: [['sort_order', 'ASC']],
    raw: true,
  });
}
