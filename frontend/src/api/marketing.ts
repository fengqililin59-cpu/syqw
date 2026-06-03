import { getJson, postJson, putJson, deleteJson } from './client';
import type { Paginated } from './types';

// ==================== 类型定义 ====================

export interface MarketingCampaignRecord {
  id: number;
  tenant_id: number;
  name: string;
  type: 'email' | 'sms' | 'wechat';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  subject: string | null;
  content: string | null;
  template_id: number | null;
  target_filter: Record<string, any> | null;
  target_count: number;
  sent_count: number;
  open_count: number;
  click_count: number;
  reply_count: number;
  bounce_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  creator?: { id: number; username?: string; real_name?: string | null };
}

export interface MessageTemplateRecord {
  id: number;
  tenant_id: number;
  name: string;
  type: 'email' | 'sms' | 'wechat';
  subject: string | null;
  content: string;
  variables: string[] | null;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignStats {
  campaign: MarketingCampaignRecord;
  message_stats: { status: string; count: number }[];
}

// ==================== 营销活动 API ====================

export async function fetchCampaigns(params: {
  page?: number;
  page_size?: number;
  type?: string;
  status?: string;
  keyword?: string;
} = {}): Promise<Paginated<MarketingCampaignRecord>> {
  return getJson<Paginated<MarketingCampaignRecord>>('/marketing/campaigns', { params });
}

export async function fetchCampaign(id: number): Promise<MarketingCampaignRecord> {
  return getJson<MarketingCampaignRecord>(`/marketing/campaigns/${id}`);
}

export async function createCampaign(payload: Partial<MarketingCampaignRecord>): Promise<MarketingCampaignRecord> {
  return postJson<MarketingCampaignRecord>('/marketing/campaigns', payload);
}

export async function updateCampaign(id: number, payload: Partial<MarketingCampaignRecord>): Promise<MarketingCampaignRecord> {
  return putJson<MarketingCampaignRecord>(`/marketing/campaigns/${id}`, payload);
}

export async function deleteCampaign(id: number): Promise<void> {
  await deleteJson(`/marketing/campaigns/${id}`);
}

export async function sendCampaign(id: number): Promise<{ sent_count: number }> {
  return postJson<{ sent_count: number }>(`/marketing/campaigns/${id}/send`);
}

export async function fetchCampaignStats(id: number): Promise<CampaignStats> {
  return getJson<CampaignStats>(`/marketing/campaigns/${id}/stats`);
}

// ==================== 消息模板 API ====================

export async function fetchTemplates(params: {
  page?: number;
  page_size?: number;
  type?: string;
  keyword?: string;
  is_active?: string;
} = {}): Promise<Paginated<MessageTemplateRecord>> {
  return getJson<Paginated<MessageTemplateRecord>>('/marketing/templates', { params });
}

export async function fetchTemplate(id: number): Promise<MessageTemplateRecord> {
  return getJson<MessageTemplateRecord>(`/marketing/templates/${id}`);
}

export async function createTemplate(payload: Partial<MessageTemplateRecord>): Promise<MessageTemplateRecord> {
  return postJson<MessageTemplateRecord>('/marketing/templates', payload);
}

export async function updateTemplate(id: number, payload: Partial<MessageTemplateRecord>): Promise<MessageTemplateRecord> {
  return putJson<MessageTemplateRecord>(`/marketing/templates/${id}`, payload);
}

export async function deleteTemplate(id: number): Promise<void> {
  await deleteJson(`/marketing/templates/${id}`);
}

export async function toggleTemplateActive(id: number): Promise<MessageTemplateRecord> {
  return postJson<MessageTemplateRecord>(`/marketing/templates/${id}/toggle`);
}

// ==================== 营销看板 API ====================

export interface MarketingDashboardData {
  summary: {
    total_sent: number;
    total_opened: number;
    total_clicked: number;
    total_bounced: number;
    total_unsubscribed: number;
    open_rate: string;
    click_rate: string;
    bounce_rate: string;
  };
  trend: {
    date: string;
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
    open_rate: string;
    click_rate: string;
  }[];
  campaigns: {
    id: number;
    name: string;
    type: 'email' | 'sms' | 'wechat';
    sent_count: number;
    open_count: number;
    click_count: number;
    bounce_count: number;
    open_rate: string;
    click_rate: string;
    sent_at: string;
  }[];
  channels: {
    type: string;
    sent: string;
    opened: string;
    clicked: string;
    open_rate: string;
    click_rate: string;
  }[];
}

export async function fetchMarketingDashboard(params: {
  days?: number;
} = {}): Promise<MarketingDashboardData> {
  return getJson<MarketingDashboardData>('/marketing/dashboard', { params });
}
