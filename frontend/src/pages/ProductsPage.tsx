/**
 * @file 产品与服务目录页面 — 产品卡片网格/列表视图，支持搜索、分类筛选、CRUD。
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  SearchX,
  Loader2,
  Search,
  Filter,
  LayoutGrid,
  List,
  Tag,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProductItem, ProductForm } from '@/api/products'
import {
  fetchProducts,
  fetchCategories,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/api/products'

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // 弹窗状态
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ProductItem | null>(null)
  const [form, setForm] = useState<ProductForm>({ name: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [prodRes, catRes] = await Promise.all([
        fetchProducts({ page, keyword, category: categoryFilter }),
        fetchCategories(),
      ])
      setProducts(prodRes.list)
      setTotalPages(prodRes.totalPages)
      setCategories(catRes.categories)
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, keyword, categoryFilter])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '' })
    setShowModal(true)
  }

  const openEdit = (p: ProductItem) => {
    setEditing(p)
    setForm({
      name: p.name,
      description: p.description || '',
      category: p.category || '',
      unit_price: Number(p.unit_price) || 0,
      unit: p.unit || '',
      is_active: p.is_active === 1,
      image_url: p.image_url || '',
      metadata: p.metadata || {},
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name?.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await updateProduct(editing.id, form)
      } else {
        await createProduct(form)
      }
      setShowModal(false)
      load()
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: ProductItem) => {
    if (!confirm(`确定删除「${p.name}」吗？此操作不可撤销。`)) return
    try {
      await deleteProduct(p.id)
      load()
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || '删除失败')
    }
  }

  const formatPrice = (price: number) => {
    if (!price && price !== 0) return '-'
    return `¥${Number(price).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl p-6">
        {/* 顶栏 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#0f1e2e]">产品与服务目录</h1>
            <p className="mt-1 text-sm text-[#6b8299]">管理您的产品、服务及定价信息</p>
          </div>
          <Button onClick={openCreate} className="gap-2 bg-[#3b82f6] hover:bg-[#2563eb]">
            <Plus className="h-4 w-4" />
            添加产品
          </Button>
        </div>

        {/* 筛选栏 */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a8be]" />
            <input
              type="text"
              placeholder="搜索产品名称或描述..."
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1) }}
              className="w-full rounded-lg border border-[#d0dde8] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a8be]" />
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
              className="appearance-none rounded-lg border border-[#d0dde8] bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-[#3b82f6]"
            >
              <option value="">全部分类</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {/* 视图切换 */}
          <div className="ml-auto flex rounded-lg border border-[#d0dde8] overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-[#3b82f6] text-white' : 'bg-white text-[#64748b] hover:bg-[#f1f5f9]'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-[#3b82f6] text-white' : 'bg-white text-[#64748b] hover:bg-[#f1f5f9]'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 状态 */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-[#94a8be]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
            <button onClick={load} className="ml-3 underline">重试</button>
          </div>
        )}

        {/* 网格视图 */}
        {!loading && !error && viewMode === 'grid' && (
          <>
            {products.length === 0 ? (
              <EmptyState keyword={keyword} categoryFilter={categoryFilter} openCreate={openCreate} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    formatPrice={formatPrice}
                    onEdit={() => openEdit(p)}
                    onDelete={() => handleDelete(p)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* 列表视图 */}
        {!loading && !error && viewMode === 'list' && (
          <>
            {products.length === 0 ? (
              <EmptyState keyword={keyword} categoryFilter={categoryFilter} openCreate={openCreate} />
            ) : (
              <div className="rounded-lg border border-[#e2eaf3] bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#e2eaf3] bg-[#f8fafc]">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-[#64748b]">产品名称</th>
                      <th className="px-4 py-3 text-left font-medium text-[#64748b]">分类</th>
                      <th className="px-4 py-3 text-right font-medium text-[#64748b]">单价</th>
                      <th className="px-4 py-3 text-center font-medium text-[#64748b]">状态</th>
                      <th className="px-4 py-3 text-right font-medium text-[#64748b]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b border-[#e2eaf3] hover:bg-[#f8fafc]">
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#0f1e2e]">{p.name}</div>
                          {p.description && (
                            <div className="mt-0.5 text-xs text-[#94a8be] line-clamp-1">{p.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.category ? (
                            <span className="inline-flex items-center rounded bg-[#eff6ff] px-2 py-0.5 text-xs text-[#3b82f6]">
                              {p.category}
                            </span>
                          ) : (
                            <span className="text-[#c5cdd8]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[#0f1e2e]">
                          {formatPrice(Number(p.unit_price))}
                          {p.unit && <span className="ml-1 text-xs text-[#94a8be]">/ {p.unit}</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                            p.is_active ? 'bg-[#ecfdf5] text-[#10b981]' : 'bg-[#f1f5f9] text-[#94a8be]'
                          }`}>
                            {p.is_active ? '上架' : '下架'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(p)}
                              className="rounded p-1.5 text-[#94a8be] hover:bg-[#eff6ff] hover:text-[#3b82f6]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              className="rounded p-1.5 text-[#94a8be] hover:bg-[#fef2f2] hover:text-[#ef4444]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* 分页 */}
        {!loading && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              上一页
            </Button>
            <span className="text-sm text-[#64748b]">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        )}
      </div>

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <ProductModal
          editing={editing}
          form={form}
          setForm={setForm}
          saving={saving}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

/** 产品卡片（网格视图） */
function ProductCard({
  product,
  formatPrice,
  onEdit,
  onDelete,
}: {
  product: ProductItem
  formatPrice: (p: number) => string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="group rounded-xl border border-[#e2eaf3] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eff6ff]">
          <Package className="h-5 w-5 text-[#3b82f6]" />
        </div>
        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="rounded p-1 text-[#94a8be] hover:bg-[#eff6ff] hover:text-[#3b82f6]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-[#94a8be] hover:bg-[#fef2f2] hover:text-[#ef4444]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <h3 className="mb-1 font-semibold text-[#0f1e2e]">{product.name}</h3>
      {product.description && (
        <p className="mb-3 line-clamp-2 text-xs text-[#94a8be]">{product.description}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold text-[#0f1e2e]">
          {formatPrice(Number(product.unit_price))}
          {product.unit && <span className="ml-1 text-xs font-normal text-[#94a8be]">/ {product.unit}</span>}
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
          product.is_active ? 'bg-[#ecfdf5] text-[#10b981]' : 'bg-[#f1f5f9] text-[#94a8be]'
        }`}>
          {product.is_active ? '上架' : '下架'}
        </span>
      </div>
      {product.category && (
        <div className="mt-3 flex items-center gap-1 text-xs text-[#64748b]">
          <Tag className="h-3 w-3" />
          {product.category}
        </div>
      )}
    </div>
  )
}

/** 空状态 */
function EmptyState({
  keyword, categoryFilter, openCreate,
}: {
  keyword: string; categoryFilter: string; openCreate: () => void
}) {
  const hasFilter = keyword || categoryFilter
  return (
    <div className="flex flex-col items-center justify-center py-20 text-[#94a8be]">
      <SearchX className="mb-3 h-12 w-12" />
      <p className="mb-1 text-sm">
        {hasFilter ? '暂无匹配的产品' : '暂无产品数据'}
      </p>
      {hasFilter ? (
        <p className="text-xs">试试调整筛选条件</p>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={openCreate}
          className="mt-3 text-[#3b82f6]"
        >
          <Plus className="mr-1 h-4 w-4" />
          添加第一个产品
        </Button>
      )}
    </div>
  )
}

/** 新建/编辑弹窗 */
function ProductModal({
  editing, form, setForm, saving, onSave, onClose,
}: {
  editing: ProductItem | null
  form: ProductForm
  setForm: (f: ProductForm) => void
  saving: boolean
  onSave: () => void
  onClose: () => void
}) {
  const update = (patch: Partial<ProductForm>) => setForm({ ...form, ...patch })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0f1e2e]">
            {editing ? '编辑产品' : '添加产品'}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-[#94a8be] hover:bg-[#f1f5f9]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">产品名称 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="例如：标准会员"
              className="w-full rounded-lg border border-[#d0dde8] px-3 py-2 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">描述</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="简要描述产品..."
              rows={2}
              className="w-full rounded-lg border border-[#d0dde8] px-3 py-2 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">分类</label>
              <input
                type="text"
                value={form.category || ''}
                onChange={(e) => update({ category: e.target.value })}
                placeholder="例如：服务"
                className="w-full rounded-lg border border-[#d0dde8] px-3 py-2 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">单位</label>
              <input
                type="text"
                value={form.unit || ''}
                onChange={(e) => update({ unit: e.target.value })}
                placeholder="套/次/人/小时"
                className="w-full rounded-lg border border-[#d0dde8] px-3 py-2 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">单价 (¥)</label>
            <input
              type="number"
              value={form.unit_price ?? ''}
              onChange={(e) => update({ unit_price: e.target.value ? Number(e.target.value) : 0 })}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-[#d0dde8] px-3 py-2 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">图片链接</label>
            <input
              type="text"
              value={form.image_url || ''}
              onChange={(e) => update({ image_url: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-lg border border-[#d0dde8] px-3 py-2 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_active !== false}
              onChange={(e) => update({ is_active: e.target.checked })}
              className="h-4 w-4 rounded border-[#d0dde8] text-[#3b82f6] focus:ring-[#3b82f6]"
            />
            <span className="text-sm text-[#0f1e2e]">上架（启用后可在业务中使用）</span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button
            onClick={onSave}
            disabled={saving || !form.name?.trim()}
            className="bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50"
          >
            {saving ? '保存中...' : editing ? '保存' : '创建'}
          </Button>
        </div>
      </div>
    </div>
  )
}
