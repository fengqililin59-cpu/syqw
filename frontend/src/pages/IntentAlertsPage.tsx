import { useEffect, useMemo, useState } from 'react'
import { listIntentAlerts, type IntentAlertItem } from '@/api/settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function fmtDate(d: Date) {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待发送' },
  { value: 'sent', label: '已发送' },
  { value: 'failed', label: '失败' },
]

function statusBadge(status: string) {
  if (status === 'pending') {
    return (
      <Badge className="border-amber-200 bg-amber-100 font-normal text-amber-900 hover:bg-amber-100">待发送</Badge>
    )
  }
  if (status === 'sent') {
    return (
      <Badge className="border-emerald-200 bg-emerald-100 font-normal text-emerald-900 hover:bg-emerald-100">已发送</Badge>
    )
  }
  if (status === 'failed') {
    return <Badge variant="destructive">失败</Badge>
  }
  return <Badge variant="secondary">{status}</Badge>
}

export function IntentAlertsPage() {
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(() => new Date(Date.now() - 29 * 24 * 60 * 60 * 1000), [])
  const [startDate, setStartDate] = useState(fmtDate(defaultStart))
  const [endDate, setEndDate] = useState(fmtDate(defaultEnd))
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [size] = useState(20)

  const [rows, setRows] = useState<IntentAlertItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  const totalPages = Math.max(1, Math.ceil(total / size))

  async function load(nextPage = page) {
    setLoading(true)
    setErr(null)
    try {
      const data = await listIntentAlerts({
        page: nextPage,
        size,
        status: status || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      setRows(data.list)
      setTotal(data.total)
      setPage(data.page)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleExpand(id: number) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">意向预警</h1>
        <p className="text-muted-foreground">客户意向分显著上涨时的预警记录与推送状态。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选条件</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-40 space-y-1">
            <p className="text-xs text-muted-foreground">开始日期</p>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="w-40 space-y-1">
            <p className="text-xs text-muted-foreground">结束日期</p>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="w-36 space-y-1">
            <p className="text-xs text-muted-foreground">状态</p>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => {
              setPage(1)
              void load(1)
            }}
            disabled={loading}
          >
            {loading ? '加载中…' : '查询'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">预警列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>预警时间</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>负责销售</TableHead>
                <TableHead>分值变化</TableHead>
                <TableHead>发送状态</TableHead>
                <TableHead>AI 话术</TableHead>
                <TableHead>发送时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const script = r.ai_script?.trim() || ''
                const preview = script.length > 30 ? `${script.slice(0, 30)}…` : script || '—'
                const isOpen = expanded[r.id]
                return (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell>{r.customer?.name || `#${r.customer?.id ?? ''}`}</TableCell>
                    <TableCell>{r.owner?.real_name || r.owner?.username || '—'}</TableCell>
                    <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">
                      {r.score_before} → {r.score_after} (+{r.score_delta})
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="max-w-[280px]">
                      {script ? (
                        <div className="space-y-1 text-sm">
                          <span className="whitespace-pre-wrap break-words">{isOpen ? script : preview}</span>
                          {script.length > 30 ? (
                            <button
                              type="button"
                              className="text-xs text-primary underline"
                              onClick={() => toggleExpand(r.id)}
                            >
                              {isOpen ? '收起' : '展开'}
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}</TableCell>
                  </TableRow>
                )
              })}
              {!loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              共 {total} 条，第 {page}/{totalPages} 页
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void load(page - 1)} disabled={loading || page <= 1}>
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void load(page + 1)}
                disabled={loading || page >= totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
