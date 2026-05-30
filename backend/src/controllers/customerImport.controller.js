/**
 * @file 客户批量导入控制器。
 */
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';
import * as customerImportService from '../services/customerImport.service.js';

export async function uploadAndParse(req, res) {
  if (!req.file) throw new HttpError(400, '请上传文件', 400);
  const job = await customerImportService.parseUploadedFile(
    req.auth.tenantId,
    req.auth.userId,
    req.file.path,
    req.file.originalname,
  );
  return ok(res, job);
}

export async function confirmImport(req, res) {
  const { duplicate_strategy = 'skip', default_owner_id, default_stage = 'new' } = req.body || {};
  if (!default_owner_id) throw new HttpError(400, '请选择默认负责人', 400);
  const job = await customerImportService.confirmImport(req.auth.tenantId, Number(req.params.jobId), {
    duplicate_strategy,
    default_owner_id: Number(default_owner_id),
    default_stage,
  });
  return ok(res, job);
}

export async function getStatus(req, res) {
  const job = await customerImportService.getJobStatus(req.auth.tenantId, Number(req.params.jobId));
  return ok(res, job);
}

export async function getResult(req, res) {
  const result = await customerImportService.getJobResult(req.auth.tenantId, Number(req.params.jobId));
  return ok(res, result);
}

export async function listHistory(req, res) {
  const { page = 1, size = 20 } = req.query;
  const data = await customerImportService.listJobs(req.auth.tenantId, { page: Number(page), size: Number(size) });
  return ok(res, data);
}
