/**
 * @file AI 审核台：待审回复、编辑后批准/驳回 + 运营指标。
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { approveAiReply, fetchAiOpsStats, fetchPendingAiReplies } from '@/api/aiEmployee'
import type { AiOpsStats, AiReplyLogRow } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const riskCls: Record<string, string> = {
  p0: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  p1: 'border-amber-200 bg-amber-50 text-amber-900',
  p2: 'border-red-200 bg-red-50 text-red-900',
}

export function AiReviewPage() {
  const [stats, setStats] = useState<AiOpsStats | null>(null)
  const [rows, setRows] = useState<AiReplyLogRow[]>([])
  const [edits, setEdits] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const [s, p] = await Promise.all([
        fetchAiOpsStats({ days: 7 }),
        fetchPendingAiReplies({ page: 1, size: 30, status: 'draft' }),
      ])
      setStats(s)
      setRows(p.list)
      const init: Record<number, string> = {}
      for (const r of p.list) init[r.id] = r.draft_content
      setEdits(init)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI 审核台</h1>
        <p className="text-sm text-muted-foreground">
          P0 可自动建议；P1 价格/优惠、P2 投诉/退款须人工审核后再发送。
        </p>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <CardTitle className="text-xs font-medium text-muted-foreground">已审核发送</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats.ai_replies_approved}</CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">待审核回复</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            刷新
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无待审草稿。在收件箱点击机器人图标可生成。</p>
          ) : null}
          {rows.map((r) => {
            const name =
              r.InboxThread?.Customer?.name ||
              r.InboxThread?.Customer?.nickname ||
              `会话 #${r.thread_id}`
            return (
              <div key={r.id} className="rounded-lg border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{name}</span>
                  <Badge variant="outline">{r.intent || 'general'}</Badge>
                  <span
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[10px] font-medium',
                      riskCls[r.risk_level] ?? riskCls.p1,
                    )}
                  >
                    {r.risk_level}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    置信度 {(Number(r.confidence) * 100).toFixed(0)}%
                  </span>
                </div>
                <textarea
                  className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={edits[r.id] ?? r.draft_content}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
                />
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
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
