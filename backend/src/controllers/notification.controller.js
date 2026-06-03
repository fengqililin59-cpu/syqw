/**
 * @file 通知中心控制器。
 */
import * as notificationService from '../services/notification.service.js';
import { ok } from '../utils/response.js';

export async function list(req, res) {
  const result = await notificationService.listNotifications(req.auth, req.query);
  return ok(res, result);
}

export async function unreadCount(req, res) {
  const count = await notificationService.getUnreadCount(req.auth);
  return ok(res, { count });
}

export async function recent(req, res) {
  const limit = parseInt(req.query.limit, 10) || 5;
  const items = await notificationService.getRecentNotifications(req.auth, limit);
  const count = await notificationService.getUnreadCount(req.auth);
  return ok(res, { items, unreadCount: count });
}

export async function markRead(req, res) {
  const result = await notificationService.markRead(req.auth, req.params.id);
  return ok(res, result);
}

export async function markAllRead(req, res) {
  const result = await notificationService.markAllRead(req.auth);
  return ok(res, result);
}

export async function types(req, res) {
  const types = notificationService.getNotificationTypes();
  return ok(res, types);
}
