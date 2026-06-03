/**
 * @file 销售管道配置 API 层
 */
import { getJson, postJson, putJson } from './client'

// ── 类型 ──

export interface PipelineStage {
  key: string
  label: string
  color: string
  category: 'open' | 'won' | 'lost'
  order: number
}

export interface PipelineConfig {
  id: number | null
  stages: PipelineStage[]
  hasCustom: boolean
}

export interface PipelineTemplate {
  label: string
  stageCount: number
  stages: PipelineStage[]
}

// ── API ──

/** 获取当前租户管道配置 */
export function getConfig() {
  return getJson<PipelineConfig>('/pipeline/config')
}

/** 获取管道阶段列表（看板专用，仅阶段数据） */
export function getStages() {
  return getJson<PipelineStage[]>('/pipeline/stages')
}

/** 保存管道配置 */
export function saveConfig(stages: PipelineStage[]) {
  return putJson<{ id: number; stages: PipelineStage[] }>('/pipeline/config', { stages })
}

/** 重置为默认管道 */
export function resetConfig() {
  return postJson<{ stages: PipelineStage[] }>('/pipeline/reset')
}

/** 获取管道模板列表 */
export function listTemplates() {
  return getJson<Record<string, PipelineTemplate>>('/pipeline/templates')
}

/** 应用管道模板 */
export function applyTemplate(key: string) {
  return postJson<{ id: number; stages: PipelineStage[] }>(`/pipeline/templates/${key}/apply`)
}
