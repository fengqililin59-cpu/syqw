/**
 * @file AI 运营看板：收件箱与 AI 回复核心指标。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAiOpsStats } from '@/api/aiEmployee'
import type { AiOpsStats } from '@/api/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function AiOpsPage() {
  const [stats, setStats] = useState<AiOpsStats | null>(null)
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const s = await fetchAiOpsStats({ days })
        if (!cancelled) {
          setStats(s)
          setErr(null)
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [days])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI 运营看板</h1>
          <p className="text-sm text-muted-foreground">统一收件箱 + AI 审核效果一览（近 {days} 天）</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <Button key={d} size="sm" variant={days === d ? 'default' : 'outline'} onClick={() => setDays(d)}>
              {d} 天
            </Button>
          ))}
        </div>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">加载中…</p> : null}

      {stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric title="进行中会话" value={stats.open_threads} />
            <Metric title="待人工处理" value={stats.pending_human_threads} highlight />
            <Metric
              title={`超时未回 (>${stats.sla_minutes ?? 30}分)`}
              value={stats.sla_overdue_threads ?? 0}
              highlight={(stats.sla_overdue_threads ?? 0) > 0}
            />
            <Metric title="周期内消息" value={stats.messages_in_period} />
            <Metric title="客户消息数" value={stats.customer_messages} />
            <Metric title="销售/AI 回复" value={stats.staff_or_ai_replies} />
            <Metric title="AI 草稿数" value={stats.ai_drafts_created} />
            <Metric title="审核已发送" value={stats.ai_replies_approved} />
            <Metric title="自动回复率 %" value={stats.auto_reply_rate_percent} />
            <Metric title="待办跟进" value={stats.open_followup_tasks} />
            <Metric
              title="待处理工单"
              value={stats.open_service_tickets ?? 0}
              highlight={(stats.open_service_tickets ?? 0) > 0}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SLA 提醒</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              在 <code className="rounded bg-muted px-1">backend/.env</code> 设置{' '}
              <code className="rounded bg-muted px-1">ENABLE_INBOX_SLA_CRON=1</code> 与可选{' '}
              <code className="rounded bg-muted px-1">INBOX_SLA_MINUTES=30</code>。客户最后一条消息后超时未回复，将向会话负责人（或客户
              归属销售）发送企微应用消息；同一条客户消息仅提醒一次。
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">快捷入口</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link to="/app/inbox">统一收件箱</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/app/ai-review">AI 审核台</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/knowledge-base">AI 知识库</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/service-desk">服务台</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function Metric({
  title,
  value,
  highlight,
}: {
  title: string
  value: number
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? 'border-amber-300 bg-amber-50/50' : undefined}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  )
}
