/**
 * @file 个人微信客户迁移 API。
 */
import * as migrationService from '../services/migration.service.js';
import { ok } from '../utils/response.js';

export async function createCampaign(req, res) {
  const data = await migrationService.createCampaign(req.auth, req.body);
  return ok(res, data, '创建成功');
}

export async function listCampaigns(req, res) {
  const data = await migrationService.listCampaigns(req.auth.tenantId, req.query);
  return ok(res, data);
}

export async function getCampaignDetail(req, res) {
  const data = await migrationService.getCampaignDetail(req.auth.tenantId, Number(req.params.id));
  return ok(res, data);
}

export async function updateCampaign(req, res) {
  const data = await migrationService.updateCampaign(req.auth, Number(req.params.id), req.body);
  return ok(res, data, '已更新');
}

export async function importContacts(req, res) {
  const file = req.file;
  const data = await migrationService.importContactsHandler(
    req.auth,
    Number(req.params.id),
    req.body,
    file?.buffer,
    file?.originalname,
  );
  return ok(res, data, '导入完成');
}

export async function listRecords(req, res) {
  const data = await migrationService.listRecords(req.auth.tenantId, Number(req.params.id), req.query);
  return ok(res, data);
}

export async function updateRecordStatus(req, res) {
  const data = await migrationService.updateRecordStatus(req.auth, Number(req.params.id), req.body);
  return ok(res, data, '已更新');
}

export async function generateScript(req, res) {
  const data = await migrationService.generateScript(req.auth, Number(req.params.id));
  return ok(res, data);
}
