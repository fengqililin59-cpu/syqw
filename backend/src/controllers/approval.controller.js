/**
 * @file 审批控制器。
 */
import * as approvalService from '../services/approval.service.js';
import { ok } from '../utils/response.js';

// ---- 模板 ----
export async function listTemplates(req, res) {
  return ok(res, await approvalService.listTemplates(req.auth, req.query));
}
export async function getTemplate(req, res) {
  return ok(res, await approvalService.getTemplate(req.auth, req.params.id));
}
export async function createTemplate(req, res) {
  return ok(res, await approvalService.createTemplate(req.auth, req.body));
}
export async function updateTemplate(req, res) {
  return ok(res, await approvalService.updateTemplate(req.auth, req.params.id, req.body));
}
export async function deleteTemplate(req, res) {
  return ok(res, await approvalService.deleteTemplate(req.auth, req.params.id));
}

// ---- 审批操作 ----
export async function submit(req, res) {
  return ok(res, await approvalService.submitApproval(req.auth, req.body));
}
export async function approve(req, res) {
  const comment = req.body.comment || null;
  return ok(res, await approvalService.approveStep(req.auth, req.params.id, comment));
}
export async function reject(req, res) {
  const comment = req.body.comment || null;
  return ok(res, await approvalService.rejectStep(req.auth, req.params.id, comment));
}
export async function cancel(req, res) {
  return ok(res, await approvalService.cancelApproval(req.auth, req.params.id));
}

// ---- 查询 ----
export async function getInstance(req, res) {
  return ok(res, await approvalService.getInstance(req.auth, req.params.id));
}
export async function listMyApplications(req, res) {
  return ok(res, await approvalService.listMyApplications(req.auth, req.query));
}
export async function listPendingApprovals(req, res) {
  return ok(res, await approvalService.listPendingApprovals(req.auth, req.query));
}
export async function listProcessedApprovals(req, res) {
  return ok(res, await approvalService.listProcessedApprovals(req.auth, req.query));
}
