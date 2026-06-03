/**
 * @file 话术库 API。
 */
import { deleteJson, getJson, postJson, putJson } from '@/api/client'
import type { ScriptLibraryItem } from '@/api/types'

export async function fetchScriptLibraryItems(query?: { category?: string; keyword?: string }) {
  const params = new URLSearchParams()
  if (query?.category) params.set('category', query.category)
  if (query?.keyword) params.set('keyword', query.keyword)
  const q = params.toString()
  return getJson<ScriptLibraryItem[]>(`/script-library${q ? `?${q}` : ''}`)
}

export async function fetchScriptLibraryCategories() {
  return getJson<string[]>('/script-library/categories')
}

export async function createScriptLibraryItem(body: {
  category?: string | null
  title: string
  body: string
  sort_order?: number
}) {
  return postJson<ScriptLibraryItem>('/script-library', body)
}

export async function updateScriptLibraryItem(
  id: number,
  body: {
    category?: string | null
    title?: string
    body?: string
    sort_order?: number
  },
) {
  return putJson<ScriptLibraryItem>(`/script-library/${id}`, body)
}

export async function deleteScriptLibraryItem(id: number) {
  return deleteJson<{ id: number }>(`/script-library/${id}`)
}

export type IndustryScriptPack = {
  id: string
  name: string
  description: string
  item_count: number
  imported?: boolean
}

export async function fetchIndustryScriptPacks() {
  return getJson<IndustryScriptPack[]>('/script-library/industry-packs')
}

export async function importIndustryScriptPack(packId: string) {
  return postJson<{ pack_name: string; created: number; skipped: number }>(
    '/script-library/industry-packs/import',
    { pack_id: packId },
  )
}
