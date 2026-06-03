/**
 * @file 仪表盘 · 收件箱 SLA 超时提醒，一键进入批量处理。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircleWarning, ChevronRight } from 'lucide-react'
import { fetchInboxSlaSummary } from '@/api/inbox'
import { useAuthStore } from '@/store/authStore'
import { hasPermUser } from '@/lib/roles'
import { Button } from '@/components/ui/button'

export function DashboardInboxSlaCard() {
  const navigate = useNavigate()
  const permissions = useAuthStore((s) => s.permissions)
  const canInbox = hasPermUser(permissions, 'inbox:view') || hasPermUser(permissions, 'customer:view')

  const [summary, setSummary] = useState<{
    sla_minutes: number
    sla_overdue_active: number
    sla_snoozed: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canInbox) return
    let cancelled = false
    setLoading(true)
    void fetchInboxSlaSummary()
      .then((s) => {
        if (!cancelled) {
          setSummary({
            sla_minutes: s.sla_minutes,
            sla_overdue_active: s.sla_overdue_active,
            sla_snoozed: s.sla_snoozed,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canInbox])

  if (!canInbox || loading) return null
  if (!summary || summary.sla_overdue_active <= 0) return null

  const goBatch = () => navigate('/app/inbox?filter=sla_overdue')
  const goNeedsReply = () => navigate('/app/inbox?filter=needs_reply')

  return (
    <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50/80 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <MessageCircleWarning className="h-5 w-5 text-amber-800" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-950">
              收件箱 SLA 超时 · <span className="tabular-nums">{summary.sla_overdue_active}</span> 个会话
            </p>
            <p className="mt-0.5 text-xs text-amber-900/80">
              客户消息超过 {summary.sla_minutes} 分钟未回复
              {summary.sla_snoozed > 0 ? `；另有 ${summary.sla_snoozed} 个已暂缓` : ''}
              。进入批量模式可认领、标待人工或暂缓。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="border-amber-300 bg-white/80" onClick={goNeedsReply}>
            待回复
          </Button>
          <Button size="sm" onClick={goBatch}>
            批量处理
            <ChevronRight className="ml-0.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
