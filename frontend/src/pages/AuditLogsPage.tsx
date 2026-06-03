import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listAuditLogs, type AuditLogItem } from '@/api/settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function fmtDate(d: Date) {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const body = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const ACTIONS = [
  { value: '', label: '全部动作' },
  { value: 'customer_delete', label: '删客户' },
  { value: 'customer_export', label: '导出客户' },
  { value: 'broadcast_send', label: '广播发送' },
  { value: 'automation_rule_toggle', label: '规则启停' },
  { value: 'inbox_ai_auto_sent', label: 'AI 自动发送' },
  { value: 'inbox_ai_auto_send_skipped', label: 'AI 自动发送跳过' },
  { value: 'inbox_ai_qa_passed', label: 'AI 抽检通过' },
  { value: 'inbox_ai_qa_failed', label: 'AI 抽检有问题' },
  { value: 'platform_inbox_ai_disabled', label: '平台关停AI自动发' },
  { value: 'platform_inbox_ai_enabled', label: '平台恢复AI自动发' },
]

function renderDetail(detail: Record<string, unknown> | null) {
  if (!detail) return '-'
  try {
    const s = JSON.stringify(detail)
    return s.length > 120 ? `${s.slice(0, 117)}...` : s
  } catch {
    return '-'
  }
}

export function AuditLogsPage() {
  const [searchParams] = useSearchParams()
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(() => new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), [])
  const [startDate, setStartDate] = useState(fmtDate(defaultStart))
  const [endDate, setEndDate] = useState(fmtDate(defaultEnd))
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const [size] = useState(20)

  const [rows, setRows] = useState<AuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / size))

  function exportCsv() {
    const out = rows.map((r) => [
      new Date(r.created_at).toLocaleString(),
      r.action,
      r.target_type,
      r.target_id || '',
      r.actor?.real_name || r.actor?.username || '',
      r.actor_user_id || '',
      r.ip || '',
      r.user_agent || '',
      JSON.stringify(r.detail_json || {}),
    ])
    downloadCsv(
      `audit-logs-${startDate || 'all'}-to-${endDate || 'all'}-p${page}.csv`,
      ['时间', '动作', '对象类型', '对象ID', '操作人', '操作人ID', 'IP', 'UserAgent', '详情JSON'],
      out,
    )
  }

  async function load(nextPage = page) {
    setLoading(true)
    setErr(null)
    try {
      const data = await listAuditLogs({
        page: nextPage,
        size,
        action: action || undefined,
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
    const a = searchParams.get('action')
    if (a) setAction(a)
  }, [searchParams])

  useEffect(() => {
    void load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">审计日志</h1>
        <p className="text-muted-foreground">
          高危操作留痕：删客户、导出、广播、规则启停、AI 自动发送及跳过原因。
        </p>
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
          <div className="w-44 space-y-1">
            <p className="text-xs text-muted-foreground">动作</p>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              {ACTIONS.map((item) => (
                <option key={item.value} value={item.value}>
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
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">日志列表</CardTitle>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0 || loading}>
              导出 CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>动作</TableHead>
                <TableHead>对象</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.action}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.target_type}
                    {r.target_id ? `:${r.target_id}` : ''}
                  </TableCell>
                  <TableCell>{r.actor?.real_name || r.actor?.username || '-'}</TableCell>
                  <TableCell>{r.ip || '-'}</TableCell>
                  <TableCell className="max-w-[360px] truncate font-mono text-xs">{renderDetail(r.detail_json)}</TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
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
