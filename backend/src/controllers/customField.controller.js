/**
 * @file 自定义字段控制器
 */
import * as svc from '../services/customField.service.js';

/** GET /api/custom-fields/defs */
export async function listDefs(req, res) {
  const { activeOnly } = req.query;
  const rows = await svc.getFieldDefs(req.auth.tenantId, { activeOnly: activeOnly === 'true' || activeOnly === '1' });
  res.json({ data: rows });
}

/** POST /api/custom-fields/defs */
export async function createDef(req, res) {
  const row = await svc.createFieldDef(req.auth.tenantId, req.body);
  res.status(201).json({ data: row });
}

/** PUT /api/custom-fields/defs/:id */
export async function updateDef(req, res) {
  const row = await svc.updateFieldDef(req.auth.tenantId, req.params.id, req.body);
  res.json({ data: row });
}

/** DELETE /api/custom-fields/defs/:id */
export async function deleteDef(req, res) {
  const result = await svc.deleteFieldDef(req.auth.tenantId, req.params.id);
  res.json(result);
}

/** GET /api/custom-fields/templates */
export async function listTemplates(_req, res) {
  const templates = svc.getIndustryTemplates();
  res.json({ data: templates });
}

/** POST /api/custom-fields/templates/:key/apply */
export async function applyTemplate(req, res) {
  const result = await svc.applyTemplate(req.auth.tenantId, req.params.key);
  res.json({ message: `已应用 ${result.added}/${result.total} 个字段`, ...result });
}

/** GET /api/customers/:id/custom-fields */
export async function getCustomerFields(req, res) {
  const fields = await svc.getCustomerFieldValues(req.auth.tenantId, req.params.id);
  res.json({ data: fields });
}

/** PUT /api/customers/:id/custom-fields */
export async function saveCustomerFields(req, res) {
  const rows = await svc.saveCustomerFieldValues(req.auth.tenantId, req.params.id, req.body.fieldValues ?? req.body);
  res.json({ data: rows, message: '保存成功' });
}
