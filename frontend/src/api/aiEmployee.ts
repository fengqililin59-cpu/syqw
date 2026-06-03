/**
 * @file AI 员工：草稿、审核、知识库、运营统计。
 */
import { deleteJson, getJson, postJson, putJson } from '@/api/client'
import type { AiOpsStats, AiReplyLogRow, KbDocumentRow, Paginated } from '@/api/types'

export function fetchAiOpsStats(params?: { days?: number }) {
  return getJson<AiOpsStats>('/ai-employee/stats', { params })
}

export function fetchPendingAiReplies(params?: {
  page?: number
  size?: number
  status?: string
  view?: 'draft' | 'auto_sent' | 'rejected'
  days?: number
}) {
  return getJson<{ list: AiReplyLogRow[]; total: number; page: number; size: number }>(
    '/ai-employee/reply-pending',
    { params },
  )
}

export function createAiReplyDraft(body: {
  thread_id: number
  message?: string
  trigger_message_id?: number
  include_playbook_context?: boolean
}) {
  return postJson<{
    log_id: number
    draft_content: string
    intent: string
    confidence: number
    risk_level: string
    requires_approval: boolean
    auto_sent?: boolean
    auto_sent_kind?: string | null
    auto_send_skipped?: string | null
    auto_send_skip_message?: string | null
    qa_status?: string | null
    qa_note?: string | null
    risk_source?: string
    risk_reasons?: string[]
    must_human?: boolean
    customer_delivered?: boolean
    delivery_note?: string | null
    playbook_used?: boolean
    playbook_scripts_count?: number
    playbook_has_intent_alert?: boolean
  }>('/ai-employee/reply-draft', body)
}

export function pushAiAutoReplyDigest() {
  return postJson<{
    sent: number
    skipped?: string
    auto_sent_count?: number
    threads_count?: number
  }>('/ai-employee/push-auto-reply-digest', {})
}

export function fetchAiQaQueue(params?: { page?: number; size?: number; view?: string; days?: number }) {
  return getJson<{
    list: AiReplyLogRow[]
    total: number
    page: number
    size: number
    pending_count: number
    sample_rate: number
    days: number
  }>('/ai-employee/qa-queue', { params })
}

export function submitAiQaReview(logId: number, body: { result: 'passed' | 'failed'; note?: string }) {
  return postJson<{ log: AiReplyLogRow }>(`/ai-employee/qa-queue/${logId}/review`, body)
}

export function approveAiReply(body: {
  log_id: number
  action: 'approve' | 'reject'
  edited_content?: string
}) {
  return postJson<unknown>('/ai-employee/reply-approve', body)
}

export function fetchKbDocuments(params?: { page?: number; size?: number; status?: string }) {
  return getJson<Paginated<KbDocumentRow>>('/ai-employee/kb', { params })
}

export function createKbDocument(body: { title: string; category?: string; content_text: string }) {
  return postJson<KbDocumentRow>('/ai-employee/kb', body)
}

export function fetchKbDocument(id: number) {
  return getJson<KbDocumentRow>(`/ai-employee/kb/${id}`)
}

export function updateKbDocument(
  id: number,
  body: Partial<{ title: string; category: string; content_text: string; status: string }>,
) {
  return putJson<KbDocumentRow>(`/ai-employee/kb/${id}`, body)
}

export function archiveKbDocument(id: number) {
  return deleteJson<{ id: number; status: string }>(`/ai-employee/kb/${id}`)
}

export function reindexKbDocument(id: number) {
  return postJson<{ id: number; index_stats?: { chunks: number; embedded: number } }>(
    `/ai-employee/kb/${id}/reindex`,
    {},
  )
}

export function reindexAllKbDocuments() {
  return postJson<{ documents: number; chunks: number; embedded: number }>(
    '/ai-employee/kb/reindex-all',
    {},
  )
}
