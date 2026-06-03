/**
 * @file AI 审核台：待审回复、自动已发质检、运营指标。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Download, ExternalLink, X } from 'lucide-react'
import { approveAiReply, fetchAiOpsStats, fetchPendingAiReplies, fetchAiQaQueue, submitAiQaReview } from '@/api/aiEmployee'
import type { AiOpsStats, AiReplyLogRow } from '@/api/types'
import { downloadCsv } from '@/lib/downloadCsv'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const riskCls: Record<string, string> = {
  p0: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  p1: 'border-amber-200 bg-amber-50 text-amber-900',
  p2: 'border-red-200 bg-red-50 text-red-900',
}

type ReviewTab = 'draft' | 'auto_sent' | 'qa'

function customerName(r: AiReplyLogRow) {
  return (
    r.InboxThread?.Customer?.name ||
    r.InboxThread?.Customer?.nickname ||
    `会话 #${r.thread_id}`
  )
}

function autoKindLabel(risk: string) {
  return risk === 'p1' ? 'AI询价' : 'AI自动'
}

export function AiReviewPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<ReviewTab>('draft')
  const [stats, setStats] = useState<AiOpsStats | null>(null)
  const [rows, setRows] = useState<AiReplyLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [edits, setEdits] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const [qaPending, setQaPending] = useState(0)

  useEffect(() => {
    if (searchParams.get('tab') === 'auto_sent') setTab('auto_sent')
    if (searchParams.get('tab') === 'qa') setTab('qa')
  }, [searchParams])

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const s = await fetchAiOpsStats({ days: 7 })
      setStats(s)
      if (tab === 'qa') {
        const p = await fetchAiQaQueue({ page: 1, size: 30, view: 'pending', days: 7 })
        setQaPending(p.pending_count)
        setRows(p.list)
        setTotal(p.total)
      } else {
        const p = await fetchPendingAiReplies({
          page: 1,
          size: 30,
          view: tab === 'auto_sent' ? 'auto_sent' : undefined,
          status: tab === 'draft' ? 'draft' : undefined,
          days: tab === 'auto_sent' ? 7 : undefined,
        })
        setRows(p.list)
        setTotal(p.total)
        if (tab === 'draft') {
          const init: Record<number, string> = {}
          for (const r of p.list) init[r.id] = r.draft_content
          setEdits(init)
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  async function act(logId: number, action: 'approve' | 'reject') {
    setBusyId(logId)
    try {
      await approveAiReply({
        log_id: logId,
        action,
        edited_content: action === 'approve' ? edits[logId] : undefined,
      })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  async function qaAct(logId: number, result: 'passed' | 'failed') {
    setBusyId(logId)
    try {
      await submitAiQaReview(logId, { result })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '抽检提交失败')
    } finally {
      setBusyId(null)
    }
  }

  async function exportAutoSentCsv() {
    setExporting(true)
    setErr(null)
    try {
      const p = await fetchPendingAiReplies({
        page: 1,
        size: 200,
        view: 'auto_sent',
        days: 7,
      })
      const header = ['时间', '客户', '会话ID', '意图', '风险', '置信度%', '类型', '发送内容']
      const lines = p.list.map((r) => [
        new Date(r.created_at).toLocaleString(),
        customerName(r),
        String(r.thread_id),
        r.intent || '',
        r.risk_level,
        String(Math.round(Number(r.confidence) * 100)),
        autoKindLabel(r.risk_level),
        (r.final_content || r.draft_content || '').replace(/\r?\n/g, ' '),
      ])
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(`ai-auto-sent-7d-${date}.csv`, [header, ...lines])
    } catch (e) {
      setErr(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI 审核台</h1>
        <p className="text-sm text-muted-foreground">
          P0 可自动建议；P1 价格/优惠、P2 投诉/退款须人工审核。开启自动发送后可在「自动已发」复盘。
        </p>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">进行中会话</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats.open_threads}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">待人工会话</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats.pending_human_threads}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">7 日 AI 草稿</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats.ai_drafts_created}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">7 日自动发送</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-violet-700">
              {stats.ai_replies_auto_sent ?? 0}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">涉及会话数</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats.threads_with_ai_auto_sent ?? 0}</CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">
              {tab === 'draft' ? '待审核回复' : tab === 'qa' ? '自动发送抽检（待处理）' : '自动已发（近 7 日）'}
            </CardTitle>
            {tab === 'qa' ? (
              <Badge variant="secondary" className="border-amber-300 bg-amber-50 text-amber-900">
                约 10% 随机入队
              </Badge>
            ) : null}
            {tab === 'auto_sent' && total > 0 ? (
              <Badge variant="secondary" className="border-violet-300 bg-violet-100 text-violet-900">
                {total} 条
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={tab === 'draft' ? 'default' : 'outline'}
              onClick={() => setTab('draft')}
            >
              待审核
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === 'auto_sent' ? 'default' : 'outline'}
              className={cn(tab !== 'auto_sent' && 'border-violet-300 text-violet-900')}
              onClick={() => setTab('auto_sent')}
            >
              自动已发
              {(stats?.ai_replies_auto_sent ?? 0) > 0 ? ` (${stats?.ai_replies_auto_sent})` : ''}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === 'qa' ? 'default' : 'outline'}
              onClick={() => setTab('qa')}
            >
              抽检队列
              {qaPending > 0 ? ` (${qaPending})` : ''}
            </Button>
            {tab === 'auto_sent' ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={exporting || loading}
                  className="gap-1"
                  onClick={() => void exportAutoSentCsv()}
                >
                  <Download className="h-3.5 w-3.5" />
                  导出 CSV
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/app/inbox?filter=ai_auto_sent">收件箱筛选</Link>
                </Button>
              </>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
            {!loading && rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tab === 'draft'
                  ? '暂无待审草稿。在收件箱点击机器人图标可生成。'
                  : tab === 'qa'
                    ? '暂无待抽检记录。自动发送后会按概率进入此队列。'
                    : '近 7 日暂无 AI 自动发送记录。请在系统设置开启 FAQ/询价自动发送，并配置 INBOX_AUTO_DRAFT。'}
              </p>
            ) : null}
            {rows.map((r) => {
              const name = customerName(r)
              const isAutoTab = tab === 'auto_sent'
              const isQaTab = tab === 'qa'
              const body = isAutoTab || isQaTab ? r.final_content || r.draft_content : edits[r.id] ?? r.draft_content
            return (
              <div key={r.id} className="rounded-lg border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{name}</span>
                  <Badge variant="outline">{r.intent || 'general'}</Badge>
                  {isAutoTab ? (
                    <Badge className="border-violet-300 bg-violet-100 text-violet-900 hover:bg-violet-100">
                      {autoKindLabel(r.risk_level)}
                    </Badge>
                  ) : (
                    <span
                      className={cn(
                        'rounded border px-1.5 py-0.5 text-[10px] font-medium',
                        riskCls[r.risk_level] ?? riskCls.p1,
                      )}
                    >
                      {r.risk_level}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    置信度 {(Number(r.confidence) * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                  <Button asChild size="sm" variant="ghost" className="ml-auto h-7 gap-1 px-2 text-xs">
                    <Link to={`/app/inbox?thread_id=${r.thread_id}`}>
                      查看会话
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
                {isAutoTab || isQaTab ? (
                  <p className="whitespace-pre-wrap rounded-md border bg-muted/30 px-3 py-2 text-sm">{body}</p>
                ) : (
                  <textarea
                    className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={body}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  />
                )}
                {!isAutoTab && !isQaTab ? (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => void act(r.id, 'approve')}
                      className="gap-1"
                    >
                      <Check className="h-3.5 w-3.5" />
                      批准并发送
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => void act(r.id, 'reject')}
                      className="gap-1"
                    >
                      <X className="h-3.5 w-3.5" />
                      驳回
                    </Button>
                  </div>
                ) : null}
                {isQaTab ? (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      disabled={busyId === r.id}
                      className="gap-1"
                      onClick={() => void qaAct(r.id, 'passed')}
                    >
                      <Check className="h-3.5 w-3.5" />
                      通过
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      className="gap-1"
                      onClick={() => void qaAct(r.id, 'failed')}
                    >
                      <X className="h-3.5 w-3.5" />
                      有问题
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
