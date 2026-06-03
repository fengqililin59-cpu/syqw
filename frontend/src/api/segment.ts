import { getJson, postJson, putJson, deleteJson } from './client';

// ==================== 类型 ====================

export interface SegmentRule {
  field: 'stage' | 'tags' | 'source' | 'assigned_to' | 'last_activity_days' | 'created_days' | 'order_count' | 'total_spent' | 'custom_field';
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'not_contains' | 'in';
  value: string | number | { field_id: number; value: string };
}

export interface SegmentRecord {
  id: number;
  tenant_id: number;
  name: string;
  description: string;
  rules: SegmentRule[];
  match_type: 'all' | 'any';
  color_tag: string;
  icon: string;
  is_auto_refresh: boolean;
  member_count: number;
  last_refreshed_at: string | null;
  created_by: number;
  creator?: { id: number; name: string };
  created_at: string;
  updated_at: string;
}

export interface SegmentMember {
  id: number;
  segment_id: number;
  customer_id: number;
  customer: {
    id: number;
    name: string;
    phone: string;
    stage: string;
    tags: string;
    source: string;
    assigned_to: number;
    created_at: string;
  };
  added_at: string;
}

export interface SegmentMemberList {
  total: number;
  list: SegmentMember[];
  page: number;
  pageSize: number;
}

export interface SegmentPreview {
  total: number;
  sample: { id: number; name: string; phone: string; stage: string; tags: string }[];
}

// ==================== API ====================

export async function fetchSegments(): Promise<SegmentRecord[]> {
  return getJson<SegmentRecord[]>('/segments');
}

export async function fetchSegment(id: number): Promise<SegmentRecord> {
  return getJson<SegmentRecord>(`/segments/${id}`);
}

export async function createSegment(body: {
  name: string;
  description?: string;
  rules: SegmentRule[];
  match_type?: 'all' | 'any';
  color_tag?: string;
  icon?: string;
  is_auto_refresh?: boolean;
}): Promise<SegmentRecord> {
  return postJson<SegmentRecord>('/segments', body);
}

export async function updateSegment(id: number, body: Partial<{
  name: string;
  description: string;
  rules: SegmentRule[];
  match_type: 'all' | 'any';
  color_tag: string;
  icon: string;
  is_auto_refresh: boolean;
}>): Promise<SegmentRecord> {
  return putJson<SegmentRecord>(`/segments/${id}`, body);
}

export async function deleteSegment(id: number): Promise<void> {
  await deleteJson(`/segments/${id}`);
}

export async function fetchSegmentMembers(
  segmentId: number,
  params: { page?: number; page_size?: number } = {}
): Promise<SegmentMemberList> {
  return getJson<SegmentMemberList>(`/segments/${segmentId}/members`, { params });
}

export async function refreshSegmentMembers(segmentId: number): Promise<{ matched: number }> {
  return postJson<{ matched: number }>(`/segments/${segmentId}/refresh`);
}

export async function refreshAllSegments(): Promise<{ id: number; name: string; matched: number }[]> {
  return postJson<{ id: number; name: string; matched: number }[]>('/segments/refresh-all');
}

export async function previewSegmentRules(body: {
  rules: SegmentRule[];
  match_type?: 'all' | 'any';
}): Promise<SegmentPreview> {
  return postJson<SegmentPreview>('/segments/preview', body);
}
