/**
 * @file 套餐功能对比表（计费页展示）。
 */
export type PlanColumn = {
  code: string
  label: string
  highlight?: boolean
}

export type FeatureRow = {
  id: string
  label: string
  hint?: string
  /** 各套餐 code → 是否支持 */
  values: Record<string, boolean | 'partial'>
}

export const CRM_PLAN_COLUMNS: PlanColumn[] = [
  { code: 'free', label: '体验版' },
  { code: 'pro', label: '专业版', highlight: true },
  { code: 'enterprise', label: '企业版' },
]

export const AI_PLAN_COLUMNS: PlanColumn[] = [
  { code: 'free', label: '体验版' },
  { code: 'pro', label: '专业版' },
  { code: 'ai_assistant', label: 'AI 助手版', highlight: true },
  { code: 'ai_assistant_pro', label: 'AI 旗舰版' },
]

export const CRM_FEATURE_ROWS: FeatureRow[] = [
  {
    id: 'crm',
    label: '客户 / 跟进 / 活码',
    values: { free: true, pro: true, enterprise: true },
  },
  {
    id: 'dash',
    label: '销售看板与待跟进',
    values: { free: true, pro: true, enterprise: true },
  },
  {
    id: 'broadcast',
    label: '群发任务',
    values: { free: true, pro: true, enterprise: true },
  },
  {
    id: 'automation',
    label: '自动化规则 / 流程',
    values: { free: false, pro: true, enterprise: true },
  },
  {
    id: 'ai_basic',
    label: '站内 AI 助手与文案',
    hint: '按套餐月配额',
    values: { free: 'partial', pro: true, enterprise: true },
  },
  {
    id: 'intent',
    label: '意向评分与预警',
    values: { free: false, pro: true, enterprise: true },
  },
  {
    id: 'inbox_ai',
    label: '收件箱 AI 草稿（人审发送）',
    values: { free: false, pro: true, enterprise: true },
  },
  {
    id: 'campaign',
    label: '营销活动',
    values: { free: false, pro: true, enterprise: true },
  },
  {
    id: 'migration',
    label: '数据迁移工具',
    values: { free: false, pro: true, enterprise: true },
  },
  {
    id: 'audit',
    label: '操作审计日志',
    values: { free: false, pro: false, enterprise: true },
  },
  {
    id: 'private',
    label: '私有化部署（商务洽谈）',
    values: { free: false, pro: false, enterprise: true },
  },
]

export const AI_FEATURE_ROWS: FeatureRow[] = [
  {
    id: 'ai_quota',
    label: '月 AI 调用额度',
    hint: '助手对话、话术、意向等合计',
    values: {
      free: 'partial',
      pro: 'partial',
      ai_assistant: true,
      ai_assistant_pro: true,
    },
  },
  {
    id: 'ai_customer',
    label: '客户详情 AI 回复建议',
    values: { free: 'partial', pro: true, ai_assistant: true, ai_assistant_pro: true },
  },
  {
    id: 'script',
    label: '话术库',
    values: { free: false, pro: true, ai_assistant: true, ai_assistant_pro: true },
  },
  {
    id: 'automation',
    label: '自动化 / 流程',
    values: { free: false, pro: true, ai_assistant: true, ai_assistant_pro: true },
  },
]

export function planHasFeature(planFeatures: string[], featureId: string): boolean | 'partial' {
  if (planFeatures.includes('all')) return true
  const map: Record<string, string[]> = {
    crm: ['customer_manage'],
    dash: ['dashboard'],
    broadcast: ['broadcast'],
    automation: ['automation'],
    ai_basic: ['ai_full'],
    intent: ['intent_alert'],
    inbox_ai: ['ai_full'],
    campaign: ['campaign'],
    migration: ['migration'],
    audit: ['audit_log'],
    private: ['all'],
    ai_quota: ['ai_full'],
    ai_customer: ['ai_full'],
    script: ['script_library'],
  }
  const keys = map[featureId] || []
  if (!keys.length) return false
  return keys.some((k) => planFeatures.includes(k))
}

export function cellFromPlan(
  row: FeatureRow,
  planCode: string,
  planFeatures: string[],
): boolean | 'partial' {
  const staticVal = row.values[planCode]
  if (staticVal === 'partial') return 'partial'
  if (staticVal === false) return false
  if (staticVal === true) {
    const live = planHasFeature(planFeatures, row.id)
    return live === 'partial' ? 'partial' : !!live
  }
  return planHasFeature(planFeatures, row.id) as boolean
}
