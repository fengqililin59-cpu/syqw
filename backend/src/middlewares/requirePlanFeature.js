/**
 * @file 套餐功能守卫：体验版访问付费能力时返回 402（前端弹出升级引导）。
 */
import * as billingService from '../services/billing.service.js';

const FEATURE_LABELS = {
  ai_intent_score: 'AI 意向评分',
  ai_coach_daily: 'AI 教练日报',
  ads_roi: '广告 ROI 归因',
  archive_analysis: '会话存档分析',
  ocean_lead: '巨量引擎表单接入',
};

/**
 * @param {string} featureToken plans.features 中的能力 token
 */
export function requirePlanFeature(featureToken) {
  return async (req, res, next) => {
    try {
      if (req.auth?.isGuest || req.auth?.isDemo) return next();

      const tenantId = req.auth?.tenantId ?? req.user?.tenant_id;
      if (!tenantId) return next();

      const ok = await billingService.hasPlanFeature(Number(tenantId), featureToken);
      if (ok) return next();

      const label = FEATURE_LABELS[featureToken] || featureToken;
      return res.status(402).json({
        code: 402,
        message: `${label}为专业版专属能力，升级后即可使用`,
        data: {
          reason: 'plan_feature',
          feature: featureToken,
          feature_label: label,
          upgrade_url: '/app/billing',
          recommended_plan: 'pro',
        },
      });
    } catch (e) {
      return next(e);
    }
  };
}
