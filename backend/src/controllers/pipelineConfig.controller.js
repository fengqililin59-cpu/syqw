/**
 * @file 销售管道配置控制器
 */
import * as svc from '../services/pipelineConfig.service.js';
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';

function tenantIdFromAuth(req) {
  const tenantId = req.auth?.tenantId;
  if (tenantId == null || !Number.isFinite(Number(tenantId))) {
    throw new HttpError(401, '未登录或租户无效', 401);
  }
  return Number(tenantId);
}

/** GET /api/pipeline/config — 获取当前管道配置 */
export async function getConfig(req, res) {
  const tenantId = tenantIdFromAuth(req);
  const config = await svc.getPipelineConfig(tenantId);
  return ok(res, config);
}

/** GET /api/pipeline/stages — 获取管道阶段列表（仅用于看板） */
export async function getStages(req, res) {
  const tenantId = tenantIdFromAuth(req);
  const stages = await svc.getPipelineStages(tenantId);
  return ok(res, stages);
}

/** PUT /api/pipeline/config — 保存管道配置 */
export async function saveConfig(req, res) {
  const tenantId = tenantIdFromAuth(req);
  const { stages } = req.body;
  if (!stages) {
    return res.status(400).json({ error: '缺少 stages 参数' });
  }
  const result = await svc.savePipelineConfig(tenantId, stages);
  return ok(res, result, '已保存');
}

/** POST /api/pipeline/reset — 重置为默认管道 */
export async function resetConfig(req, res) {
  const tenantId = tenantIdFromAuth(req);
  const result = await svc.resetPipelineConfig(tenantId);
  return ok(res, result, '已重置');
}

/** GET /api/pipeline/templates — 获取管道模板列表 */
export async function listTemplates(req, res) {
  const templates = svc.getPipelineTemplates();
  return ok(res, templates);
}

/** POST /api/pipeline/templates/:key/apply — 应用管道模板 */
export async function applyTemplate(req, res) {
  const tenantId = tenantIdFromAuth(req);
  const { key } = req.params;
  const result = await svc.applyPipelineTemplate(tenantId, key);
  return ok(res, result, '模板已应用');
}
