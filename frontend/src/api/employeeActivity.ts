/**
 * @file 员工活动监控 API + KPI目标管理
 */
import { getJson, postJson, deleteJson } from './client';

export interface EmployeeTodayStats {
  followups: number;
  calls: number;
  call_duration_sec: number;
  orders: number;
  revenue: number;
  new_customers: number;
  inbox_replies: number;
}

export interface EmployeeMember {
  id: number;
  username: string;
  real_name: string;
  avatar_url: string | null;
  wework_userid: string | null;
  last_login_at: string | null;
  is_online: boolean;
  today: EmployeeTodayStats;
  yesterday: EmployeeTodayStats;
  kpi?: {
    followups: number | null;
    calls: number | null;
    revenue: number | null;
    orders: number | null;
    new_customers: number | null;
  };
}

export interface KpiTargetRecord {
  id?: number;
  tenant_id: number;
  user_id: number | null;
  dimension: string;
  target_value: number;
  period: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  target_type: string | null;
  target_id: string | null;
  actor: { id: number; real_name: string } | null;
  created_at: string;
}

export interface DailyTrendPoint {
  date: string;
  total: number;
  'followup:create': number;
  'call:initiate': number;
  'order:create': number;
  'inbox:reply': number;
  'customer:create': number;
}

export interface HourlyPoint {
  hour: number;
  count: number;
}

export interface RankingEntry {
  rank: number;
  user_id: number;
  real_name: string;
  value: number;
  display: string;
}

export interface RankingDimension {
  key: string;
  label: string;
  items: RankingEntry[];
}

export interface EmployeeActivityData {
  summary: {
    total_users: number;
    online_users: number;
    active_today: number;
    active_past_7days: number;
    total_followups_today: number;
    total_calls_today: number;
    total_orders_today: number;
    total_revenue_today: number;
    total_new_customers_today: number;
    total_inbox_replies_today: number;
  };
  summary_prev: {
    total_followups: number;
    total_calls: number;
    total_orders: number;
    total_revenue: number;
    total_new_customers: number;
    total_inbox_replies: number;
  };
  week_summary: {
    total_followups: number;
    total_calls: number;
    total_orders: number;
    total_revenue: number;
    total_new_customers: number;
    total_inbox_replies: number;
  };
  week_prev: {
    total_followups: number;
    total_calls: number;
    total_orders: number;
    total_revenue: number;
    total_new_customers: number;
    total_inbox_replies: number;
  };
  members: EmployeeMember[];
  recent_logs: ActivityLog[];
  daily_trend: DailyTrendPoint[];
  hourly_distribution: HourlyPoint[];
  rankings: RankingDimension[];
  kpi_targets?: KpiTargetRecord[];
  member_daily_activity?: Record<string, { date: string; count: number }[]>;
}

export async function fetchEmployeeActivity(): Promise<EmployeeActivityData> {
  return getJson<EmployeeActivityData>('/employees/activity');
}

export async function fetchKpiTargets(): Promise<KpiTargetRecord[]> {
  const res = await getJson<{ code: number; data: KpiTargetRecord[] }>('/employees/kpi-targets');
  return res.data || [];
}

export async function upsertKpiTarget(payload: Partial<KpiTargetRecord>): Promise<KpiTargetRecord> {
  const res = await postJson<{ code: number; data: KpiTargetRecord }>('/employees/kpi-targets', payload);
  return res.data!;
}

export async function deleteKpiTarget(id: number): Promise<void> {
  await deleteJson(`/employees/kpi-targets/${id}`);
}

export interface CoachingInsightData {
  insight: string;
  model: string;
  provider: string;
}

export async function fetchCoachingInsight(payload: {
  name: string;
  today: EmployeeTodayStats;
  yesterday?: EmployeeTodayStats;
  kpi?: EmployeeMember['kpi'];
  trend30?: { date: string; count: number }[];
  rankings?: { dimension: string; rank: number }[];
}): Promise<CoachingInsightData> {
  const res = await postJson<{ code: number; data: CoachingInsightData }>(
    '/employees/coaching-insight',
    payload,
  );
  return res.data!;
}
