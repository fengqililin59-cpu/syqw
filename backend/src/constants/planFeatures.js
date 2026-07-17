/**
 * @file 套餐功能 token（plans.features JSON）与别名映射。
 */

/** 付费专属能力（体验版不含） */
export const PREMIUM_FEATURES = {
  AI_INTENT_SCORE: 'ai_intent_score',
  AI_COACH_DAILY: 'ai_coach_daily',
  ADS_ROI: 'ads_roi',
  ARCHIVE_ANALYSIS: 'archive_analysis',
  OCEAN_LEAD: 'ocean_lead',
};

/** token → 可满足的 plan.features 别名（向后兼容旧 seed） */
export const FEATURE_ALIASES = {
  [PREMIUM_FEATURES.AI_INTENT_SCORE]: ['ai_intent_score', 'intent_alert'],
  [PREMIUM_FEATURES.AI_COACH_DAILY]: ['ai_coach_daily'],
  [PREMIUM_FEATURES.ADS_ROI]: ['ads_roi', 'campaign'],
  [PREMIUM_FEATURES.ARCHIVE_ANALYSIS]: ['archive_analysis'],
  [PREMIUM_FEATURES.OCEAN_LEAD]: ['ocean_lead'],
  ai_full: ['ai_full'],
  automation: ['automation'],
};

/**
 * @param {string[] | null | undefined} planFeatures
 * @param {string} featureToken
 */
export function planIncludesFeature(planFeatures, featureToken) {
  const list = Array.isArray(planFeatures) ? planFeatures : [];
  if (list.includes('all')) return true;
  const aliases = FEATURE_ALIASES[featureToken] || [featureToken];
  return aliases.some((a) => list.includes(a));
}
