/**
 * @file 成交订单管理页面 — 列表/详情，支持搜索、状态筛选、CRUD。
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  XCircle,
  Ban,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatAmount, type OrderItem, type OrderStatus, type OrderForm, fetchOrders, fetchOrder, createOrder, updateOrder, deleteOrder } from '@/api/orders'

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('')

  // 弹窗状态
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<OrderItem | null>(null)
  const [form, setForm] = useState<OrderForm>({ customer_id: '', amount: '' })
  const [saving, setSaving] = useState(false)

  // 详情抽屉
  const [detail, setDetail] = useState<OrderItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchOrders({
        page,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
        limit: 15,
      })
      setOrders(res.list)
      setTotalPages(res.totalPages)
      setTotal(res.total)
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, keyword, statusFilter])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ customer_id: '', amount: '' })
    setShowModal(true)
  }

  const openEdit = (o: OrderItem) => {
    setEditing(o)
    setForm({
      customer_id: o.customer_id,
      order_no: o.order_no || '',
      amount: o.amount,
      currency: o.currency,
      status: o.status,
      paid_at: o.paid_at ? o.paid_at.slice(0, 16) : null,
      remark: o.remark || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.customer_id || !form.amount || Number(form.amount) <= 0) return
    setSaving(true)
    try {
      if (editing) {
        await updateOrder(editing.id, form)
      } else {
        await createOrder(form)
      }
      setShowModal(false)
      load()
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (o: OrderItem) => {
    if (!confirm(`确定删除订单 #${o.order_no || o.id} 吗？此操作不可撤销。`)) return
    try {
      await deleteOrder(o.id)
      load()
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || '删除失败')
    }
  }

  const openDetail = async (o: OrderItem) => {
    try {
      const d = await fetchOrder(o.id)
      setDetail(d)
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || '加载详情失败')
    }
  }

  const statusOptions: { value: OrderStatus | ''; label: string }[] = [
    { value: '', label: '全部状态' },
    { value: 'pending', label: '待支付' },
    { value: 'paid', label: '已支付' },
    { value: 'completed', label: '已完成' },
    { value: 'refunded', label: '已退款' },
    { value: 'cancelled', label: '已取消' },
  ]

  const STATUS_BADGE: Record<string, { label: string; bg: string; icon: any }> = {
    pending:   { label: '待支付', bg: 'bg-yellow-100 text-yellow-700', icon: Clock },
    paid:      { label: '已支付', bg: 'bg-blue-100 text-blue-700', icon: CheckCircle },
    completed: { label: '已完成', bg: 'bg-green-100 text-green-700', icon: CheckCircle },
    refunded:  { label: '已退款', bg: 'bg-gray-100 text-gray-500', icon: Ban },
    cancelled: { label: '已取消', bg: 'bg-red-100 text-red-700', icon: XCircle },
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl p-6">
        {/* 顶栏 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#0f1e2e]">成交订单</h1>
            <p className="mt-1 text-sm text-[#6b8299]">
              管理客户成交订单，自动关联客户阶段与业绩统计
              {total > 0 && <span className="ml-2 rounded bg-[#eff6ff] px-2 py-0.5 text-xs text-[#3b82f6]">共 {total} 笔</span>}
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2 bg-[#3b82f6] hover:bg-[#2563eb]">
            <Plus className="h-4 w-4" />
            新建订单
          </Button>
        </div>

        {/* 筛选栏 */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a8be]" />
            <input
              type="text"
              placeholder="搜索客户名称/手机号/订单号..."
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1) }}
              className="w-full rounded-lg border border-[#d0dde8] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a8be]" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1) }}
              className="appearance-none rounded-lg border border-[#d0dde8] bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-[#3b82f6]"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 加载/错误 */}
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

        {/* 订单表格 */}
        {!loading && !error && (
          <>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#94a8be]">
                <Receipt className="mb-3 h-12 w-12" />
                <p className="mb-1 text-sm">{keyword || statusFilter ? '暂无匹配的订单' : '暂无订单数据'}</p>
                {!(keyword || statusFilter) && (
                  <Button variant="ghost" size="sm" onClick={openCreate} className="mt-3 text-[#3b82f6]">
                    <Plus className="mr-1 h-4 w-4" />创建第一笔订单
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-[#e2eaf3] bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#e2eaf3] bg-[#f8fafc]">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-[#64748b]">订单号</th>
                      <th className="px-4 py-3 text-left font-medium text-[#64748b]">客户</th>
                      <th className="px-4 py-3 text-right font-medium text-[#64748b]">金额</th>
                      <th className="px-4 py-3 text-center font-medium text-[#64748b]">状态</th>
                      <th className="px-4 py-3 text-left font-medium text-[#64748b]">支付时间</th>
                      <th className="px-4 py-3 text-left font-medium text-[#64748b]">创建人</th>
                      <th className="px-4 py-3 text-right font-medium text-[#64748b]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const s = STATUS_BADGE[o.status] || STATUS_BADGE.pending
                      const SIcon = s.icon
                      return (
                        <tr key={o.id} className="border-b border-[#e2eaf3] hover:bg-[#f8fafc] cursor-pointer" onClick={() => openDetail(o)}>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-[#3b82f6]">
                              {o.order_no || `#${o.id}`}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-[#0f1e2e]">
                              {o.customer?.name || o.customer?.nickname || `客户#${o.customer_id}`}
                            </div>
                            {o.customer?.phone && (
                              <div className="text-xs text-[#94a8be]">{o.customer.phone}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#0f1e2e]">
                            {formatAmount(o.amount, o.currency)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${s.bg}`}>
                              <SIcon className="h-3 w-3" />
                              {s.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#64748b]">
                            {o.paid_at ? new Date(o.paid_at).toLocaleDateString('zh-CN') : '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#64748b]">
                            {o.creator?.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={(e) => { e.stopPropagation(); openEdit(o) }} className="rounded p-1.5 text-[#94a8be] hover:bg-[#eff6ff] hover:text-[#3b82f6]">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(o) }} className="rounded p-1.5 text-[#94a8be] hover:bg-[#fef2f2] hover:text-[#ef4444]">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 分页 */}
            {orders.length > 0 && totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />上一页
                </Button>
                <span className="text-sm text-[#64748b]">{page} / {totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  下一页<ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <OrderModal
          editing={editing}
          form={form}
          setForm={(f: OrderForm) => setForm(f)}
          saving={saving}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* 详情抽屉 */}
      {detail && (
        <OrderDetailDrawer
          order={detail}
          onClose={() => setDetail(null)}
          onEdit={() => { setDetail(null); openEdit(detail) }}
          onRefresh={load}
        />
      )}
    </div>
  )
}

// ── 新建/编辑弹窗 ────────────────────────────────────────────────────────────────

function OrderModal({
  editing, form, setForm, saving, onSave, onClose,
}: {
  editing: OrderItem | null
  form: OrderForm
  setForm: (f: OrderForm) => void
  saving: boolean
  onSave: () => void
  onClose: () => void
}) {
  const update = (patch: Partial<OrderForm>) => setForm({ ...form, ...patch })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0f1e2e]">
            {editing ? '编辑订单' : '新建订单'}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-[#94a8be] hover:bg-[#f1f5f9]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 客户 ID */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">客户 ID *</label>
            <input
              type="number"
              value={form.customer_id || ''}
              onChange={(e) => update({ customer_id: e.target.value ? Number(e.target.value) : '' })}
              placeholder="输入客户 ID"
              disabled={!!editing}
              className="w-full rounded-lg border border-[#d0dde8] px-3 py-2 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] disabled:bg-[#f1f5f9]"
            />
            {editing?.customer && (
              <p className="mt-1 text-xs text-[#64748b]">客户：{editing.customer.name || editing.customer.nickname}</p>
            )}
          </div>

          {/* 订单号 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">订单号</label>
            <input
              type="text"
              value={form.order_no || ''}
              onChange={(e) => update({ order_no: e.target.value })}
              placeholder="留空自动生成"
              className="w-full rounded-lg border border-[#d0dde8] px-3 py-2 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
            />
          </div>

          {/* 金额 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">金额 (¥) *</label>
              <input
                type="number"
                value={form.amount ?? ''}
                onChange={(e) => update({ amount: e.target.value ? Number(e.target.value) : '' })}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-[#d0dde8] px-3 py-2 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">币种</label>
              <select
                value={form.currency || 'CNY'}
                onChange={(e) => update({ currency: e.target.value })}
                className="w-full rounded-lg border border-[#d0dde8] bg-white px-3 py-2 text-sm outline-none focus:border-[#3b82f6]"
              >
                <option value="CNY">CNY (¥)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          {/* 状态 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">订单状态</label>
            <select
              value={form.status || 'pending'}
              onChange={(e) => update({ status: e.target.value as OrderStatus })}
              className="w-full rounded-lg border border-[#d0dde8] bg-white px-3 py-2 text-sm outline-none focus:border-[#3b82f6]"
            >
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="completed">已完成</option>
              <option value="refunded">已退款</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>

          {/* 支付时间 */}
          {(form.status === 'paid' || form.status === 'completed') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">支付时间</label>
              <input
                type="datetime-local"
                value={form.paid_at || ''}
                onChange={(e) => update({ paid_at: e.target.value || null })}
                className="w-full rounded-lg border border-[#d0dde8] px-3 py-2 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
              />
            </div>
          )}

          {/* 备注 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0f1e2e]">备注</label>
            <textarea
              value={form.remark || ''}
              onChange={(e) => update({ remark: e.target.value })}
              placeholder="订单备注信息..."
              rows={2}
              className="w-full rounded-lg border border-[#d0dde8] px-3 py-2 text-sm outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] resize-none"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button
            onClick={onSave}
            disabled={saving || !form.customer_id || !form.amount || Number(form.amount) <= 0}
            className="bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50"
          >
            {saving ? '保存中...' : editing ? '保存' : '创建'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── 订单详情抽屉 ─────────────────────────────────────────────────────────────────

function OrderDetailDrawer({
  order, onClose, onEdit, onRefresh,
}: {
  order: OrderItem
  onClose: () => void
  onEdit: () => void
  onRefresh: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const s = (STATUS_BADGE as any)[order.status] || (STATUS_BADGE as any).pending
  const SIcon: any = s.icon

  const handleDelete = async () => {
    if (!confirm(`确定删除订单 #${order.order_no || order.id} 吗？`)) return
    setDeleting(true)
    try {
      await deleteOrder(order.id)
      onClose()
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="sticky top-0 z-10 border-b border-[#e2eaf3] bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0f1e2e]">
                订单详情
              </h2>
              <p className="mt-0.5 text-xs text-[#94a8be] font-mono">
                {order.order_no || `#${order.id}`}
              </p>
            </div>
            <button onClick={onClose} className="rounded p-1 text-[#94a8be] hover:bg-[#f1f5f9]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* 状态卡片 */}
          <div className="rounded-lg bg-[#f8fafc] px-4 py-3">
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm font-medium ${s.bg}`}>
                <SIcon className="h-4 w-4" />
                {s.label}
              </span>
              <span className="text-2xl font-bold text-[#0f1e2e]">
                {formatAmount(order.amount, order.currency)}
              </span>
            </div>
          </div>

          {/* 客户信息 */}
          {order.customer && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[#94a8be]">客户信息</h3>
              <div className="rounded-lg border border-[#e2eaf3] p-3">
                <div className="font-medium text-[#0f1e2e]">{order.customer.name || order.customer.nickname}</div>
                {order.customer.phone && (
                  <div className="mt-0.5 text-sm text-[#64748b]">{order.customer.phone}</div>
                )}
                {order.customer.stage && (
                  <div className="mt-1">
                    <span className="rounded bg-[#eff6ff] px-2 py-0.5 text-xs text-[#3b82f6]">
                      阶段：{order.customer.stage}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 订单信息 */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[#94a8be]">订单信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#64748b]">订单号</span>
                <span className="font-mono text-[#0f1e2e]">{order.order_no || `系统生成 #${order.id}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">金额</span>
                <span className="font-bold text-[#0f1e2e]">{formatAmount(order.amount, order.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">币种</span>
                <span className="text-[#0f1e2e]">{order.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">支付时间</span>
                <span className="text-[#0f1e2e]">
                  {order.paid_at ? new Date(order.paid_at).toLocaleString('zh-CN') : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">创建时间</span>
                <span className="text-[#0f1e2e]">{new Date(order.created_at).toLocaleString('zh-CN')}</span>
              </div>
              {order.creator && (
                <div className="flex justify-between">
                  <span className="text-[#64748b]">创建人</span>
                  <span className="text-[#0f1e2e]">{order.creator.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* 备注 */}
          {order.remark && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[#94a8be]">备注</h3>
              <div className="rounded-lg border border-[#e2eaf3] p-3 text-sm text-[#0f1e2e] whitespace-pre-wrap">
                {order.remark}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="sticky bottom-0 border-t border-[#e2eaf3] bg-white px-6 py-3 flex justify-between">
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}
            className="text-[#ef4444] hover:bg-[#fef2f2]"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {deleting ? '删除中...' : '删除'}
          </Button>
          <Button size="sm" onClick={onEdit} className="bg-[#3b82f6] hover:bg-[#2563eb]">
            <Pencil className="mr-1 h-4 w-4" />编辑
          </Button>
        </div>
      </div>
    </div>
  )
}

const STATUS_BADGE = {
  pending:   { label: '待支付', bg: 'bg-yellow-100 text-yellow-700', icon: Clock },
  paid:      { label: '已支付', bg: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  completed: { label: '已完成', bg: 'bg-green-100 text-green-700', icon: CheckCircle },
  refunded:  { label: '已退款', bg: 'bg-gray-100 text-gray-500', icon: Ban },
  cancelled: { label: '已取消', bg: 'bg-red-100 text-red-700', icon: XCircle },
}
