/**
 * @file 通知中心页面 — 完整的通知历史列表，含筛选和分页。
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  SearchX,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Notification as NotifItem, NotificationType } from '@/api/notifications'
import {
  fetchNotifications,
  fetchNotificationTypes,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/api/notifications'

/** 通知类型 → 信息 */
const TYPE_META: Record<string, { label: string; bg: string; fg: string }> = {
  lead_assigned: { label: '线索分配', bg: '#eff6ff', fg: '#3b82f6' },
  followup_reminder: { label: '跟进提醒', bg: '#fffbeb', fg: '#f59e0b' },
  stage_changed: { label: '阶段变更', bg: '#f5f3ff', fg: '#8b5cf6' },
  customer_transferred: { label: '客户转移', bg: '#ecfeff', fg: '#06b6d4' },
  deal_won: { label: '成交', bg: '#ecfdf5', fg: '#10b981' },
  deal_lost: { label: '丢单', bg: '#fef2f2', fg: '#ef4444' },
  comment_added: { label: '新增评论', bg: '#eef2ff', fg: '#6366f1' },
  task_assigned: { label: '任务分配', bg: '#f0fdfa', fg: '#14b8a6' },
  system_notice: { label: '系统公告', bg: '#f8fafc', fg: '#64748b' },
  ai_alert: { label: 'AI 预警', bg: '#fdf2f8', fg: '#ec4899' },
}

function timeStr(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `今天 ${time}`
  if (isYesterday) return `昨天 ${time}`
  return d.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<NotifItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<NotificationType | ''>('')
  const [filterRead, setFilterRead] = useState<'' | 'true' | 'false'>('')
  const [types, setTypes] = useState<{ value: string; label: string }[]>([])

  const PAGE_SIZE = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit: PAGE_SIZE }
      if (filterType) params.type = filterType
      if (filterRead === 'true') params.is_read = true
      else if (filterRead === 'false') params.is_read = false
      const data = await fetchNotifications(params as Parameters<typeof fetchNotifications>[0])
      setItems(Array.isArray(data?.items) ? data.items : [])
      setTotal(Number(data?.total) || 0)
      setTotalPages(Number(data?.totalPages) || 1)
    } catch {
      setItems([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [page, filterType, filterRead])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetchNotificationTypes()
      .then((list) => setTypes(Array.isArray(list) ? list : []))
      .catch(() => setTypes([]))
  }, [])

  async function handleClickItem(item: NotifItem) {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id)
      } catch {}
    }
    if (item.related_type === 'customer' && item.related_id) {
      navigate(`/app/customers/${item.related_id}`)
    } else if (item.related_type === 'ticket' && item.related_id) {
      navigate(`/app/service-desk/tickets/${item.related_id}`)
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      load()
    } catch {}
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* 页头 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0f1e2e]">通知中心</h1>
          <p className="mt-0.5 text-sm text-[#9ab0c8]">共 {total} 条通知</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllRead}
          className="gap-1.5 border-[#dde8f5] text-[#5b8dd9] hover:bg-[#f0f6ff]"
        >
          <CheckCheck className="h-4 w-4" />
          全部已读
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value as NotificationType | '')
            setPage(1)
          }}
          className="rounded-lg border border-[#dde8f5] bg-white px-3 py-1.5 text-sm text-[#475569] outline-none focus:border-[#5b8dd9]"
        >
          <option value="">全部类型</option>
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <div className="flex rounded-lg border border-[#dde8f5] bg-white overflow-hidden">
          {[
            { value: '', label: '全部' },
            { value: 'false', label: '未读' },
            { value: 'true', label: '已读' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setFilterRead(opt.value as '' | 'true' | 'false')
                setPage(1)
              }}
              className={`px-3 py-1.5 text-sm transition-colors ${
                filterRead === opt.value
                  ? 'bg-[#5b8dd9] text-white'
                  : 'text-[#64748b] hover:bg-[#f7faff]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 列表 */}
      <div className="rounded-xl border border-[#e5eff9] bg-white">
        {loading && items.length === 0 && (
          <div className="flex items-center justify-center py-16 text-[#9ab0c8]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中…
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-[#9ab0c8]">
            <SearchX className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">暂无匹配的通知</p>
          </div>
        )}

        {items.map((item, idx) => {
          const meta = TYPE_META[item.type] || {
            label: item.type,
            bg: '#f8fafc',
            fg: '#94a3b8',
          }
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleClickItem(item)}
              className={`flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-[#f7faff] ${
                idx > 0 ? 'border-t border-[#f0f4fa]' : ''
              } ${!item.is_read ? 'bg-[#f8fbff]' : ''}`}
            >
              {/* 类型图标区 */}
              <div
                className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm"
                style={{ background: meta.bg, color: meta.fg }}
              >
                {!item.is_read ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40"
                      style={{ background: meta.fg }}
                    />
                    <span
                      className="relative inline-flex h-2.5 w-2.5 rounded-full"
                      style={{ background: meta.fg }}
                    />
                  </span>
                ) : (
                  <Bell className="h-4 w-4" />
                )}
              </div>

              {/* 内容 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    {meta.label}
                  </span>
                  {!item.is_read && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#5b8dd9]" />
                  )}
                </div>
                <p
                  className={`mt-1 text-[14px] leading-snug ${
                    !item.is_read ? 'font-semibold text-[#0f1e2e]' : 'text-[#334155]'
                  }`}
                >
                  {item.title}
                </p>
                {item.body && (
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[#94a3b8]">
                    {item.body}
                  </p>
                )}
              </div>

              {/* 时间 */}
              <span className="flex-shrink-0 text-[12px] text-[#c0cfe0] whitespace-nowrap">
                {timeStr(item.created_at)}
              </span>
            </button>
          )
        })}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="text-[#5b8dd9]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = i + 1
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors ${
                  p === page
                    ? 'bg-[#5b8dd9] font-semibold text-white'
                    : 'text-[#64748b] hover:bg-[#f0f4fa]'
                }`}
              >
                {p}
              </button>
            )
          })}
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="text-[#5b8dd9]"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
