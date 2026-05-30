/**
 * @file 客户列表与检索 API。
 */
import { getJson } from '@/api/client'
import type { CustomerRow, Paginated } from '@/api/types'

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
