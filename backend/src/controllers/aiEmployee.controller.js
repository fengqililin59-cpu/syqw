/**
 * @file AI 员工：草稿、审核、运营统计。
 */
import * as aiEmployeeService from '../services/aiEmployee.service.js';
import * as aiAutoReplyDigestService from '../services/aiAutoReplyDigest.service.js';
import * as inboxAiQaService from '../services/inboxAiQa.service.js';
import * as kbService from '../services/kb.service.js';
import { ok } from '../utils/response.js';

export async function replyDraft(req, res) {
  const data = await aiEmployeeService.createReplyDraft(req.auth, req.body);
  return ok(res, data);
}

export async function replyApprove(req, res) {
  const data = await aiEmployeeService.approveReply(req.auth, req.body);
  return ok(res, data, '已处理');
}

export async function pendingReplies(req, res) {
  const data = await aiEmployeeService.listPendingReplies(req.auth, req.query);
  return ok(res, data);
}

export async function opsStats(req, res) {
  const data = await aiEmployeeService.getOpsStats(req.auth, req.query);
  return ok(res, data);
}

export async function listKb(req, res) {
  const data = await kbService.listDocuments(req.auth, req.query);
  return ok(res, data);
}

export async function createKb(req, res) {
  const data = await kbService.createDocument(req.auth, req.body);
  return ok(res, data, '已创建');
}

export async function getKb(req, res) {
  const data = await kbService.getDocument(req.auth, req.params.id);
  return ok(res, data);
}

export async function updateKb(req, res) {
  const data = await kbService.updateDocument(req.auth, req.params.id, req.body);
  return ok(res, data, '已更新');
}

export async function archiveKb(req, res) {
  const data = await kbService.archiveDocument(req.auth, req.params.id);
  return ok(res, data, '已归档');
}

export async function reindexKb(req, res) {
  const data = await kbService.reindexDocument(req.auth, req.params.id);
  return ok(res, data, '已重建索引');
}

export async function pushAutoReplyDigest(req, res) {
  const data = await aiAutoReplyDigestService.pushAiAutoReplyDigestToWework(req.auth);
  return ok(res, data, data.sent > 0 ? '已推送' : '未发送');
}

export async function reindexAllKb(req, res) {
  const data = await kbService.reindexAllDocuments(req.auth);
  return ok(res, data, '已重建全部索引');
}

export async function qaQueue(req, res) {
  const data = await inboxAiQaService.listAiAutoSendQaQueue(req.auth, req.query);
  return ok(res, data);
}

export async function qaReview(req, res) {
  const data = await inboxAiQaService.submitAiAutoSendQaReview(req.auth, req.params.id, req.body);
  return ok(res, data, '已提交抽检');
}
