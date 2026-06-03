/**
 * @file 平台 MRR 估算（活跃订阅 × 套餐月等价）。
 */
import { Subscription, Plan } from '../models/index.js';

export function monthlyEquivalent(plan, billingCycle) {
  if (!plan || plan.code === 'free') return 0;
  const monthly = Number(plan.price_monthly) || 0;
  const yearly = Number(plan.price_yearly) || 0;
  if (billingCycle === 'yearly') return yearly / 12;
  return monthly;
}

export async function computeCurrentMrrEstimate() {
  const subs = await Subscription.findAll({
    include: [{ model: Plan, as: 'plan', required: true }],
    attributes: ['status', 'billing_cycle'],
  });
  let mrr = 0;
  for (const sub of subs) {
    if (sub.status !== 'active') continue;
    const plan = sub.plan;
    if (!plan || plan.code === 'free') continue;
    mrr += monthlyEquivalent(plan, sub.billing_cycle);
  }
  return Math.round(mrr * 100) / 100;
}

export async function computeMrrByPlan() {
  const subs = await Subscription.findAll({
    where: { status: 'active' },
    include: [{ model: Plan, as: 'plan', required: true }],
    attributes: ['billing_cycle'],
  });
  const map = {};
  for (const sub of subs) {
    const plan = sub.plan;
    if (!plan || plan.code === 'free') continue;
    const code = plan.code;
    if (!map[code]) map[code] = { code, name: plan.name, mrr: 0 };
    map[code].mrr += monthlyEquivalent(plan, sub.billing_cycle);
  }
  return Object.values(map).map((p) => ({
    ...p,
    mrr: Math.round(p.mrr * 100) / 100,
  }));
}
