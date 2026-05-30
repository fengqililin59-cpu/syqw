/**
 * @file 群发任务 API。
 */
import { getJson, postJson } from '@/api/client'
import type { ExportCustomersResult, Paginated } from '@/api/types'

export type BroadcastChannel = 'wecom_mass' | 'mock'

export type BroadcastTaskRow = {
  id: number
  tenant_id: number
  name: string
  channel: BroadcastChannel
  content: unknown
  msg_type?: 'text' | 'image' | 'link' | 'miniprogram'
  filter_json: { tag_ids?: number[]; stage?: string | null } | null
  status: string
  scheduled_at: string | null
  started_at: string | null
  finished_at: string | null
  stats_json: { target?: number; success?: number; fail?: number; pending?: number } | null
  wecom_msgid?: string | null
  send_fail_detail?: unknown
  is_sync_completed?: boolean
  error_message: string | null
  created_by: number | null
  created_at: string
  updated_at: string
  recipient_count?: number
}

export function fetchBroadcastTasks(params?: { page?: number; size?: number; status?: string }) {
  return getJson<Paginated<BroadcastTaskRow>>('/broadcast-tasks', { params })
}

export function fetchBroadcastTask(id: number) {
  return getJson<BroadcastTaskRow>(`/broadcast-tasks/${id}`)
}

export function createBroadcastTask(body: {
  name: string
  channel: BroadcastChannel
  content: string | Record<string, unknown>
  filter_json?: { tag_ids?: number[]; stage?: string | null }
  scheduled_at?: string | null
  run_now?: boolean
}) {
  return postJson<BroadcastTaskRow>('/broadcast-tasks', body)
}

export function cancelBroadcastTask(id: number) {
  return postJson<BroadcastTaskRow>(`/broadcast-tasks/${id}/cancel`)
}

export function runBroadcastTask(id: number) {
  return postJson<BroadcastTaskRow>(`/broadcast-tasks/${id}/run`)
}

export function fetchBroadcastRecipients(
  id: number,
  params?: { page?: number; size?: number; send_status?: string },
) {
  return getJson<Paginated<Record<string, unknown>>>(`/broadcast-tasks/${id}/recipients`, { params })
}

export function exportBroadcastTasks(params?: { status?: string }) {
  return getJson<ExportCustomersResult>('/broadcast-tasks/export', { params })
}
