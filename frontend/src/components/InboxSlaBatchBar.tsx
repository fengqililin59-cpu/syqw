/**
 * @file 收件箱 SLA 超时批量操作栏。
 */
import { useEffect, useState } from 'react'
import { Bell, CheckSquare, Clock, UserCheck } from 'lucide-react'
import {
  fetchInboxSlaSummary,
  inboxSlaBatchAction,
  runInboxSlaScan,
  type InboxSlaBatchAction,
} from '@/api/inbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function InboxSlaBatchBar({
  selectedIds,
  onSelectAll,
  onClearSelection,
  onDone,
  canNotify,
}: {
  selectedIds: number[]
  onSelectAll: () => void
  onClearSelection: () => void
  onDone: () => void
  canNotify?: boolean
}) {
  const [summary, setSummary] = useState<{
    sla_minutes: number
    sla_overdue_active: number
    sla_snoozed: number
  } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetchInboxSlaSummary()
      .then(setSummary)
      .catch(() => setSummary(null))
  }, [])

  async function run(action: InboxSlaBatchAction, extra?: { snooze_hours?: number }) {
    if (!selectedIds.length) {
      window.alert('请先勾选会话')
      return
    }
    setBusy(true)
    try {
      const r = await inboxSlaBatchAction({
        action,
        thread_ids: selectedIds,
        ...extra,
      })
      window.alert(`已处理 ${r.updated} 个会话`)
      onDone()
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  async function notifySla() {
    setBusy(true)
    try {
      const r = await runInboxSlaScan(15)
      window.alert(`已扫描 ${r.scanned}，企微提醒 ${r.notified} 人`)
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '提醒失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50/90 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm text-amber-950">
        <Badge variant="outline" className="border-amber-400 bg-white text-amber-900">
          SLA {summary?.sla_minutes ?? 30} 分钟
        </Badge>
        <span>
          超时待处理 <strong>{summary?.sla_overdue_active ?? '—'}</strong>
          {summary?.sla_snoozed ? (
            <span className="text-amber-800/80">（暂缓 {summary.sla_snoozed}）</span>
          ) : null}
        </span>
        <span className="text-xs text-amber-800/80">已选 {selectedIds.length} 条</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onSelectAll}>
          全选本页
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onClearSelection}>
          清空
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          disabled={busy}
          onClick={() => void run('assign')}
        >
          <UserCheck className="mr-1 h-3 w-3" />
          认领给我
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          disabled={busy}
          onClick={() => void run('pending_human')}
        >
          <CheckSquare className="mr-1 h-3 w-3" />
          标待人工
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={busy}
          onClick={() => void run('snooze', { snooze_hours: 2 })}
        >
          <Clock className="mr-1 h-3 w-3" />
          暂缓 2h
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={busy}
          onClick={() => void run('snooze', { snooze_hours: 24 })}
        >
          暂缓 24h
        </Button>
        {canNotify ? (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => void notifySla()}>
            <Bell className="mr-1 h-3 w-3" />
            企微提醒
          </Button>
        ) : null}
      </div>
    </div>
  )
}
