/**
 * @file 套餐能力 token（与 backend planFeatures.js 对齐）。
 */

export const PREMIUM_FEATURES = {
  AI_INTENT_SCORE: 'ai_intent_score',
  AI_COACH_DAILY: 'ai_coach_daily',
  ADS_ROI: 'ads_roi',
  ARCHIVE_ANALYSIS: 'archive_analysis',
  OCEAN_LEAD: 'ocean_lead',
} as const

export type PremiumFeatureToken = (typeof PREMIUM_FEATURES)[keyof typeof PREMIUM_FEATURES]

export const FEATURE_ALIASES: Record<string, string[]> = {
  [PREMIUM_FEATURES.AI_INTENT_SCORE]: ['ai_intent_score', 'intent_alert'],
  [PREMIUM_FEATURES.AI_COACH_DAILY]: ['ai_coach_daily'],
  [PREMIUM_FEATURES.ADS_ROI]: ['ads_roi', 'campaign'],
  [PREMIUM_FEATURES.ARCHIVE_ANALYSIS]: ['archive_analysis'],
  [PREMIUM_FEATURES.OCEAN_LEAD]: ['ocean_lead'],
  ai_full: ['ai_full'],
}

export const FEATURE_LABELS: Record<string, string> = {
  [PREMIUM_FEATURES.AI_INTENT_SCORE]: 'AI 意向评分',
  [PREMIUM_FEATURES.AI_COACH_DAILY]: 'AI 教练日报',
  [PREMIUM_FEATURES.ADS_ROI]: '广告 ROI 归因',
  [PREMIUM_FEATURES.ARCHIVE_ANALYSIS]: '会话存档分析',
  [PREMIUM_FEATURES.OCEAN_LEAD]: '巨量引擎表单接入',
}

export function planIncludesFeature(planFeatures: string[] | undefined | null, featureToken: string): boolean {
  const list = planFeatures ?? []
  if (list.includes('all')) return true
  const aliases = FEATURE_ALIASES[featureToken] ?? [featureToken]
  return aliases.some((a) => list.includes(a))
}

export type PlanUpgradeDetail = {
  reason?: string
  feature?: string
  feature_label?: string
  upgrade_url?: string
  recommended_plan?: string
}

export const PLAN_UPGRADE_EVENT = 'plan-upgrade-required'

export function dispatchPlanUpgradeRequired(detail: PlanUpgradeDetail) {
  window.dispatchEvent(new CustomEvent(PLAN_UPGRADE_EVENT, { detail }))
}
