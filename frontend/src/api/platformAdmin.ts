import { getJson } from '@/api/client'
import type { AuditLogItem } from '@/api/settings'

export function fetchTenantInboxAiAuditLogs(
  tenantId: number,
  params?: { page?: number; size?: number; days?: number; action?: string },
) {
  const q = new URLSearchParams()
  if (params?.page) q.set('page', String(params.page))
  if (params?.size) q.set('size', String(params.size))
  if (params?.days) q.set('days', String(params.days))
  if (params?.action) q.set('action', params.action)
  const qs = q.toString()
  return getJson<{
    list: AuditLogItem[]
    total: number
    page: number
    size: number
    days: number
  }>(`/platform/tenants/${tenantId}/inbox-ai-audit-logs${qs ? `?${qs}` : ''}`)
}

export const INBOX_AI_AUDIT_ACTION_LABELS: Record<string, string> = {
  inbox_ai_auto_sent: 'AI 自动发送',
  inbox_ai_auto_send_skipped: '自动发跳过',
  inbox_ai_qa_passed: '抽检通过',
  inbox_ai_qa_failed: '抽检有问题',
  platform_inbox_ai_disabled: '平台关停',
  platform_inbox_ai_enabled: '平台恢复',
}
