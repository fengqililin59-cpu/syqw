/**
 * @file 报表分析 API。
 */
import { getJson } from '@/api/client'

// --- 类型定义 ---

export interface FunnelStage {
  stage: string
  label: string
  count: number
  avgIntent: number
  prevCount: number
  conversionRate: number
  yoyChange: number | null
  avgDwellDays: number
  maxDwellDays: number
}

export interface FunnelSummary {
  totalCustomers: number
  dealCount: number
  dealAmount: number
  overallConversion: number
  yoyDealChange: number | null
  yoyAmountChange: number | null
}

export interface FunnelReport {
  period: string
  funnel: FunnelStage[]
  summary: FunnelSummary
}

export interface TeamMember {
  userId: number
  name: string
  avatarUrl: string | null
  total: number
  newCount: number
  dealCount: number
  avgIntent: number
  followupCount: number
  orderCount: number
  revenue: number
  conversionRate: number
}

export interface TeamSummary {
  totalMembers: number
  totalCustomers: number
  totalNew: number
  totalDeals: number
  totalFollowups: number
  totalRevenue: number
  avgConversion: number
}

export interface TeamPerformance {
  period: string
  members: TeamMember[]
  summary: TeamSummary
}

export interface SourceDistItem {
  label: string
  value: number
}

export interface IntentDistItem {
  level: string
  label: string
  count: number
  avgScore: number
}

export interface TrendItem {
  month: string
  count: number
  deals: number
}

export interface EngagementStats {
  totalCustomers: number
  activeCustomers: number
  activeRate: number
  noFollowup7Days: number
  totalFollowups: number
  avgFollowupsPerCustomer: number
}

export interface CustomerAnalysis {
  period: string
  sourceDistribution: SourceDistItem[]
  intentDistribution: IntentDistItem[]
  newCustomerTrend: TrendItem[]
  topTags: SourceDistItem[]
  engagement: EngagementStats
}

export interface ReportSummary {
  period: string
  totalCustomers: number
  newCustomers: number
  dealCount: number
  revenue: number
  followupCount: number
  conversionRate: number
}

// --- API 函数 ---

export async function fetchFunnelReport(params?: Record<string, string>) {
  return getJson<FunnelReport>(`/analytics/funnel${buildQuery(params)}`)
}

export async function fetchTeamPerformance(params?: Record<string, string>) {
  return getJson<TeamPerformance>(`/analytics/team${buildQuery(params)}`)
}

export async function fetchCustomerAnalysis(params?: Record<string, string>) {
  return getJson<CustomerAnalysis>(`/analytics/customers${buildQuery(params)}`)
}

export async function fetchReportSummary(params?: Record<string, string>) {
  return getJson<ReportSummary>(`/analytics/summary${buildQuery(params)}`)
}

function buildQuery(params?: Record<string, string>) {
  if (!params) return ''
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v)
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}
