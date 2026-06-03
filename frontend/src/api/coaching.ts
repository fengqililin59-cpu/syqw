/**
 * @file AI 教练建议 API 类型与函数
 */

// 维度枚举
export type CoachType = 'followup' | 'call' | 'deal' | 'develop' | 'time' | 'overall';

export const COACH_TYPE_LABELS: Record<CoachType, string> = {
  followup: '跟进效率',
  call: '通话能力',
  deal: '成交转化',
  develop: '客户开发',
  time: '时间管理',
  overall: '综合建议',
};

export const COACH_TYPE_ICONS: Record<CoachType, string> = {
  followup: '🔁',
  call: '📞',
  deal: '💰',
  develop: '🌱',
  time: '⏰',
  overall: '🎯',
};

// 优先级
export type Priority = 1 | 2 | 3 | 4;
export const PRIORITY_LABELS: Record<Priority, string> = { 1: '紧急', 2: '重要', 3: '普通', 4: '建议' };
export const PRIORITY_COLORS: Record<Priority, string> = { 1: '#ef4444', 2: '#f59e0b', 3: '#3b82f6', 4: '#6b7280' };

// 状态
export type SuggestionStatus = 'active' | 'dismissed' | 'implemented';
export const STATUS_LABELS: Record<SuggestionStatus, string> = {
  active: '待处理',
  dismissed: '已忽略',
  implemented: '已实施',
};

// 员工快照（用于卡片展示）
export interface SnapshotData {
  today: { followups: number; calls: number; call_duration_min: number; orders: number; revenue: number; new_customers: number; inbox_replies: number };
  yesterday: { followups: number; calls: number; orders: number; revenue: number };
  week7: { followups: number; calls: number; orders: number; tasks: number };
  month30: { followups: number; orders: number; revenue: number };
  customers: { total: number; high_intent: number; new_30d: number };
  tasks: { total: number; done: number; done_rate: number };
  kpi: Record<string, number | null>;
}

// 建议条目
export interface CoachSuggestion {
  id: number;
  tenant_id: number;
  user_id: number;
  coach_type: CoachType;
  title: string;
  content: string;
  context_data: SnapshotData | null;
  priority: Priority;
  status: SuggestionStatus;
  impact_score: number | null;
  generated_by: string | null;
  generated_at: string;
  implemented_at: string | null;
  dismissed_at: string | null;
  target_user?: { id: number; real_name: string; username: string; avatar_url?: string };
}

export interface CoachListResponse {
  total: number;
  items: CoachSuggestion[];
}

export interface GenerateResult {
  generated: number;
  user?: { id: number; name: string };
  suggestions?: { id: number; coach_type: CoachType; title: string }[];
}

export interface GenerateAllResult {
  generated: number;
  users: GenerateResult[];
}

export interface PreviewResult {
  user: { id: number; name: string };
  snapshot: SnapshotData;
  previews: { coach_type: CoachType; title: string; content: string; priority: Priority }[];
}

export interface CoachTypeDef {
  value: CoachType;
  label: string;
}

// ============================================================
// API 函数
// ============================================================

import { getJson, postJson, patchJson } from './client';

/** 获取教练建议列表 */
export async function fetchCoachSuggestions(params?: {
  userId?: number; coachType?: CoachType; status?: SuggestionStatus; priority?: Priority; limit?: number; offset?: number;
}): Promise<CoachListResponse> {
  const res = await getJson<CoachListResponse>('/coaching', { params });
  return res;
}

/** 获取单条建议 */
export async function fetchCoachSuggestion(id: number): Promise<CoachSuggestion> {
  const res = await getJson<CoachSuggestion>(`/coaching/${id}`);
  return res;
}

/** 为指定员工生成教练建议 */
export async function generateCoaching(userId: number): Promise<GenerateResult> {
  const res = await postJson<GenerateResult>('/coaching/generate', { userId });
  return res;
}

/** 批量生成所有员工教练建议 */
export async function generateAllCoaching(): Promise<GenerateAllResult> {
  const res = await postJson<GenerateAllResult>('/coaching/generate-all', {});
  return res;
}

/** 预览教练建议（不入库） */
export async function previewCoaching(userId: number): Promise<PreviewResult> {
  const res = await getJson<PreviewResult>('/coaching/preview/check', { params: { userId } });
  return res;
}

/** 忽略建议 */
export async function dismissCoaching(id: number): Promise<void> {
  await patchJson(`/coaching/${id}/dismiss`, {});
}

/** 标记已实施 */
export async function implementCoaching(id: number): Promise<void> {
  await patchJson(`/coaching/${id}/implement`, {});
}

/** 获取教练维度列表 */
export async function fetchCoachTypes(): Promise<CoachTypeDef[]> {
  const res = await getJson<CoachTypeDef[]>('/coaching/types');
  return res;
}
