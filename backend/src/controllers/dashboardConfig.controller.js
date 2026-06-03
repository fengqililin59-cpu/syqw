/**
 * @file 仪表盘配置控制器
 */
import * as service from '../services/dashboardConfig.service.js';
import { ok } from '../utils/response.js';

/** GET /dashboard/widget-config */
export async function getConfig(req, res) {
  const data = await service.getWidgetConfig(req.auth.tenantId);
  return ok(res, data);
}

/** PUT /dashboard/widget-config */
export async function saveConfig(req, res) {
  const data = await service.saveWidgetConfig(req.auth.tenantId, req.body);
  return ok(res, data, '布局已保存');
}

/** GET /dashboard/widget-config/templates */
export async function listTemplates(_req, res) {
  const data = service.listTemplates();
  return ok(res, data);
}

/** POST /dashboard/widget-config/templates/:key/apply */
export async function applyTemplate(req, res) {
  const data = await service.applyTemplate(req.auth.tenantId, req.params.key);
  return ok(res, data, '模板已应用');
}
