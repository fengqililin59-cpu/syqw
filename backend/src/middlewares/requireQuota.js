/**
 * @file 配额守卫：达到上限时返回 402（可引导升级套餐）。
 */
import * as billingService from '../services/billing.service.js';

function resourceLabel(resource) {
  const map = {
    customers: '客户数',
    seats: '席位数',
    broadcasts: '本月群发次数',
    ai_calls: '本月AI调用次数',
  };
  return map[resource] ?? resource;
}

/**
 * 用法：router.post('/', requireQuota('customers'), handler)
 * @param {'customers'|'seats'|'broadcasts'|'ai_calls'} resource
 */
export function requireQuota(resource) {
  return async (req, res, next) => {
    try {
      // 演示/访客用户跳过配额检查（由 controller 层返回预置内容）
      if (req.auth?.isGuest || req.auth?.isDemo) return next();
      const tenantId = req.auth?.tenantId ?? req.user?.tenant_id;
      if (!tenantId) return next();

      const result = await billingService.checkQuota(Number(tenantId), resource);
      if (!result.allowed) {
        return res.status(402).json({
          code: 402,
          message: `已达到${resourceLabel(resource)}上限（${result.current}/${result.limit}），请升级套餐`,
          data: {
            resource,
            current: result.current,
            limit: result.limit,
            upgrade_url: '/app/billing',
          },
        });
      }
      return next();
    } catch (err) {
      console.error('[Quota]', err);
      return next();
    }
  };
}
