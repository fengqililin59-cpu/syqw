import { deleteJson, getJson, postJson, putJson } from './client'

// ── Types ──

export interface ProductItem {
  id: number
  tenant_id: number
  name: string
  description: string | null
  category: string | null
  unit_price: number
  unit: string | null
  is_active: number
  image_url: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ProductListResult {
  list: ProductItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CategoriesResult {
  categories: string[]
}

export interface ProductQuery {
  page?: number
  limit?: number
  keyword?: string
  category?: string
  is_active?: string
}

export interface ProductForm {
  name: string
  description?: string
  category?: string
  unit_price?: number
  unit?: string
  is_active?: boolean
  image_url?: string
  metadata?: Record<string, unknown>
}

// ── API Functions ──

export async function fetchProducts(query: ProductQuery = {}): Promise<ProductListResult> {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))
  if (query.keyword) params.set('keyword', query.keyword)
  if (query.category) params.set('category', query.category)
  if (query.is_active !== undefined) params.set('is_active', query.is_active)
  const qs = params.toString()
  return getJson<ProductListResult>(`/products${qs ? `?${qs}` : ''}`)
}

export async function fetchCategories(): Promise<CategoriesResult> {
  return getJson<CategoriesResult>('/products/categories')
}

export async function fetchProduct(id: number): Promise<ProductItem> {
  return getJson<ProductItem>(`/products/${id}`)
}

export async function createProduct(data: ProductForm): Promise<ProductItem> {
  return postJson<ProductItem>('/products', data)
}

export async function updateProduct(id: number, data: ProductForm): Promise<ProductItem> {
  return putJson<ProductItem>(`/products/${id}`, data)
}

export async function deleteProduct(id: number): Promise<void> {
  await deleteJson<void>(`/products/${id}`)
}
