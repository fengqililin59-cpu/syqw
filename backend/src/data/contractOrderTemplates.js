/**
 * @file 平台线下合同 / 年框开单模板（标准套餐与备注话术）。
 */
export const CONTRACT_ORDER_TEMPLATES = [
  {
    id: 'pro_yearly_frame',
    name: '专业版 · 标准年框',
    plan_code: 'pro',
    billing_cycle: 'yearly',
    remark_prefix: '年框合同',
    terms: '签约后 1 个工作日内开通；含远程培训 1 次。',
  },
  {
    id: 'enterprise_yearly_frame',
    name: '企业版 · 标准年框',
    plan_code: 'enterprise',
    billing_cycle: 'yearly',
    remark_prefix: '年框合同',
    terms: '含多席位与审计能力；实施排期以合同约定为准。',
  },
  {
    id: 'pro_monthly_pilot',
    name: '专业版 · 月付试点',
    plan_code: 'pro',
    billing_cycle: 'monthly',
    remark_prefix: '试点合同',
    terms: '试点期 1–3 个月，到期前 7 天提醒续费。',
  },
  {
    id: 'ai_pro_yearly_addon',
    name: 'AI 专业加购 · 年付',
    plan_code: 'ai_pro',
    billing_cycle: 'yearly',
    remark_prefix: 'AI 加购年框',
    terms: '在现有 CRM 套餐基础上增加 AI 调用额度。',
  },
  {
    id: 'ai_enterprise_yearly_addon',
    name: 'AI 企业加购 · 年付',
    plan_code: 'ai_enterprise',
    billing_cycle: 'yearly',
    remark_prefix: 'AI 加购年框',
    terms: '适合重度 AI 使用团队。',
  },
];
