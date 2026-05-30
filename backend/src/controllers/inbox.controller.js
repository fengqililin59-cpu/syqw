/**
 * @file 统一收件箱 HTTP 入口。
 */
import * as inboxService from '../services/inbox.service.js';
import * as inboxFollowupService from '../services/inboxFollowup.service.js';
import { runInboxSlaReminderOnce } from '../services/inboxSlaReminder.service.js';
import * as ticketService from '../services/ticket.service.js';
import { getPublicWebhookInfo, testPublicWebhookSimulation } from '../services/publicInboxIngest.service.js';
import { HttpError } from '../utils/httpError.js';
import { isAdmin } from '../utils/permissions.js';
import { ok } from '../utils/response.js';

export async function listThreads(req, res) {
  const data = await inboxService.listThreads(req.auth, req.query);
  return ok(res, data);
}

export async function getMessages(req, res) {
  const data = await inboxService.getThreadMessages(req.auth, req.params.id, req.query);
  return ok(res, data);
}

export async function reply(req, res) {
  const data = await inboxService.replyThread(req.auth, req.params.id, req.body);
  return ok(res, data, '已发送');
}

export async function updateThread(req, res) {
  const data = await inboxService.updateThread(req.auth, req.params.id, req.body);
  return ok(res, data, '已更新');
}

export async function webhookIngest(req, res) {
  const data = await inboxService.ingestWebhook(req.auth, req.params.channel, req.body);
  return ok(res, data, '已入站');
}

export async function syncWework(req, res) {
  const data = await inboxService.runWeworkSync(req.auth, req.body);
  return ok(res, data, '同步完成');
}

export async function listFollowups(req, res) {
  const data = await inboxFollowupService.listFollowups(req.auth, req.query);
  return ok(res, data);
}

export async function createFollowup(req, res) {
  const data = await inboxFollowupService.createFollowup(req.auth, req.body);
  return ok(res, data, '已创建');
}

export async function completeFollowup(req, res) {
  const data = await inboxFollowupService.completeFollowup(req.auth, req.params.id);
  return ok(res, data, '已完成');
}

/** 管理员手动触发 SLA 扫描（联调） */
export async function webhookInfo(req, res) {
  const data = await getPublicWebhookInfo(req.auth.tenantId);
  return ok(res, data);
}

/** 管理员模拟公域 Webhook 入站（联调收件箱） */
export async function webhookTest(req, res) {
  if (!isAdmin(req.auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const data = await testPublicWebhookSimulation(req.auth, req.body);
  const msg = data.deduplicated ? '重复消息已忽略（去重）' : '测试入站成功';
  return ok(res, data, msg);
}

export async function createTicketFromThread(req, res) {
  const data = await ticketService.createTicketFromThread(req.auth, req.params.id, req.body);
  return ok(res, data, '工单已创建');
}

export async function runSlaScan(req, res) {
  if (!isAdmin(req.auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const data = await runInboxSlaReminderOnce(Number(req.body?.limit) || 10);
  return ok(res, data, '扫描完成');
}
