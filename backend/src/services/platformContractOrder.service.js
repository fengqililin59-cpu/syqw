/**
 * @file 平台方：按合同模板为租户创建线下订单（年框 / 合同号）。
 */
import dayjs from 'dayjs';
import { HttpError } from '../utils/httpError.js';
import { Tenant, Plan } from '../models/index.js';
import { CONTRACT_ORDER_TEMPLATES } from '../data/contractOrderTemplates.js';
import * as billingService from './billing.service.js';

function findTemplate(templateId) {
  return CONTRACT_ORDER_TEMPLATES.find((t) => t.id === String(templateId || '').trim()) || null;
}

export function listContractOrderTemplates() {
  return CONTRACT_ORDER_TEMPLATES;
}

export async function listContractOrderTemplatesWithPricing() {
  const plans = await Plan.findAll({ where: { is_active: 1 }, attributes: ['code', 'name', 'price_monthly', 'price_yearly'] });
  const planByCode = Object.fromEntries(plans.map((p) => [p.code, p.get({ plain: true })]));

  return CONTRACT_ORDER_TEMPLATES.map((t) => {
    const plan = planByCode[t.plan_code];
    const amount =
      t.billing_cycle === 'yearly'
        ? Number(plan?.price_yearly || 0)
        : Number(plan?.price_monthly || 0);
    return {
      ...t,
      plan_name: plan?.name || t.plan_code,
      amount,
      amount_label: `¥${amount.toLocaleString('zh-CN')}`,
    };
  }).filter((t) => planByCode[t.plan_code]);
}

function buildRemark(template, contractNo, extra) {
  const parts = [template.remark_prefix || '线下合同', `合同号 ${contractNo}`];
  if (extra) parts.push(String(extra).trim());
  return parts.join(' · ').slice(0, 255);
}

export function buildContractNoticeText({
  tenantName,
  template,
  planName,
  amount,
  billingCycle,
  contractNo,
  outTradeNo,
  confirmNow,
}) {
  const cycleLabel = billingCycle === 'yearly' ? '年付' : '月付';
  const lines = [
    `【ZhiFlow 合同开通确认】`,
    `客户：${tenantName}`,
    `套餐：${planName}（${cycleLabel}）`,
    `金额：¥${Number(amount).toLocaleString('zh-CN')}`,
    `合同号：${contractNo}`,
    `订单号：${outTradeNo}`,
    '',
    template.terms || '',
    '',
    confirmNow
      ? '系统已确认收款并开通套餐，请通知客户登录使用。'
      : '请客户完成转账后，我方在平台后台「确认收款」自动开通。',
    '',
    '计费与发票事宜以双方合同为准。',
  ];
  return lines.filter((l) => l !== undefined).join('\n');
}

/**
 * @param {number} tenantId
 * @param {{ template_id: string; contract_no?: string; amount?: number; remark_extra?: string; confirm_now?: boolean }} body
 */
export async function createPlatformContractOrder(tenantId, body = {}) {
  const tid = Number(tenantId);
  if (!Number.isFinite(tid) || tid <= 0) throw new HttpError(400, '租户 ID 无效', 400);

  const template = findTemplate(body.template_id);
  if (!template) throw new HttpError(400, '合同模板不存在', 400);

  const tenant = await Tenant.findByPk(tid, { attributes: ['id', 'name', 'status'] });
  if (!tenant || tenant.status !== 1) throw new HttpError(404, '租户不存在', 404);

  const plan = await billingService.getPlanByCode(template.plan_code);
  const cycle = template.billing_cycle === 'monthly' ? 'monthly' : 'yearly';
  const defaultAmount = cycle === 'yearly' ? Number(plan.price_yearly) : Number(plan.price_monthly);
  const amount = body.amount != null && Number.isFinite(Number(body.amount)) ? Number(body.amount) : defaultAmount;
  if (amount <= 0) throw new HttpError(400, '金额无效', 400);

  const contractNo =
    String(body.contract_no || '').trim() ||
    `ZF-${dayjs().format('YYYYMMDD')}-${tid}-${String(template.id).slice(0, 8).toUpperCase()}`;
  const remark = buildRemark(template, contractNo, body.remark_extra);

  const row = await billingService.createPaymentRecord(tid, plan.id, cycle, 'manual', remark);
  if (Math.abs(Number(row.amount) - amount) > 0.009) {
    const { PaymentRecord } = await import('../models/index.js');
    await PaymentRecord.update({ amount }, { where: { id: row.id } });
    row.amount = amount;
  }

  let payment = row;
  const confirmNow = body.confirm_now === true;
  if (confirmNow) {
    payment = await billingService.confirmPayment(row.out_trade_no);
  }

  const notice_text = buildContractNoticeText({
    tenantName: tenant.name,
    template,
    planName: plan.name,
    amount,
    billingCycle: cycle,
    contractNo,
    outTradeNo: row.out_trade_no,
    confirmNow,
  });

  return {
    template_id: template.id,
    contract_no: contractNo,
    tenant_id: tid,
    tenant_name: tenant.name,
    plan_code: plan.code,
    plan_name: plan.name,
    billing_cycle: cycle,
    amount,
    out_trade_no: row.out_trade_no,
    status: payment.status,
    confirmed: confirmNow,
    notice_text,
  };
}
