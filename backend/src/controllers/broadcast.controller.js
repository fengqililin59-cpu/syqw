/**
 * @file 群发任务 HTTP 入口。
 */
import * as broadcastService from '../services/broadcast.service.js';
import { ok } from '../utils/response.js';

export async function list(req, res) {
  const data = await broadcastService.listBroadcastTasks(req.auth, req.query);
  return ok(res, data);
}

export async function exportList(req, res) {
  const data = await broadcastService.exportBroadcastTasks(req.auth, req.query);
  return ok(res, data);
}

export async function getOne(req, res) {
  const data = await broadcastService.getBroadcastTask(req.auth, req.params.id);
  return ok(res, data);
}

export async function create(req, res) {
  const data = await broadcastService.createBroadcastTask(req.auth, req.body, {
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data, '已创建');
}

export async function cancel(req, res) {
  const data = await broadcastService.cancelBroadcastTask(req.auth, req.params.id);
  return ok(res, data, '已取消');
}

export async function recipients(req, res) {
  const data = await broadcastService.getBroadcastTaskRecipients(req.auth, req.params.id, req.query);
  return ok(res, data);
}

export async function run(req, res) {
  const data = await broadcastService.runBroadcastTaskNow(req.auth, req.params.id, {
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data, '已开始发送');
}
