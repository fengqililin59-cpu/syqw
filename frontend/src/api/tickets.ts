/**
 * @file 服务工单与客户订单 API。
 */
import { getJson, postJson, putJson } from '@/api/client'
import type { CustomerOrderRow, Paginated, ServiceTicketRow } from '@/api/types'

export function fetchTickets(params?: {
  page?: number
  size?: number
  status?: string
  type?: string
  customer_id?: number
  mine?: string
  sla?: string
}) {
  return getJson<Paginated<ServiceTicketRow>>('/service/tickets', { params })
}

export function fetchOverdueTickets(params?: { limit?: number }) {
  return getJson<ServiceTicketRow[]>('/service/tickets/overdue', { params })
}

export function fetchTicket(id: number) {
  return getJson<ServiceTicketRow>(`/service/tickets/${id}`)
}

export function createTicket(body: {
  customer_id: number
  title: string
  description?: string
  type?: string
  priority?: string
  thread_id?: number
  order_id?: number
  owner_id?: number
}) {
  return postJson<ServiceTicketRow>('/service/tickets', body)
}

export function createTicketFromInbox(
  threadId: number,
  body: {
    title: string
    description?: string
    type?: string
    priority?: string
    order_id?: number
  },
) {
  return postJson<ServiceTicketRow>(`/inbox/threads/${threadId}/tickets`, body)
}

export function updateTicket(
  id: number,
  body: Partial<{
    status: string
    priority: string
    type: string
    title: string
    description: string
    resolution: string
    owner_id: number
  }>,
) {
  return putJson<ServiceTicketRow>(`/service/tickets/${id}`, body)
}

export function resolveTicket(id: number, resolution?: string) {
  return postJson<ServiceTicketRow>(`/service/tickets/${id}/resolve`, { resolution })
}

export function fetchOrders(params?: { page?: number; size?: number; status?: string; customer_id?: number }) {
  return getJson<Paginated<CustomerOrderRow>>('/service/orders', { params })
}

export function createOrder(body: {
  customer_id: number
  amount: number
  order_no?: string
  status?: string
  remark?: string
}) {
  return postJson<CustomerOrderRow>('/service/orders', body)
}

export function fetchOrder(id: number) {
  return getJson<CustomerOrderRow>(`/service/orders/${id}`)
}

export function updateOrder(
  id: number,
  body: Partial<{
    order_no: string | null
    amount: number
    currency: string
    status: string
    paid_at: string | null
    remark: string | null
  }>,
) {
  return putJson<CustomerOrderRow>(`/service/orders/${id}`, body)
}
