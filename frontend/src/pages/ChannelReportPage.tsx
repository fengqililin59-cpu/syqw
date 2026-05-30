import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJson } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ChannelRow = {
  source: string
  visit_count: number
  session_count: number
  user_count: number
  session_to_user_rate: number
}

type FunnelBySourceRow = {
  source: string
  visits: number
  landing_view: number
  lead_form_view: number
  lead_submit: number
  landing_cta_click: number
  landing_lead_click: number
  customers_created: number
  customers_existing: number
  lead_rate_percent: number | null
}

type RecentLeadRow = {
  event_id: number
  submitted_at: string
  customer_id: number | null
  customer_name: string | null
  phone: string | null
  source_label: string | null
  utm_source: string
  is_new: boolean
  stage: string | null
}

type FunnelReport = {
  summary: {
    landing_view: number
    lead_form_view: number
    lead_submit: number
    customers_created: number
    customers_existing: number
    lead_to_customer_percent: number | null
    landing_to_lead_percent: number | null
    form_to_submit_percent: number | null
    funnel_steps: Array<{ key: string; label: string; count: number }>
  }
  by_source: FunnelBySourceRow[]
  recent_leads: RecentLeadRow[]
}

type ChannelDetailRow = {
  id: number
  session_id: string
  source: string
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  landing_path: string | null
  referrer: string | null
  first_visit_at: string | null
  attributed_at: string | null
  user: {
    id: number
    tenant_id: number
    username: string
    real_name: string | null
  } | null
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

function fmtDate(d: Date) {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function ChannelReportPage() {
  const navigate = useNavigate()
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(() => new Date(Date.now() - 29 * 24 * 60 * 60 * 1000), [])
  const [startDate, setStartDate] = useState(fmtDate(defaultStart))
  const [endDate, setEndDate] = useState(fmtDate(defaultEnd))
  const [rows, setRows] = useState<ChannelRow[]>([])
  const [funnel, setFunnel] = useState<FunnelReport | null>(null)
  const [activeSource, setActiveSource] = useState<string>('')
  const [detailRows, setDetailRows] = useState<ChannelDetailRow[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onQuery() {
    setErr(null)
    setLoading(true)
    try {
      const reportPromise = getJson<ChannelRow[]>(
        `/track/report?start_date=${startDate}&end_date=${endDate}`,
      )
      const funnelPromise = getJson<FunnelReport>(
        `/track/events/funnel?start_date=${startDate}&end_date=${endDate}`,
      ).catch(() => null)
      const [data, funnelData] = await Promise.all([reportPromise, funnelPromise])
      setRows(data)
      setFunnel(funnelData)
      const initialSource = data[0]?.source || ''
      setActiveSource(initialSource)
      if (initialSource) {
        await loadDetails(initialSource, startDate, endDate)
      } else {
        setDetailRows([])
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadDetails(source: string, start = startDate, end = endDate) {
    setDetailsLoading(true)
    try {
      const q = new URLSearchParams({
        source,
        start_date: start,
        end_date: end,
        limit: '50',
      })
      const data = await getJson<ChannelDetailRow[]>(`/track/report/details?${q.toString()}`)
      setDetailRows(data)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载详情失败')
      setDetailRows([])
    } finally {
      setDetailsLoading(false)
    }
  }

  useEffect(() => {
    void onQuery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exportFunnelCsv() {
    if (!funnel?.by_source?.length) return
    const rowsOut = funnel.by_source.map((r) => [
      r.source,
      r.visits,
      r.landing_view,
      r.lead_form_view,
      r.lead_submit,
      r.customers_created,
      r.lead_rate_percent != null ? `${r.lead_rate_percent}%` : '',
    ])
    downloadCsv(
      `acquisition-funnel-${startDate}-to-${endDate}.csv`,
      ['渠道', '访问(PV)', '落地页浏览', '留资页浏览', '留资提交', '新建客户', '留资转化率'],
      rowsOut,
    )
  }

  function exportSummaryCsv() {
    const rowsOut = rows.map((r) => [r.source, r.visit_count, r.session_count, r.user_count, `${r.session_to_user_rate}%`])
    downloadCsv(
      `channel-summary-${startDate}-to-${endDate}.csv`,
      ['渠道', '访问数(PV)', '会话数(UV)', '归因用户数', '会话转化率'],
      rowsOut,
    )
  }

  function exportDetailsCsv() {
    const rowsOut = detailRows.map((r) => [
      r.source,
      r.user?.real_name || r.user?.username || '',
      r.user?.username || '',
      r.session_id,
      r.utm_medium || '',
      r.utm_campaign || '',
      r.utm_content || '',
      r.utm_term || '',
      r.landing_path || '',
      r.referrer || '',
      r.first_visit_at || '',
      r.attributed_at || '',
    ])
    downloadCsv(
      `channel-details-${activeSource || 'all'}-${startDate}-to-${endDate}.csv`,
      ['渠道', '姓名', '账号', '会话ID', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', '落地页', '来源页', '首次访问', '归因时间'],
      rowsOut,
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">渠道分析</h1>
        <p className="text-muted-foreground">按 utm_source 查看访问、会话、归因用户与落地页留资漏斗。</p>
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
          <Button onClick={() => void onQuery()} disabled={loading}>
            {loading ? '加载中…' : '查询'}
          </Button>
        </CardContent>
      </Card>
      {funnel?.summary ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">获客漏斗（落地页 → 留资）</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={exportFunnelCsv}
                disabled={!funnel.by_source?.length}
              >
                导出漏斗 CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">落地页浏览</p>
                <p className="text-2xl font-semibold">{funnel.summary.landing_view}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">留资页浏览</p>
                <p className="text-2xl font-semibold">{funnel.summary.lead_form_view}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">留资提交</p>
                <p className="text-2xl font-semibold">{funnel.summary.lead_submit}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">新建客户</p>
                <p className="text-2xl font-semibold">{funnel.summary.customers_created}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">留资→建客</p>
                <p className="text-2xl font-semibold">
                  {funnel.summary.lead_to_customer_percent != null
                    ? `${funnel.summary.lead_to_customer_percent}%`
                    : '—'}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">落地→留资</p>
                <p className="text-2xl font-semibold">
                  {funnel.summary.landing_to_lead_percent != null
                    ? `${funnel.summary.landing_to_lead_percent}%`
                    : '—'}
                </p>
              </div>
            </div>
            {funnel.summary.customers_existing > 0 ? (
              <p className="text-sm text-muted-foreground">
                另有 {funnel.summary.customers_existing} 条留资命中已有客户（手机号重复，未新建）。
              </p>
            ) : null}
            {funnel.summary.funnel_steps.length > 0 ? (
              <div className="space-y-2">
                {funnel.summary.funnel_steps.map((step, i) => {
                  const max = Math.max(...funnel.summary.funnel_steps.map((s) => s.count), 1)
                  const pct = Math.round((step.count / max) * 100)
                  return (
                    <div key={step.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {i + 1}. {step.label}
                        </span>
                        <span className="text-muted-foreground">{step.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                暂无埋点数据。可在落地页带 utm 参数访问，或引导用户打开留资页。
              </p>
            )}
            {funnel.by_source.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>渠道</TableHead>
                    <TableHead className="text-right">访问</TableHead>
                    <TableHead className="text-right">落地页</TableHead>
                    <TableHead className="text-right">留资页</TableHead>
                    <TableHead className="text-right">提交</TableHead>
                    <TableHead className="text-right">新建客户</TableHead>
                    <TableHead className="text-right">转化率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funnel.by_source.map((r) => (
                    <TableRow key={`funnel-${r.source}`}>
                      <TableCell>{r.source}</TableCell>
                      <TableCell className="text-right">{r.visits}</TableCell>
                      <TableCell className="text-right">{r.landing_view}</TableCell>
                      <TableCell className="text-right">{r.lead_form_view}</TableCell>
                      <TableCell className="text-right">{r.lead_submit}</TableCell>
                      <TableCell className="text-right">{r.customers_created}</TableCell>
                      <TableCell className="text-right">
                        {r.lead_rate_percent != null ? `${r.lead_rate_percent}%` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            {funnel.recent_leads?.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">最近留资（已关联客户）</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>客户</TableHead>
                      <TableHead>渠道</TableHead>
                      <TableHead>来源</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>提交时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funnel.recent_leads.map((r) => (
                      <TableRow key={r.event_id}>
                        <TableCell>
                          {r.customer_id ? (
                            <button
                              type="button"
                              className="text-left text-primary underline-offset-4 hover:underline"
                              onClick={() => navigate(`/app/customers/${r.customer_id}`)}
                            >
                              {r.customer_name || r.phone || `#${r.customer_id}`}
                            </button>
                          ) : (
                            r.phone || '—'
                          )}
                        </TableCell>
                        <TableCell>{r.utm_source}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.source_label || '—'}</TableCell>
                        <TableCell>{r.is_new ? '新建' : '已有客户'}</TableCell>
                        <TableCell>
                          {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">渠道报表</CardTitle>
            <Button variant="outline" size="sm" onClick={exportSummaryCsv} disabled={rows.length === 0}>
              导出汇总 CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {err ? <p className="mb-3 text-sm text-destructive">{err}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>渠道</TableHead>
                <TableHead className="text-right">访问数(PV)</TableHead>
                <TableHead className="text-right">会话数(UV)</TableHead>
                <TableHead className="text-right">归因用户数</TableHead>
                <TableHead className="text-right">会话转化率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.source}
                  className={r.source === activeSource ? 'bg-muted/60' : ''}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setActiveSource(r.source)
                    void loadDetails(r.source)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setActiveSource(r.source)
                      void loadDetails(r.source)
                    }
                  }}
                >
                  <TableCell>{r.source}</TableCell>
                  <TableCell className="text-right">{r.visit_count}</TableCell>
                  <TableCell className="text-right">{r.session_count}</TableCell>
                  <TableCell className="text-right">{r.user_count}</TableCell>
                  <TableCell className="text-right">{r.session_to_user_rate}%</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">来源详情{activeSource ? ` · ${activeSource}` : ''}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={exportDetailsCsv}
              disabled={detailRows.length === 0 || detailsLoading}
            >
              导出详情 CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>会话ID</TableHead>
                <TableHead>活动</TableHead>
                <TableHead>落地页</TableHead>
                <TableHead>首次访问</TableHead>
                <TableHead>归因时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.user?.real_name || r.user?.username || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{r.session_id}</TableCell>
                  <TableCell>{r.utm_campaign || '-'}</TableCell>
                  <TableCell className="max-w-[280px] truncate">{r.landing_path || '-'}</TableCell>
                  <TableCell>{r.first_visit_at ? new Date(r.first_visit_at).toLocaleString() : '-'}</TableCell>
                  <TableCell>{r.attributed_at ? new Date(r.attributed_at).toLocaleString() : '-'}</TableCell>
                </TableRow>
              ))}
              {!detailsLoading && detailRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    暂无详情数据
                  </TableCell>
                </TableRow>
              ) : null}
              {detailsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    加载中…
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
