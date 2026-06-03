/**
 * @file AI 运营看板：收件箱与 AI 回复核心指标。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAiOpsStats, pushAiAutoReplyDigest } from '@/api/aiEmployee'
import type { AiOpsStats } from '@/api/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'

export function AiOpsPage() {
  const [stats, setStats] = useState<AiOpsStats | null>(null)
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const hasPerm = useAuthStore((s) => s.hasPerm)
  const canPushDigest = hasPerm('ai:approve')

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

      {pushMsg ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {pushMsg}
        </p>
      ) : null}

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
            <Metric title="AI 自动发送" value={stats.ai_replies_auto_sent ?? 0} />
            <Metric title="自动涉及会话" value={stats.threads_with_ai_auto_sent ?? 0} />
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
              <CardTitle className="text-base">自动草稿 + 延迟发送</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              设置 <code className="rounded bg-muted px-1">INBOX_AUTO_DRAFT=1</code> 后，客户新消息默认{' '}
              <strong className="font-medium text-foreground">30 秒</strong>内若销售未回复，则自动生成 AI
              草稿并尝试 FAQ/询价自动发送（需在系统设置开启，<strong className="font-medium text-foreground">仅企微会话</strong>
              ）。默认每租户每日 80 条、每会话 3 条。可选{' '}
              <code className="rounded bg-muted px-1">INBOX_AI_RISK_LLM=1</code> 启用 LLM 结构化风控（消耗 AI 配额）。
              <code className="rounded bg-muted px-1">INBOX_AUTO_DRAFT_DELAY_SEC=0</code> 改为立即。
            </CardContent>
          </Card>

          {stats.auto_send_usage_today ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">今日自动发送配额</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                今日已自动发送{' '}
                <strong className="text-foreground">{stats.auto_send_usage_today.daily_count}</strong>
                {stats.auto_send_usage_today.daily_cap > 0
                  ? ` / ${stats.auto_send_usage_today.daily_cap}（租户日上限）`
                  : '（未设日上限）'}
                ；每企微会话每日上限 {stats.auto_send_usage_today.thread_cap || '不限'}。公域渠道不会自动发送。
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">每日 AI 自动回复摘要（企微 18:00）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                运维在 <code className="rounded bg-muted px-1">backend/.env</code> 开启{' '}
                <code className="rounded bg-muted px-1">ENABLE_AI_AUTO_REPLY_DIGEST_CRON=1</code>
                后，每日 18:00 向租户管理员推送当日 AI 自动发送条数与质检链接（仅当日有自动发送时）。
              </p>
              {canPushDigest ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pushBusy}
                  onClick={() => {
                    setPushBusy(true)
                    setPushMsg(null)
                    void pushAiAutoReplyDigest()
                      .then((r) => {
                        if (r.sent > 0) {
                          setPushMsg(
                            `已推送给 ${r.sent} 位管理员（今日自动发送 ${r.auto_sent_count ?? 0} 条）`,
                          )
                        } else {
                          setPushMsg(
                            r.skipped === 'no_auto_sent_today'
                              ? '今日暂无自动发送记录；试发仍已推送说明消息（若已配置企微）'
                              : `未发送：${r.skipped || '请确认企微与管理员 wework_userid'}`,
                          )
                        }
                      })
                      .catch((e) => setErr(e instanceof Error ? e.message : '推送失败'))
                      .finally(() => setPushBusy(false))
                  }}
                >
                  试发今日摘要到企微
                </Button>
              ) : null}
            </CardContent>
          </Card>

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
              {(stats?.ai_replies_auto_sent ?? 0) > 0 ? (
                <Button asChild variant="outline" className="border-violet-300 text-violet-900">
                  <Link to="/app/ai-review?tab=auto_sent">自动已发质检</Link>
                </Button>
              ) : null}
              {(stats?.ai_replies_auto_sent ?? 0) > 0 ? (
                <Button asChild variant="outline" className="border-violet-300 text-violet-900">
                  <Link to="/app/inbox?filter=ai_auto_sent">AI 自动回复会话</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/app/audit-logs?action=inbox_ai_auto_sent">审计：自动发送</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/audit-logs?action=inbox_ai_qa_failed">审计：抽检问题</Link>
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
