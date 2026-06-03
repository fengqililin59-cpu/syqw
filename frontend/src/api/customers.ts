/**
 * @file 客户列表与检索 API。
 */
import { getJson, postJson } from '@/api/client'
import type { IntentAlertPlaybook } from '@/api/settings'
import type { CustomerRow, Paginated } from '@/api/types'

export type CustomerIntentPlaybook = IntentAlertPlaybook & {
  source?: string
  show_assistant?: boolean
  reason?: string
}

export type ExportCustomersResult = {
  filename: string
  file_base64: string
  row_count?: number
  format?: string
}

export type ImportTemplateResult = {
  filename: string
  file_base64: string
  headers: string[]
  custom_field_count: number
}

export type BatchOperateParams = {
  ids: number[]
  action: 'tag_add' | 'tag_remove' | 'assign_owner' | 'change_stage' | 'delete'
  tag_ids?: number[]
  target_owner_id?: number
  target_stage?: string
}

export type BatchOperateResult = {
  action: string
  affected: number
  total: number
}

export function formatCustomerLabel(c: Pick<CustomerRow, 'id' | 'name' | 'nickname' | 'phone' | 'company'>) {
  const title = c.name || c.nickname || c.phone || `客户#${c.id}`
  const parts = [c.phone, c.company].filter((x) => x && String(x).trim())
  return parts.length ? `${title} · ${parts.join(' / ')}` : title
}

export async function searchCustomers(params: {
  keyword?: string
  page?: number
  size?: number
}) {
  return getJson<Paginated<CustomerRow>>('/customers', {
    params: {
      page: params.page ?? 1,
      size: params.size ?? 15,
      ...(params.keyword?.trim() ? { keyword: params.keyword.trim() } : {}),
    },
  })
}

export async function fetchCustomer(id: number) {
  return getJson<CustomerRow>(`/customers/${id}`)
}

export async function fetchCustomerIntentPlaybook(customerId: number) {
  return getJson<CustomerIntentPlaybook>(`/customers/${customerId}/intent-playbook`)
}

/**
 * 导出客户（支持字段筛选和格式选择）。
 */
export async function exportCustomers(params: {
  keyword?: string
  stage?: string
  tag_id?: string
  owner_id?: string
  fields?: string
  format?: string
}) {
  const q = new URLSearchParams()
  if (params.keyword) q.set('keyword', params.keyword)
  if (params.stage) q.set('stage', params.stage)
  if (params.tag_id) q.set('tag_id', params.tag_id)
  if (params.owner_id) q.set('owner_id', params.owner_id)
  if (params.fields) q.set('fields', params.fields)
  if (params.format) q.set('format', params.format)
  const qs = q.toString()
  return getJson<ExportCustomersResult>(`/customers/export${qs ? `?${qs}` : ''}`)
}

/**
 * 下载导入模板（含自定义字段列）。
 */
export async function downloadImportTemplate() {
  return getJson<ImportTemplateResult>('/customers/import/template')
}

/**
 * 批量操作客户。
 */
export async function batchOperateCustomers(params: BatchOperateParams) {
  return postJson<BatchOperateResult>('/customers/batch', params)
}
