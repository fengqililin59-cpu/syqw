import { Customer, User } from '../models/index.js';
import { DEMO_TENANT_ID } from '../config/constants.js';

export async function demoModeMiddleware(req, res, next) {
  try {
    if (!req.user || !req.auth) return next();

    const currentTenantId = Number(req.auth.tenantId);
    const isGuest = Boolean(req.auth.isGuest);
    const isDemoTenant = currentTenantId === DEMO_TENANT_ID;
    const shouldForceDemo = isGuest || isDemoTenant;
    if (!req.user.demo_mode && !shouldForceDemo) return next();

    const path = String(req.path || '');
    const method = String(req.method || 'GET').toUpperCase();
    const canWriteInDemo = path.endsWith('/exit-demo') || (path.endsWith('/wework') && method === 'PUT');

    // 演示模式默认只读；允许退出演示与企微配置保存
    if (method !== 'GET' && !canWriteInDemo) {
      return res.status(403).json({
        code: 403,
        message: '演示模式仅支持查看，请配置企微后使用完整功能',
        data: { is_demo: true },
      });
    }

    if (!shouldForceDemo) {
      const realCount = await Customer.count({
        where: { tenant_id: req.auth.tenantId, deleted_at: null },
      });

      if (realCount > 0) {
        await User.update({ demo_mode: 0 }, { where: { id: req.user.id } }).catch(console.error);
        return next();
      }
    }

    req.auth = {
      ...req.auth,
      tenantId: DEMO_TENANT_ID,
      isDemo: true,
    };
    req.user.demo_mode = true;
    res.setHeader('X-Demo-Mode', '1');
    return next();
  } catch (err) {
    console.error('[DemoMode]', err);
    return next();
  }
}
