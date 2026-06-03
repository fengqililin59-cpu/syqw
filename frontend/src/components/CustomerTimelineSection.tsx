/**
 * @file 客户详情：全渠道时间线（摘要 + 筛选 + 事件列表）。
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export type TimelineItem = {
  id: string
  type:
    | 'follow_up'
    | 'wework_message'
    | 'inbox_message'
    | 'ticket'
    | 'order'
    | 'call'
    | 'sms'
    | 'stage_change'
    | 'ai'
    | 'intent_alert'
    | 'customer_created'
  at: string
  title: string
  summary: string
  meta?: {
    ticket_id?: number
    thread_id?: number
    follow_up_id?: number
    author?: string
    from_stage?: string
    to_stage?: string
  }
}

export type TimelineSummary = {
  last_touch_at: string | null
  days_since_touch: number | null
  counts: Record<string, number>
  total_events: number
  current_stage?: string
}

const timelineTypeLabels: Record<TimelineItem['type'], string> = {
  follow_up: '跟进',
  wework_message: '企微',
  inbox_message: '收件箱',
  ticket: '工单',
  order: '订单',
  call: '通话',
  sms: '短信',
  stage_change: '阶段',
  ai: 'AI',
  intent_alert: '意向',
  customer_created: '建档',
}

const timelineTypeColors: Record<TimelineItem['type'], string> = {
  follow_up: 'bg-emerald-100 text-emerald-700',
  wework_message: 'bg-green-100 text-green-700',
  inbox_message: 'bg-blue-100 text-blue-700',
  ticket: 'bg-amber-100 text-amber-700',
  order: 'bg-purple-100 text-purple-700',
  call: 'bg-orange-100 text-orange-700',
  sms: 'bg-slate-100 text-slate-700',
  stage_change: 'bg-indigo-100 text-indigo-700',
  ai: 'bg-violet-100 text-violet-700',
  intent_alert: 'bg-rose-100 text-rose-700',
  customer_created: 'bg-sky-100 text-sky-700',
}

const FILTER_OPTIONS: { key: string; label: string; types?: TimelineItem['type'][] }[] = [
  { key: 'all', label: '全部' },
  { key: 'follow_up', label: '跟进', types: ['follow_up'] },
  { key: 'message', label: '消息', types: ['wework_message', 'inbox_message', 'sms'] },
  { key: 'stage_change', label: '阶段', types: ['stage_change', 'customer_created'] },
  { key: 'ai', label: 'AI', types: ['ai', 'intent_alert'] },
  { key: 'deal', label: '成交', types: ['order', 'ticket', 'call'] },
]

function fmtDt(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
}

export function CustomerTimelineSection({
  items,
  summary,
  loading,
  customerId,
}: {
  items: TimelineItem[]
  summary: TimelineSummary | null
  loading: boolean
  customerId: string
}) {
  const [filterKey, setFilterKey] = useState('all')

  const filtered = useMemo(() => {
    const opt = FILTER_OPTIONS.find((f) => f.key === filterKey)
    if (!opt?.types) return items
    return items.filter((it) => opt.types!.includes(it.type))
  }, [items, filterKey])

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">加载中...</p>
  }

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Clock className="h-4 w-4 text-slate-500" />
                互动摘要
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                最近触达：{fmtDt(summary.last_touch_at)}
                {summary.days_since_touch != null ? (
                  <span>
                    {' '}
                    · {summary.days_since_touch === 0 ? '今天有互动' : `${summary.days_since_touch} 天前`}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                共 {summary.total_events} 条事件（跟进 {summary.counts.follow_up || 0} · 企微{' '}
                {summary.counts.wework_message || 0} · AI {summary.counts.ai || 0}）
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/app/ai-assistant?customer_id=${customerId}`}>AI 写跟进</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilterKey(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterKey === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? '暂无互动记录（跟进、企微、收件箱、工单、订单、通话、短信、阶段与 AI 将聚合展示）'
            : '当前筛选下暂无记录'}
        </p>
      ) : (
        <div className="relative space-y-0 pl-5">
          <div className="absolute bottom-2 left-2 top-2 w-px bg-border" />
          {filtered.map((item) => (
            <div key={item.id} className="relative pb-5">
              <div className="absolute -left-3 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
              <div className="rounded-xl border bg-card p-3.5 shadow-sm">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={timelineTypeColors[item.type]}>{timelineTypeLabels[item.type]}</Badge>
                    <span className="text-sm font-medium">{item.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{fmtDt(item.at)}</span>
                </div>
                {item.summary ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
                ) : null}
                {item.meta?.author ? (
                  <p className="mt-1 text-xs text-muted-foreground">操作人：{item.meta.author}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.meta?.ticket_id ? (
                    <Link
                      to={`/app/service-desk/tickets/${item.meta.ticket_id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      查看工单
                    </Link>
                  ) : null}
                  {item.meta?.thread_id ? (
                    <Link to="/app/inbox" className="text-xs text-primary hover:underline">
                      打开收件箱
                    </Link>
                  ) : null}
                  {item.type === 'ai' ? (
                    <Link
                      to={`/app/customers/${customerId}`}
                      className="text-xs text-primary hover:underline"
                      onClick={(e) => {
                        e.preventDefault()
                        document.getElementById('customer-ai-panel')?.scrollIntoView({ behavior: 'smooth' })
                      }}
                    >
                      去 AI 话术
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
