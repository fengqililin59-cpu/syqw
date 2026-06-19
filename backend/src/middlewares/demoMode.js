import { Customer, Tenant, User } from '../models/index.js';
import { DEMO_TENANT_ID } from '../config/constants.js';

export async function demoModeMiddleware(req, res, next) {
  try {
    if (!req.user || !req.auth) return next();

    const currentTenantId = Number(req.auth.tenantId);
    const isGuest = Boolean(req.auth.isGuest);
    const isDemoTenant = currentTenantId === DEMO_TENANT_ID;
    const shouldForceDemo = isGuest || isDemoTenant;
    if (!req.user.demo_mode && !shouldForceDemo) {
      res.setHeader('X-Demo-Mode', '0');
      return next();
    }

    const path = String(req.path || '');
    const method = String(req.method || 'GET').toUpperCase();
    const canWriteInDemo =
      path.endsWith('/exit-demo') ||
      (path.endsWith('/wework') && method === 'PUT') ||
      path.startsWith('/ai/');   // 演示模式允许体验 AI 功能

    // 演示模式默认只读；允许退出演示、企微配置保存、AI 调用
    if (method !== 'GET' && !canWriteInDemo) {
      return res.status(403).json({
        code: 403,
        message: '演示模式仅支持查看，请配置企微后使用完整功能',
        data: { is_demo: true },
      });
    }

    if (!shouldForceDemo) {
      const tenant = await Tenant.findByPk(req.auth.tenantId, {
        attributes: ['wework_corp_id', 'wework_secret'],
      });
      const weworkConfigured = Boolean(
        String(tenant?.wework_corp_id || '').trim() && String(tenant?.wework_secret || '').trim(),
      );

      if (weworkConfigured) {
        if (req.user.demo_mode) {
          await User.update({ demo_mode: 0 }, { where: { id: req.user.id } }).catch(console.error);
          req.user.demo_mode = false;
        }
        res.setHeader('X-Demo-Mode', '0');
        return next();
      }

      const realCount = await Customer.count({
        where: { tenant_id: req.auth.tenantId, deleted_at: null },
      });

      if (realCount > 0) {
        await User.update({ demo_mode: 0 }, { where: { id: req.user.id } }).catch(console.error);
        req.user.demo_mode = false;
        res.setHeader('X-Demo-Mode', '0');
        return next();
      }
    }

    req.auth = {
      ...req.auth,
      tenantId: DEMO_TENANT_ID,
      isDemo: true,
    };
    // 兼容旧代码：确保 req.tenantId 与 req.auth.tenantId 同步
    req.tenantId = req.auth.tenantId;
    req.user.demo_mode = true;
    res.setHeader('X-Demo-Mode', '1');
    return next();
  } catch (err) {
    console.error('[DemoMode]', err);
    return next();
  }
}
