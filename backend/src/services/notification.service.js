/**
 * @file 通知服务 — 站内通知的创建、查询、标记已读。
 */
import { Notification } from '../models/index.js';

const MAX_LIMIT = 100;

/**
 * 获取当前用户的通知列表（分页）
 */
export async function listNotifications(auth, query = {}) {
  const { page = 1, limit = 20, type, is_read } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * pageSize;

  const where = {
    tenant_id: auth.tenantId,
    recipient_user_id: auth.userId,
  };
  if (type) where.type = type;
  if (is_read !== undefined && is_read !== null && is_read !== '') {
    where.is_read = is_read === 'true' || is_read === true;
  }

  const { count, rows } = await Notification.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    offset,
    limit: pageSize,
  });

  return {
    items: rows,
    total: count,
    page: pageNum,
    pageSize,
    totalPages: Math.ceil(count / pageSize),
  };
}

/**
 * 获取未读通知数量
 */
export async function getUnreadCount(auth) {
  return Notification.count({
    where: {
      tenant_id: auth.tenantId,
      recipient_user_id: auth.userId,
      is_read: false,
    },
  });
}

/**
 * 获取最近 N 条通知（供顶栏下拉用）
 */
export async function getRecentNotifications(auth, limit = 5) {
  return Notification.findAll({
    where: {
      tenant_id: auth.tenantId,
      recipient_user_id: auth.userId,
    },
    order: [['created_at', 'DESC']],
    limit: Math.min(20, parseInt(limit, 10) || 5),
  });
}

/**
 * 标记单条通知为已读
 */
export async function markRead(auth, notificationId) {
  const [count] = await Notification.update(
    { is_read: true, read_at: new Date() },
    {
      where: {
        id: notificationId,
        tenant_id: auth.tenant_id,
        recipient_user_id: auth.user.id,
      },
    },
  );
  return { success: count > 0 };
}

/**
 * 标记当前用户全部通知为已读
 */
export async function markAllRead(auth) {
  const [count] = await Notification.update(
    { is_read: true, read_at: new Date() },
    {
      where: {
        tenant_id: auth.tenant_id,
        recipient_user_id: auth.user.id,
        is_read: false,
      },
    },
  );
  return { success: true, affected: count };
}

/**
 * 创建一条通知（内部调用）
 */
export async function createNotification(tenantId, data) {
  const { recipient_user_id, type, title, body, related_type, related_id } = data;
  return Notification.create({
    tenant_id: tenantId,
    recipient_user_id,
    type,
    title,
    body: body || null,
    related_type: related_type || null,
    related_id: related_id ? String(related_id) : null,
  });
}

/**
 * 批量创建通知
 */
export async function createNotifications(tenantId, notifications) {
  const records = notifications.map((n) => ({
    tenant_id: tenantId,
    recipient_user_id: n.recipient_user_id,
    type: n.type,
    title: n.title,
    body: n.body || null,
    related_type: n.related_type || null,
    related_id: n.related_id ? String(n.related_id) : null,
  }));
  return Notification.bulkCreate(records);
}

/**
 * 获取通知类型常量（供前端筛选用）
 */
export function getNotificationTypes() {
  return [
    { value: 'lead_assigned', label: '线索分配' },
    { value: 'followup_reminder', label: '跟进提醒' },
    { value: 'stage_changed', label: '阶段变更' },
    { value: 'customer_transferred', label: '客户转移' },
    { value: 'deal_won', label: '成交' },
    { value: 'deal_lost', label: '丢单' },
    { value: 'comment_added', label: '新增评论' },
    { value: 'task_assigned', label: '任务分配' },
    { value: 'system_notice', label: '系统公告' },
    { value: 'ai_alert', label: 'AI预警' },
  ];
}
