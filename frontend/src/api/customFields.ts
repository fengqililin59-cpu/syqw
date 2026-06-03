/**
 * @file 自定义字段 API 层
 */
import { deleteJson, getJson, postJson, putJson } from './client'

// ── 类型 ──
export interface CustomFieldDef {
  id: number
  field_key: string
  field_label: string
  field_type: 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'checkbox' | 'textarea'
  options?: { label: string; value: string }[] | null
  group_name?: string | null
  is_required: boolean
  display_order: number
  is_active: boolean
  placeholder?: string | null
  help_text?: string | null
  created_at: string
  updated_at: string
}

export interface CustomerFieldValue extends CustomFieldDef {
  value: string | null
}

export interface IndustryTemplate {
  label: string
  fieldCount: number
  fields: Omit<CustomFieldDef, 'id' | 'is_active' | 'created_at' | 'updated_at'>[]
}

// ── API ──

/** 获取租户所有字段定义 */
export function listDefs(activeOnly?: boolean) {
  return getJson<CustomFieldDef[]>('/custom-fields/defs', {
    params: activeOnly ? { activeOnly: 'true' } : undefined,
  })
}

/** 创建字段 */
export function createDef(data: Partial<CustomFieldDef>) {
  return postJson<CustomFieldDef>('/custom-fields/defs', data)
}

/** 更新字段 */
export function updateDef(id: number, data: Partial<CustomFieldDef>) {
  return putJson<CustomFieldDef>(`/custom-fields/defs/${id}`, data)
}

/** 删除字段 */
export function deleteDef(id: number) {
  return deleteJson<void>(`/custom-fields/defs/${id}`)
}

/** 获取行业模板列表 */
export function listTemplates() {
  return getJson<Record<string, IndustryTemplate>>('/custom-fields/templates')
}

/** 应用行业模板 */
export function applyTemplate(key: string) {
  return postJson<{ added: number; total: number }>(`/custom-fields/templates/${key}/apply`)
}

/** 获取某个客户的自定义字段值 */
export function getCustomerFieldValues(customerId: number) {
  return getJson<CustomerFieldValue[]>(`/customers/${customerId}/custom-fields`)
}

/** 批量保存客户自定义字段值 */
export function saveCustomerFieldValues(customerId: number, fieldValues: Record<string, string>) {
  return putJson<unknown>(`/customers/${customerId}/custom-fields`, { fieldValues })
}
