/**
 * @file 统一收件箱 API。
 */
import { getJson, patchJson, postJson } from '@/api/client'
import type { InboxMessageRow, InboxThreadRow, Paginated } from '@/api/types'

export type InboxThreadFilter =
  | 'all'
  | 'needs_reply'
  | 'sla_overdue'
  | 'pending_human'
  | 'ai_auto_sent'
export type InboxThreadSort = 'priority' | 'recent'

export function fetchInboxThreads(params?: {
  page?: number
  size?: number
  status?: string
  channel_code?: string
  customer_id?: number
  sort?: InboxThreadSort
  filter?: InboxThreadFilter
}) {
  return getJson<Paginated<InboxThreadRow>>('/inbox/threads', { params })
}

export function fetchInboxMessages(threadId: number, params?: { limit?: number }) {
  return getJson<{ list: InboxMessageRow[] }>(`/inbox/threads/${threadId}/messages`, { params })
}

export type InboxReplyResult = InboxMessageRow & {
  wework_send?: {
    sent?: boolean
    skipped?: boolean
    reason?: string
    via?: string
    msgid?: string | null
  }
}

export function replyInboxThread(threadId: number, body: { content: string }) {
  return postJson<InboxReplyResult>(`/inbox/threads/${threadId}/reply`, body)
}

export function updateInboxThread(
  threadId: number,
  body: { status?: string; sales_stage?: string; assignee_id?: number },
) {
  return patchJson<InboxThreadRow>(`/inbox/threads/${threadId}`, body)
}

export function syncInboxWework(body?: { limit?: number }) {
  return postJson<{ scanned: number; synced: number; skipped: number }>('/inbox/sync-wework', body ?? {})
}

export type InboxSlaBatchAction = 'pending_human' | 'assign' | 'snooze' | 'clear_snooze'

export function fetchInboxSlaSummary() {
  return getJson<{
    sla_minutes: number
    sla_overdue_total: number
    sla_overdue_active: number
    sla_snoozed: number
  }>('/inbox/sla/summary')
}

export function inboxSlaBatchAction(body: {
  action: InboxSlaBatchAction
  thread_ids: number[]
  assignee_id?: number
  snooze_hours?: number
}) {
  return postJson<{ updated: number; total: number }>('/inbox/sla/batch', body)
}

export function runInboxSlaScan(limit = 10) {
  return postJson<{ notified: number; scanned: number }>('/inbox/sla-scan', { limit })
}
