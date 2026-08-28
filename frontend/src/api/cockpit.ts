/**
 * @file 老板驾驶舱 API。
 */
import { getJson } from './client'

export type CockpitOverview = {
  date: string
  today: {
    new_customers: number
    appointments: number
    arrived: number
    /** 无预约时为 null */
    arrival_rate: number | null
    revenue: number
  }
  month: {
    new_customers: number
    arrived: number
    income: number
    /** 未部署广告成本模块时为 null */
    ad_spend: number | null
    /** 未录入广告消耗时为 null，不做估算 */
    cac: number | null
    roi: number | null
    repurchase_rate: number | null
  }
}

export type TrendPoint = {
  date: string
  new_customers: number
  arrived: number
  revenue: number
}

export type CockpitTrends = {
  days: number
  series: TrendPoint[]
}

export type CockpitSuggestion = {
  key: string
  priority: 'high' | 'medium' | 'low'
  title: string
  detail: string
  action_label: string
  action_to: string
}

export type CockpitSuggestions = {
  generated_at: string
  suggestions: CockpitSuggestion[]
}

export function fetchCockpitOverview() {
  return getJson<CockpitOverview>('/cockpit/overview')
}

export function fetchCockpitTrends(days = 30) {
  return getJson<CockpitTrends>(`/cockpit/trends?days=${days}`)
}

export function fetchCockpitSuggestions() {
  return getJson<CockpitSuggestions>('/cockpit/suggestions')
}
