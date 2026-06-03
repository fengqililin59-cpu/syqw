import { getJson, postJson, putJson, deleteJson } from './client';

export interface LandingPageRecord {
  id: number;
  tenant_id: number;
  title: string;
  slug: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  template: string;
  content: { sections: LandingSection[] };
  custom_css?: string;
  meta_title?: string;
  og_image?: string;
  bg_color: string;
  primary_color: string;
  logo_url?: string;
  favicon_url?: string;
  enable_form: boolean;
  form_title?: string;
  form_fields: FormField[];
  submit_btn_text: string;
  success_msg: string;
  redirect_url?: string;
  qrcode_url?: string;
  qrcode_text?: string;
  view_count: number;
  submit_count: number;
  published_at?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  creator?: { id: number; username: string; real_name?: string };
}

export interface LandingSection {
  id: string;
  type: 'hero' | 'features' | 'form' | 'cta' | 'testimonials' | 'faq' | 'footer' | 'image' | 'text' | 'html';
  title?: string;
  subtitle?: string;
  content?: string;
  imageUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  items?: { title: string; description: string; icon?: string }[];
}

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'tel' | 'email' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface LandingSubmissionRecord {
  id: number;
  landing_id: number;
  customer_id?: number;
  data: Record<string, string>;
  ip?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  created_at: string;
  landing?: { id: number; title: string };
  Customer?: { id: number; name: string; phone?: string; email?: string };
}

export async function fetchLandingPages(params: {
  page?: number; pageSize?: number; status?: string; keyword?: string;
} = {}) {
  return getJson<{ list: LandingPageRecord[]; total: number }>(
    `/landing-pages?page=${params.page || 1}&pageSize=${params.pageSize || 20}${params.status ? `&status=${params.status}` : ''}${params.keyword ? `&keyword=${encodeURIComponent(params.keyword)}` : ''}`
  );
}

export async function fetchLandingPage(id: number) {
  return getJson<LandingPageRecord>(`/landing-pages/${id}`);
}

export async function createLandingPage(data: Partial<LandingPageRecord>) {
  return postJson<LandingPageRecord>('/landing-pages', data);
}

export async function updateLandingPage(id: number, data: Partial<LandingPageRecord>) {
  return putJson<LandingPageRecord>(`/landing-pages/${id}`, data);
}

export async function publishLandingPage(id: number) {
  return postJson<LandingPageRecord>(`/landing-pages/${id}/publish`, {});
}

export async function unpublishLandingPage(id: number) {
  return postJson<LandingPageRecord>(`/landing-pages/${id}/unpublish`, {});
}

export async function deleteLandingPage(id: number) {
  return deleteJson(`/landing-pages/${id}`);
}

export async function fetchLandingPageStats(id: number) {
  return getJson<LandingPageRecord & { recent_submissions: LandingSubmissionRecord[] }>(`/landing-pages/${id}/stats`);
}

export async function fetchLandingSubmissions(id: number, params: { page?: number; pageSize?: number } = {}) {
  return getJson<{ list: LandingSubmissionRecord[]; total: number }>(
    `/landing-pages/${id}/submissions?page=${params.page || 1}&pageSize=${params.pageSize || 20}`
  );
}

export async function fetchPublicLandingPage(slug: string): Promise<LandingPageRecord> {
  const BASE_URL = import.meta.env.VITE_API_BASE || '';
  const res = await fetch(`${BASE_URL}/api/v1/landing-pages/public/${slug}`);
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message || '页面不存在');
  return data.data;
}

export async function recordLandingView(slug: string) {
  const BASE_URL = import.meta.env.VITE_API_BASE || '';
  await fetch(`${BASE_URL}/api/v1/landing-pages/public/${slug}/view`, { method: 'POST' });
}

export async function submitLandingForm(slug: string, formData: Record<string, string>, utm?: Record<string, string>) {
  const BASE_URL = import.meta.env.VITE_API_BASE || '';
  const qs = utm ? `?${new URLSearchParams(utm).toString()}` : '';
  const res = await fetch(`${BASE_URL}/api/v1/landing-pages/public/${slug}/submit${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message || '提交失败');
  return data;
}
