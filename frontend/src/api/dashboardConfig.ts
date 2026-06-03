/**
 * @file 仪表盘 Widget 配置 API 层
 */
import { getJson, postJson, putJson } from './client'

// ── 类型 ──

export interface WidgetItem {
  key: string
  label: string
  visible: boolean
  order: number
}

export interface DashboardConfig {
  widgets: WidgetItem[]
  hasCustom: boolean
}

export interface WidgetTemplate {
  label: string
  desc: string
  widgetCount: number
  widgets: WidgetItem[]
}

// ── API ──

/** 获取当前租户 Widget 配置 */
export function getConfig() {
  return getJson<DashboardConfig>('/dashboard/widget-config')
}

/** 保存 Widget 配置 */
export function saveConfig(widgets: WidgetItem[]) {
  return putJson<{ widgets: WidgetItem[] }>('/dashboard/widget-config', { widgets })
}

/** 获取行业模板列表 */
export function listTemplates() {
  return getJson<Record<string, WidgetTemplate>>('/dashboard/widget-config/templates')
}

/** 应用行业模板 */
export function applyTemplate(key: string) {
  return postJson<{ widgets: WidgetItem[] }>(`/dashboard/widget-config/templates/${key}/apply`)
}
