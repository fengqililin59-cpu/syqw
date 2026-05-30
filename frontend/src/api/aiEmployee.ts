/**
 * @file AI 员工：草稿、审核、知识库、运营统计。
 */
import { deleteJson, getJson, postJson, putJson } from '@/api/client'
import type { AiOpsStats, AiReplyLogRow, KbDocumentRow, Paginated } from '@/api/types'

export function fetchAiOpsStats(params?: { days?: number }) {
  return getJson<AiOpsStats>('/ai-employee/stats', { params })
}

export function fetchPendingAiReplies(params?: { page?: number; size?: number; status?: string }) {
  return getJson<{ list: AiReplyLogRow[]; total: number; page: number; size: number }>(
    '/ai-employee/reply-pending',
    { params },
  )
}

export function createAiReplyDraft(body: {
  thread_id: number
  message?: string
  trigger_message_id?: number
}) {
  return postJson<{
    log_id: number
    draft_content: string
    intent: string
    confidence: number
    risk_level: string
    requires_approval: boolean
  }>('/ai-employee/reply-draft', body)
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
