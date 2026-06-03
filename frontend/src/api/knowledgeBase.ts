import { getJson, postJson, putJson, deleteJson } from './client';
import type { Paginated } from './types';

// ==================== 分类类型 ====================
export interface KbCategoryRecord {
  id: number;
  tenant_id: number;
  name: string;
  slug: string | null;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_published: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  article_count?: number;
}

// ==================== 文章类型 ====================
export interface KbArticleRecord {
  id: number;
  tenant_id: number;
  category_id: number | null;
  title: string;
  slug: string | null;
  content: string;
  content_type: 'html' | 'markdown' | 'text';
  summary: string | null;
  tags: string | null;
  status: 'draft' | 'pending_review' | 'published' | 'archived';
  is_featured: boolean;
  view_count: number;
  helpful_yes: number;
  helpful_no: number;
  author_id: number | null;
  reviewer_id: number | null;
  reviewed_at: string | null;
  published_at: string | null;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
  // 关联字段
  category_name?: string;
  author_name?: string;
  reviewer_name?: string;
}

export interface KbArticleDetail extends KbArticleRecord {
  category?: KbCategoryRecord | null;
  author?: { id: number; full_name: string; avatar_url: string | null } | null;
}

// ==================== 列表查询参数 ====================
export interface KbArticleListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  category_id?: number;
  status?: string;
  is_featured?: boolean;
  ai_generated?: boolean;
  sort_by?: string;
}

// ==================== 分类 API ====================

export async function fetchKbCategories(params: { is_published?: boolean } = {}): Promise<KbCategoryRecord[]> {
  return getJson<KbCategoryRecord[]>('/kb/categories', { params });
}

export async function fetchKbCategory(id: number): Promise<KbCategoryRecord> {
  return getJson<KbCategoryRecord>(`/kb/categories/${id}`);
}

export async function createKbCategory(payload: Partial<KbCategoryRecord>): Promise<KbCategoryRecord> {
  return postJson<KbCategoryRecord>('/kb/categories', payload);
}

export async function updateKbCategory(id: number, payload: Partial<KbCategoryRecord>): Promise<KbCategoryRecord> {
  return putJson<KbCategoryRecord>(`/kb/categories/${id}`, payload);
}

export async function deleteKbCategory(id: number): Promise<void> {
  await deleteJson(`/kb/categories/${id}`);
}

// ==================== 文章 API ====================

export async function fetchKbArticles(params: KbArticleListParams = {}): Promise<Paginated<KbArticleRecord>> {
  return getJson<Paginated<KbArticleRecord>>('/kb/articles', { params });
}

export async function fetchKbArticle(id: number): Promise<KbArticleDetail> {
  return getJson<KbArticleDetail>(`/kb/articles/${id}`);
}

export async function createKbArticle(payload: Partial<KbArticleRecord>): Promise<KbArticleRecord> {
  return postJson<KbArticleRecord>('/kb/articles', payload);
}

export async function updateKbArticle(id: number, payload: Partial<KbArticleRecord>): Promise<KbArticleRecord> {
  return putJson<KbArticleRecord>(`/kb/articles/${id}`, payload);
}

export async function deleteKbArticle(id: number): Promise<void> {
  await deleteJson(`/kb/articles/${id}`);
}

export async function publishKbArticle(id: number): Promise<KbArticleRecord> {
  return postJson<KbArticleRecord>(`/kb/articles/${id}/publish`);
}

export async function archiveKbArticle(id: number): Promise<KbArticleRecord> {
  return postJson<KbArticleRecord>(`/kb/articles/${id}/archive`);
}

export async function fetchKbArticleStats(): Promise<{
  total: number;
  published: number;
  draft: number;
  archived: number;
  featured: number;
  ai_generated: number;
  total_views: number;
}> {
  return getJson('/kb/articles/stats');
}

// ==================== 公开访问（帮助中心） ====================

export async function fetchPublicKbCategories(): Promise<KbCategoryRecord[]> {
  return getJson<KbCategoryRecord[]>('/kb/public/categories');
}

export async function fetchPublicKbArticles(params: { category_id?: number; keyword?: string } = {}): Promise<KbArticleRecord[]> {
  return getJson<KbArticleRecord[]>('/kb/public/articles', { params });
}

export async function fetchPublicKbArticle(slug: string): Promise<KbArticleDetail> {
  return getJson<KbArticleDetail>(`/kb/public/articles/${slug}`);
}

export async function trackKbArticleView(id: number): Promise<void> {
  await postJson(`/kb/public/articles/${id}/view`);
}

export async function rateKbArticle(id: number, helpful: boolean): Promise<void> {
  await postJson(`/kb/public/articles/${id}/rate`, { helpful });
}
