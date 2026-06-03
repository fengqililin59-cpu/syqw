/**
 * @file 通知规则 API
 */
import { getJson, postJson, putJson, deleteJson } from '@/api/client'

// --- 类型定义 ---

export type TriggerType = 'schedule' | 'event' | 'cron'
export type RecipientType = 'specific' | 'role' | 'owner' | 'all'
export type RulePriority = 'low' | 'normal' | 'high' | 'urgent'

export interface TriggerConfig {
  type?: 'daily' | 'weekly' | 'monthly' | 'interval'
  time?: string
  days_of_week?: number[]
  interval_minutes?: number
  event?: string
  filters?: Record<string, unknown>
  expression?: string
}

export interface RecipientConfig {
  user_ids?: number[]
  role_id?: number
}

export interface RuleTemplate {
  title: string
  body: string
  link?: string
}

export interface NotificationRule {
  id: number
  tenant_id: number
  name: string
  description: string | null
  enabled: boolean
  trigger_type: TriggerType
  trigger_config: TriggerConfig
  channels: string[]
  recipient_type: RecipientType
  recipient_config: RecipientConfig
  template: RuleTemplate
  priority: RulePriority
  cooldown_minutes: number
  max_per_run: number
  last_triggered_at: string | null
  trigger_count: number
  created_by: number
  created_at: string
  updated_at: string
  creator?: { id: number; name: string }
}

export interface RuleListResult {
  items: NotificationRule[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface RuleLog {
  id: number
  rule_id: number
  recipients_count: number
  channels_used: string[]
  status: 'success' | 'partial' | 'failed'
  error_message: string | null
  triggered_at: string
  rule?: { id: number; name: string }
}

export interface EventType {
  value: string
  label: string
  description: string
}

// --- API 函数 ---

/** 规则列表 */
export function fetchRules(params?: {
  page?: number
  page_size?: number
  enabled?: boolean
  trigger_type?: TriggerType
}): Promise<{ success: boolean; data: RuleListResult }> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.page_size) searchParams.set('page_size', String(params.page_size))
  if (params?.enabled !== undefined) searchParams.set('enabled', String(params.enabled))
  if (params?.trigger_type) searchParams.set('trigger_type', params.trigger_type)
  return getJson(`/notification-rules?${searchParams.toString()}`)
}

/** 规则详情 */
export function fetchRule(id: number): Promise<{ success: boolean; data: NotificationRule }> {
  return getJson(`/notification-rules/${id}`)
}

/** 创建规则 */
export function createRule(data: Partial<NotificationRule>): Promise<{ success: boolean; data: NotificationRule }> {
  return postJson('/notification-rules', data)
}

/** 更新规则 */
export function updateRule(id: number, data: Partial<NotificationRule>): Promise<{ success: boolean; data: NotificationRule }> {
  return putJson(`/notification-rules/${id}`, data)
}

/** 删除规则 */
export function deleteRule(id: number): Promise<{ success: boolean }> {
  return deleteJson(`/notification-rules/${id}`)
}

/** 启用/禁用规则 */
export function toggleRule(id: number): Promise<{ success: boolean; data: NotificationRule }> {
  return postJson(`/notification-rules/${id}/toggle`)
}

/** 手动触发规则 */
export function triggerRule(id: number, context?: Record<string, unknown>): Promise<{ success: boolean }> {
  return postJson(`/notification-rules/${id}/trigger`, context || {})
}

/** 事件类型常量 */
export function fetchEventTypes(): Promise<{ success: boolean; data: EventType[] }> {
  return getJson('/notification-rules/event-types')
}

/** 触发日志 */
export function fetchRuleLogs(params?: {
  rule_id?: number
  page?: number
  page_size?: number
}): Promise<{ success: boolean; data: { items: RuleLog[]; total: number } }> {
  const searchParams = new URLSearchParams()
  if (params?.rule_id) searchParams.set('rule_id', String(params.rule_id))
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.page_size) searchParams.set('page_size', String(params.page_size))
  return getJson(`/notification-rules/logs?${searchParams.toString()}`)
}
