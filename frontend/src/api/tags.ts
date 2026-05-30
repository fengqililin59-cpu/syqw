/**
 * @file 客户标签 API。
 */
import { deleteJson, getJson, postJson, putJson } from '@/api/client'
import type { TagRow } from '@/api/types'

export async function fetchTags(category?: string) {
  const q = category ? `?category=${encodeURIComponent(category)}` : ''
  return getJson<TagRow[]>(`/tags${q}`)
}

export async function fetchTagCategories() {
  return getJson<string[]>('/tags/categories')
}

export async function createTag(body: { name: string; color?: string | null; category?: string | null }) {
  return postJson<TagRow>('/tags', body)
}

export async function updateTag(
  id: number,
  body: { name?: string; color?: string | null; category?: string | null },
) {
  return putJson<TagRow>(`/tags/${id}`, body)
}

export async function deleteTag(id: number) {
  return deleteJson<{ id: number }>(`/tags/${id}`)
}
