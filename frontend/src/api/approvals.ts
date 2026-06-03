/**
 * @file 审批系统 API。
 */
import { getJson, postJson, putJson, deleteJson } from '@/api/client'

// --- 类型定义 ---

export interface ApprovalStep {
  order: number
  approver_id: number | null
  approver_role: string | null
  step_name: string
  status: 'pending' | 'waiting' | 'approved' | 'rejected'
  comment: string | null
  action_user_id: number | null
  action_at: string | null
}

export interface ApprovalTemplate {
  id: number
  tenant_id: number
  name: string
  description: string | null
  steps: { order: number; approver_id?: number; approver_role?: string; step_name: string }[]
  is_active: number
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface ApprovalInstance {
  id: number
  tenant_id: number
  template_id: number
  title: string
  applicant_user_id: number
  related_type: string | null
  related_id: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  current_step: number
  steps_snapshot: ApprovalStep[]
  submitted_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// --- API 函数 ---

// 模板
export function fetchTemplates(params?: { page?: number; limit?: number; is_active?: string }) {
  return getJson<PageResult<ApprovalTemplate>>('/approvals/templates', { params })
}

export function fetchTemplate(id: number) {
  return getJson<ApprovalTemplate>(`/approvals/templates/${id}`)
}

export function createTemplate(body: {
  name: string
  description?: string
  steps: { order: number; approver_id?: number; approver_role?: string; step_name: string }[]
  is_active?: boolean
}) {
  return postJson<ApprovalTemplate>('/approvals/templates', body)
}

export function updateTemplate(
  id: number,
  body: {
    name?: string
    description?: string
    steps?: { order: number; approver_id?: number; approver_role?: string; step_name: string }[]
    is_active?: boolean
  },
) {
  return putJson<ApprovalTemplate>(`/approvals/templates/${id}`, body)
}

export function deleteTemplate(id: number) {
  return deleteJson<{ deleted: boolean }>(`/approvals/templates/${id}`)
}

// 审批操作
export function submitApproval(body: {
  template_id: number
  title: string
  related_type?: string
  related_id?: string
}) {
  return postJson<ApprovalInstance>('/approvals', body)
}

export function approveInstance(id: number, comment?: string) {
  return postJson<ApprovalInstance>(`/approvals/${id}/approve`, { comment })
}

export function rejectInstance(id: number, comment?: string) {
  return postJson<ApprovalInstance>(`/approvals/${id}/reject`, { comment })
}

export function cancelInstance(id: number) {
  return postJson<ApprovalInstance>(`/approvals/${id}/cancel`)
}

// 查询
export function fetchInstance(id: number) {
  return getJson<ApprovalInstance>(`/approvals/${id}`)
}

export function fetchMyApplications(params?: { page?: number; limit?: number; status?: string }) {
  return getJson<PageResult<ApprovalInstance>>('/approvals', { params })
}

export function fetchPendingApprovals(params?: { page?: number; limit?: number }) {
  return getJson<PageResult<ApprovalInstance>>('/approvals/pending/list', { params })
}

export function fetchProcessedApprovals(params?: { page?: number; limit?: number }) {
  return getJson<PageResult<ApprovalInstance>>('/approvals/processed/list', { params })
}
