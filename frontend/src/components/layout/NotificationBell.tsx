/**
 * @file 顶栏通知铃铛组件 — Bell 图标 + 未读角标 + 下拉面板。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import type { Notification as NotifItem } from '@/api/notifications'
import {
  fetchRecentNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
} from '@/api/notifications'

/** 通知类型到中文标签和图标色 */
const TYPE_META: Record<string, { label: string; color: string }> = {
  lead_assigned: { label: '线索分配', color: '#3b82f6' },
  followup_reminder: { label: '跟进提醒', color: '#f59e0b' },
  stage_changed: { label: '阶段变更', color: '#8b5cf6' },
  customer_transferred: { label: '客户转移', color: '#06b6d4' },
  deal_won: { label: '成交', color: '#10b981' },
  deal_lost: { label: '丢单', color: '#ef4444' },
  comment_added: { label: '新增评论', color: '#6366f1' },
  task_assigned: { label: '任务分配', color: '#14b8a6' },
  system_notice: { label: '系统公告', color: '#64748b' },
  ai_alert: { label: 'AI 预警', color: '#ec4899' },
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<NotifItem[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchRecentNotifications(5)
      setItems(Array.isArray(data?.items) ? data.items : [])
      setUnreadCount(Number(data?.unreadCount) || 0)
    } catch {
      // 静默失败
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载 + 定时轮询（30s）
  useEffect(() => {
    loadData()
    pollRef.current = setInterval(() => {
      fetchUnreadCount()
        .then((data) => setUnreadCount(Number(data?.count) || 0))
        .catch(() => {})
    }, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadData])

  // 点击外部关闭
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      setUnreadCount(0)
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {
      // 静默
    }
  }

  function handleClickItem(item: NotifItem) {
    setOpen(false)
    // 根据 related_type 跳转
    if (item.related_type === 'customer' && item.related_id) {
      navigate(`/app/customers/${item.related_id}`)
    } else if (item.related_type === 'ticket' && item.related_id) {
      navigate(`/app/service-desk/tickets/${item.related_id}`)
    } else {
      navigate('/app/notifications')
    }
  }

  function handleViewAll() {
    setOpen(false)
    navigate('/app/notifications')
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#c5d9ef] bg-white text-[#3d6a9a] transition-colors hover:bg-[#eef4ff] hover:text-[#1e4a7a]"
        title="通知中心"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 下拉面板 */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[#dde8f5] bg-white shadow-xl z-50">
          <div className="flex items-center justify-between border-b border-[#f0f4fa] px-4 py-3">
            <span className="text-sm font-semibold text-[#0f1e2e]">通知中心</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-[#5b8dd9] hover:text-[#3d6a9a]"
              >
                <CheckCheck className="h-3 w-3" />
                全部已读
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">加载中…</div>
            )}
            {!loading && items.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                <Bell className="mx-auto mb-2 h-6 w-6 opacity-30" />
                暂无通知
              </div>
            )}
            {items.map((item) => {
              const meta = TYPE_META[item.type] || { label: item.type, color: '#94a3b8' }
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleClickItem(item)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f7faff] ${
                    !item.is_read ? 'bg-[#f0f6ff]' : ''
                  }`}
                >
                  {/* 未读圆点 */}
                  <div className="mt-1.5 flex-shrink-0">
                    {!item.is_read ? (
                      <span className="block h-2 w-2 rounded-full bg-[#5b8dd9]" />
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-transparent" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: meta.color + '18', color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[13px] leading-snug text-[#1e293b]">
                      {item.title}
                    </p>
                    {item.body && (
                      <p className="mt-0.5 truncate text-[12px] text-[#94a3b8]">{item.body}</p>
                    )}
                    <p className="mt-1 text-[11px] text-[#c0cfe0]">{timeAgo(item.created_at)}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="border-t border-[#f0f4fa] px-4 py-2.5">
            <button
              type="button"
              onClick={handleViewAll}
              className="w-full rounded-md py-1.5 text-center text-[13px] font-medium text-[#5b8dd9] transition-colors hover:bg-[#f0f6ff]"
            >
              查看全部通知
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
