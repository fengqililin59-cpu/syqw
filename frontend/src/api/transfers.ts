import { getJson, postJson } from '@/api/client'
import type { Paginated } from '@/api/types'

export type TransferUserBrief = {
  id: number
  username: string
  real_name?: string | null
} | null

export type TransferDetailItem = {
  customer_id: number | null
  external_userid: string | null
  status: string
  errmsg: string | null
}

export type TransferRow = {
  id: number
  tenant_id: number
  from_user_id: number
  to_user_id: number
  initiated_by: number
  reason: string
  status: string
  total_count: number
  success_count: number
  failed_count: number
  detail_json: TransferDetailItem[] | null
  started_at?: string | null
  finished_at?: string | null
  created_at?: string
  updated_at?: string
  from_user: TransferUserBrief
  to_user: TransferUserBrief
  initiator: TransferUserBrief
}

export async function listTransfers(params: { page?: number; size?: number }) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.size) q.set('size', String(params.size))
  return getJson<Paginated<TransferRow>>(`/transfers?${q.toString()}`)
}

export async function getTransfer(id: number) {
  return getJson<TransferRow>(`/transfers/${id}`)
}

export async function createTransfer(body: {
  from_user_id: number
  to_user_id: number
  reason?: 'resigned' | 'reassign'
}) {
  return postJson<TransferRow>('/transfers', body)
}

export async function getUserCustomerCount(userId: number) {
  return getJson<{ user_id: number; customer_count: number }>(`/users/${userId}/customer-count`)
}
