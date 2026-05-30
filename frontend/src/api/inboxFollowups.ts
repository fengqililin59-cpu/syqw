/**
 * @file 收件箱跟进任务 API。
 */
import { getJson, postJson } from '@/api/client'

export type InboxFollowupRow = {
  id: number
  title: string
  status: string
  due_at?: string | null
  thread_id?: number | null
  customer_id?: number | null
  owner_id?: number | null
  Customer?: { id: number; name?: string | null; nickname?: string | null; phone?: string | null }
  InboxThread?: { id: number; sales_stage: string; status: string }
}

export function fetchInboxFollowups(params?: {
  thread_id?: number
  customer_id?: number
  status?: string
  limit?: number
}) {
  return getJson<InboxFollowupRow[]>('/inbox/followups', { params })
}

export function createInboxFollowup(body: {
  title: string
  thread_id?: number
  customer_id?: number
  due_at?: string
}) {
  return postJson<InboxFollowupRow>('/inbox/followups', body)
}

export function completeInboxFollowup(id: number) {
  return postJson<InboxFollowupRow>(`/inbox/followups/${id}/done`)
}
