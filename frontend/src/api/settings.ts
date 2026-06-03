import { getJson, putJson, postJson } from '@/api/client'

export type AuditLogItem = {
  id: number
  tenant_id: number
  actor_user_id: number | null
  action: string
  target_type: string
  target_id: string | null
  detail_json: Record<string, unknown> | null
  ip: string | null
  user_agent: string | null
  created_at: string
  actor?: {
    id: number
    username: string
    real_name: string | null
  } | null
}

export type AuditLogListResult = {
  list: AuditLogItem[]
  total: number
  page: number
  size: number
}

export async function listAuditLogs(params: {
  page?: number
  size?: number
  action?: string
  target_type?: string
  actor_user_id?: number | null
  start_date?: string
  end_date?: string
}) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.size) q.set('size', String(params.size))
  if (params.action) q.set('action', params.action)
  if (params.target_type) q.set('target_type', params.target_type)
  if (params.actor_user_id) q.set('actor_user_id', String(params.actor_user_id))
  if (params.start_date) q.set('start_date', params.start_date)
  if (params.end_date) q.set('end_date', params.end_date)
  return getJson<AuditLogListResult>(`/settings/audit-logs?${q.toString()}`)
}

export type IntentAlertItem = {
  id: number
  created_at: string
  sent_at: string | null
  status: string
  score_before: number
  score_after: number
  score_delta: number
  ai_script: string | null
  customer: { id: number; name: string | null }
  owner: { id: number; username: string; real_name?: string | null }
}

export type IntentAlertListResult = {
  list: IntentAlertItem[]
  total: number
  page: number
  size: number
}

export type IntentAlertPlaybook = {
  alert: {
    id: number | null
    score_before: number
    score_after: number
    score_delta: number
    ai_script: string | null
    created_at: string
  }
  customer: {
    id: number
    name: string
    stage?: string | null
    stage_label?: string | null
    intent_score?: number | null
  }
  recommended_scripts: { id: number; title: string; category: string; body: string; body_preview: string }[]
  ai_prompt: string
  links: {
    customer: string
    ai_assistant: string
    script_library: string
  }
}

export async function fetchIntentAlertPlaybook(alertId: number) {
  return getJson<IntentAlertPlaybook>(`/settings/intent-alerts/${alertId}/playbook`)
}

export async function listIntentAlerts(params: {
  page?: number
  size?: number
  status?: string
  start_date?: string
  end_date?: string
}) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.size) q.set('size', String(params.size))
  if (params.status) q.set('status', params.status)
  if (params.start_date) q.set('start_date', params.start_date)
  if (params.end_date) q.set('end_date', params.end_date)
  return getJson<IntentAlertListResult>(`/settings/intent-alerts?${q.toString()}`)
}

export type LeadAssignmentUser = {
  id: number
  username: string
  real_name: string | null
  wework_bound: boolean
}

export type LeadAssignmentSettings = {
  assign_mode: 'first_user' | 'round_robin' | 'channel_map'
  channel_owner_map: Record<string, number>
  default_owner_id: number | null
  notify_wework: boolean
  round_robin_last_user_id: number | null
  mode_options: Array<{ value: string; label: string }>
  users: LeadAssignmentUser[]
}

export async function getLeadAssignmentSettings() {
  return getJson<LeadAssignmentSettings>('/settings/lead-assignment')
}

export async function saveLeadAssignmentSettings(body: {
  assign_mode?: LeadAssignmentSettings['assign_mode']
  channel_owner_map?: Record<string, number>
  default_owner_id?: number | null
  notify_wework?: boolean
}) {
  return putJson<LeadAssignmentSettings>('/settings/lead-assignment', body)
}

export type PublicWebhookSettings = {
  douyin_client_key: string
  douyin_client_secret_set: boolean
  douyin_verify_mode: 'legacy_or_platform' | 'platform_only' | 'legacy_only'
  xhs_webhook_token_set: boolean
  xhs_verify_mode: 'legacy_or_platform' | 'platform_only' | 'legacy_only'
  verify_mode_options: Array<{ value: string; label: string }>
  docs: {
    douyin_header: string
    douyin_algo: string
    xhs_header: string
    xhs_algo: string
    legacy_header: string
  }
}

export async function getPublicWebhookSettings() {
  return getJson<PublicWebhookSettings>('/settings/public-webhooks')
}

export async function savePublicWebhookSettings(body: {
  douyin_client_key?: string | null
  douyin_client_secret?: string | null
  douyin_verify_mode?: PublicWebhookSettings['douyin_verify_mode']
  xhs_webhook_token?: string | null
  xhs_verify_mode?: PublicWebhookSettings['xhs_verify_mode']
}) {
  return putJson<PublicWebhookSettings>('/settings/public-webhooks', body)
}

export async function previewPublicWebhookSignatures(sample_body?: string) {
  return postJson<{ sample_body: string; douyin_signature?: string; xhs_signature?: string }>(
    '/settings/public-webhooks/sign-preview',
    sample_body ? { sample_body } : {},
  )
}

export type HealthMonitorStatus = {
  enabled: boolean
  url: string
  consecutive_fails: number
  alerting: boolean
  last_error: string | null
  fail_threshold: number
  last_probe?: { ok: boolean; latency_ms: number; error?: string }
}

export async function getHealthMonitorStatus() {
  return getJson<HealthMonitorStatus>('/settings/health-monitor')
}

export async function runHealthMonitorCheck() {
  return postJson<{ run: { status: string } } & HealthMonitorStatus>('/settings/health-monitor/run', {})
}
