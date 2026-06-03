/**
 * @file 合同管理 API
 */
import { getJson, postJson, putJson, deleteJson } from './client';

export interface Contract {
  id: number;
  tenant_id: number;
  customer_id: number;
  owner_id: number;
  title: string;
  contract_no: string;
  type: 'sales' | 'service' | 'ndas' | 'other';
  status: 'draft' | 'pending' | 'signed' | 'active' | 'expired' | 'terminated';
  amount: number;
  currency: string;
  start_date: string;
  end_date: string;
  signed_at?: string;
  party_a: string;
  party_b: string;
  content?: string;
  attachment_url?: string;
  reminder_days: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  customer?: {
    id: number;
    name: string;
    phone: string;
  };
  owner?: {
    id: number;
    real_name: string;
    username: string;
  };
}

export interface ContractListParams {
  page?: number;
  page_size?: number;
  status?: string;
  type?: string;
  keyword?: string;
  customer_id?: number;
  owner_id?: number;
  start_date_from?: string;
  start_date_to?: string;
}

export interface ContractListResponse {
  code: number;
  data: {
    items: Contract[];
    total: number;
    page: number;
    page_size: number;
  };
}

/**
 * 获取合同列表
 */
export async function fetchContracts(params: ContractListParams = {}): Promise<ContractListResponse['data']> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));
  if (params.status) query.set('status', params.status);
  if (params.type) query.set('type', params.type);
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.customer_id) query.set('customer_id', String(params.customer_id));
  if (params.owner_id) query.set('owner_id', String(params.owner_id));
  if (params.start_date_from) query.set('start_date_from', params.start_date_from);
  if (params.start_date_to) query.set('start_date_to', params.start_date_to);

  const res = await getJson<ContractListResponse>(`/contracts?${query.toString()}`);
  return res.data!;
}

/**
 * 获取单个合同详情
 */
export async function fetchContract(id: number): Promise<Contract> {
  const res = await getJson<{ code: number; data: Contract }>(`/contracts/${id}`);
  return res.data!;
}

/**
 * 创建合同
 */
export async function createContract(data: Partial<Contract>): Promise<Contract> {
  const res = await postJson<{ code: number; data: Contract }>('/contracts', data);
  return res.data!;
}

/**
 * 更新合同
 */
export async function updateContract(id: number, data: Partial<Contract>): Promise<Contract> {
  const res = await putJson<{ code: number; data: Contract }>(`/contracts/${id}`, data);
  return res.data!;
}

/**
 * 删除合同
 */
export async function deleteContract(id: number): Promise<void> {
  await deleteJson(`/contracts/${id}`);
}
