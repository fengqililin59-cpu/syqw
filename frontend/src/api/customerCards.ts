/**
 * @file 客户卡项 API。
 */
import { getJson, postJson } from './client'

export type CardType = 'times' | 'stored' | 'period'
export type CardStatus = 'active' | 'used_up' | 'expired' | 'refunded' | 'frozen'

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  times: '次卡',
  stored: '储值卡',
  period: '期限卡',
}

export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  active: '生效中',
  used_up: '已用完',
  expired: '已过期',
  refunded: '已退卡',
  frozen: '已冻结',
}

export const CARD_STATUS_COLOR: Record<CardStatus, string> = {
  active: '#10b981',
  used_up: '#9ca3af',
  expired: '#f59e0b',
  refunded: '#ef4444',
  frozen: '#6b7280',
}

export type CustomerCard = {
  id: number
  customer_id: number
  product_id: number | null
  card_type: CardType
  card_type_label: string
  name: string
  total_times: number | null
  remaining_times: number | null
  total_amount: number | null
  remaining_amount: number | null
  paid_amount: number
  valid_from: string | null
  valid_until: string | null
  status: CardStatus
  /** 距到期天数，无有效期时为 null */
  days_to_expire: number | null
  customer?: { id: number; name: string | null; phone: string | null } | null
  product?: { id: number; name: string } | null
}

export type CardTransaction = {
  id: number
  card_id: number
  customer_id: number
  appointment_id: number | null
  type: 'consume' | 'recharge' | 'refund' | 'adjust'
  times_delta: number | null
  amount_delta: string | number | null
  times_after: number | null
  amount_after: string | number | null
  reason: string | null
  created_at: string
  operator?: { id: number; real_name?: string | null; username?: string | null } | null
}

export const TRANSACTION_TYPE_LABEL: Record<CardTransaction['type'], string> = {
  consume: '核销',
  recharge: '充值',
  refund: '退款',
  adjust: '手工调整',
}

export function fetchCustomerCards(customerId: number) {
  return getJson<{ list: CustomerCard[] }>(`/customers/${customerId}/cards`)
}

export type CreateCardBody = {
  customer_id: number
  card_type: CardType
  name: string
  total_times?: number | null
  total_amount?: number | null
  paid_amount?: number
  valid_from?: string | null
  valid_until?: string | null
  product_id?: number | null
}

export function createCard(body: CreateCardBody) {
  return postJson<CustomerCard, CreateCardBody>('/customer-cards', body)
}

export function consumeCard(
  id: number,
  body: { times?: number; amount?: number; appointment_id?: number | null; reason?: string },
) {
  return postJson<CustomerCard>(`/customer-cards/${id}/consume`, body)
}

export function rechargeCard(id: number, body: { amount: number; paid_amount?: number; reason?: string }) {
  return postJson<CustomerCard>(`/customer-cards/${id}/recharge`, body)
}

/** 手工调整余额/次数，需要 card:adjust 权限且必须填写原因 */
export function adjustCard(
  id: number,
  body: { times_delta?: number; amount_delta?: number; reason: string },
) {
  return postJson<CustomerCard>(`/customer-cards/${id}/adjust`, body)
}

export function fetchCardTransactions(id: number, page = 1) {
  return getJson<{ list: CardTransaction[]; total: number; page: number; size: number }>(
    `/customer-cards/${id}/transactions?page=${page}`,
  )
}

export type SleepingCustomer = {
  id: number
  name: string | null
  phone: string | null
  last_visit_at: string | null
  visit_count: number
  total_paid_amount: string | number
}

export type CardAlerts = {
  thresholds: { low_times: number; expire_days: number; low_amount: number; sleep_days: number }
  low_times: CustomerCard[]
  expiring: CustomerCard[]
  low_balance: CustomerCard[]
  sleeping: SleepingCustomer[]
}

export function fetchCardAlerts() {
  return getJson<CardAlerts>('/customer-cards/alerts')
}

/** 卡片剩余量的展示文案 */
export function cardRemainingText(card: CustomerCard): string {
  if (card.card_type === 'times') {
    return `剩 ${card.remaining_times ?? 0} / ${card.total_times ?? 0} 次`
  }
  if (card.card_type === 'stored') {
    return `余额 ¥${Number(card.remaining_amount ?? 0).toFixed(2)}`
  }
  return card.valid_until ? `有效期至 ${card.valid_until}` : '不限期'
}
