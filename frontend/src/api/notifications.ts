/**
 * @file 通知中心 API。
 */
import { getJson, putJson } from '@/api/client'

// --- 类型定义 ---

export type NotificationType =
  | 'lead_assigned'
  | 'followup_reminder'
  | 'stage_changed'
  | 'customer_transferred'
  | 'deal_won'
  | 'deal_lost'
  | 'comment_added'
  | 'task_assigned'
  | 'system_notice'
  | 'ai_alert'

export interface Notification {
  id: number
  tenant_id: number
  recipient_user_id: number
  type: NotificationType
  title: string
  body: string | null
  related_type: string | null
  related_id: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface NotificationListResult {
  items: Notification[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface RecentResult {
  items: Notification[]
  unreadCount: number
}

export interface UnreadCountResult {
  count: number
}

export interface MarkAllReadResult {
  success: boolean
  affected: number
}

export interface NotificationTypeInfo {
  value: NotificationType
  label: string
}

// --- API 函数 ---

/** 通知列表（分页） */
export function fetchNotifications(params?: {
  page?: number
  limit?: number
  type?: NotificationType
  is_read?: boolean
}): Promise<NotificationListResult> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.type) searchParams.set('type', params.type)
  if (params?.is_read !== undefined) searchParams.set('is_read', String(params.is_read))
  return getJson(`/notifications?${searchParams.toString()}`)
}

/** 未读数量 */
export function fetchUnreadCount(): Promise<UnreadCountResult> {
  return getJson('/notifications/unread-count')
}

/** 最近 N 条 + 未读数（顶栏下拉用） */
export function fetchRecentNotifications(limit = 5): Promise<RecentResult> {
  return getJson(`/notifications/recent?limit=${limit}`)
}

/** 通知类型常量 */
export function fetchNotificationTypes(): Promise<NotificationTypeInfo[]> {
  return getJson('/notifications/types')
}

/** 标记单条已读 */
export function markNotificationRead(id: number): Promise<{ success: boolean }> {
  return putJson(`/notifications/${id}/read`)
}

/** 全部已读 */
export function markAllNotificationsRead(): Promise<{ success: boolean; data: MarkAllReadResult }> {
  return putJson('/notifications/read-all')
}
