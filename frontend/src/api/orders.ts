/**
 * @file 客户成交订单 API — 前端请求层。
 */
import { deleteJson, getJson, postJson, putJson } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'paid' | 'completed' | 'refunded' | 'cancelled';

export interface OrderItem {
  id: number;
  tenant_id: number;
  customer_id: number;
  order_no: string | null;
  amount: number;
  currency: string;
  status: OrderStatus;
  paid_at: string | null;
  remark: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  customer?: {
    id: number;
    name: string | null;
    nickname: string | null;
    phone: string | null;
    stage?: string;
  };
  creator?: {
    id: number;
    name: string | null;
    avatar_url?: string | null;
  };
}

export interface OrderListResult {
  list: OrderItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: OrderStatus | '';
  customer_id?: number;
  start_date?: string;
  end_date?: string;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

export interface OrderForm {
  customer_id: number | '';
  order_no?: string;
  amount: number | '';
  currency?: string;
  status?: OrderStatus;
  paid_at?: string | null;
  remark?: string;
}

// ── API Functions ─────────────────────────────────────────────────────────────

function buildQs(query: OrderQuery): string {
  const p = new URLSearchParams();
  if (query.page) p.set('page', String(query.page));
  if (query.limit) p.set('limit', String(query.limit));
  if (query.keyword) p.set('keyword', query.keyword);
  if (query.status) p.set('status', query.status);
  if (query.customer_id) p.set('customer_id', String(query.customer_id));
  if (query.start_date) p.set('start_date', query.start_date);
  if (query.end_date) p.set('end_date', query.end_date);
  if (query.sort_by) p.set('sort_by', query.sort_by);
  if (query.sort_order) p.set('sort_order', query.sort_order);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** 订单列表 */
export async function fetchOrders(query: OrderQuery = {}): Promise<OrderListResult> {
  return getJson<OrderListResult>(`/orders${buildQs(query)}`);
}

/** 订单详情 */
export async function fetchOrder(id: number): Promise<OrderItem> {
  return getJson<OrderItem>(`/orders/${id}`);
}

/** 创建订单 */
export async function createOrder(data: OrderForm): Promise<OrderItem> {
  return postJson<OrderItem>('/orders', data);
}

/** 更新订单 */
export async function updateOrder(id: number, data: Partial<OrderForm>): Promise<OrderItem> {
  return putJson<OrderItem>(`/orders/${id}`, data);
}

/** 删除订单 */
export async function deleteOrder(id: number): Promise<void> {
  return deleteJson(`/orders/${id}`);
}

/** 某客户的订单列表（客户详情页调用） */
export async function fetchOrdersByCustomer(customerId: number): Promise<{ list: OrderItem[] }> {
  return getJson<{ list: OrderItem[] }>(`/orders/by-customer/${customerId}`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; color: string }> = {
  pending:   { label: '待支付', color: 'bg-yellow-100 text-yellow-700' },
  paid:      { label: '已支付', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  refunded:  { label: '已退款', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700' },
};

export function formatAmount(amount: number, currency = 'CNY'): string {
  if (amount === 0) return '¥0';
  const prefix = currency === 'CNY' ? '¥' : currency + ' ';
  return prefix + Number(amount).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
