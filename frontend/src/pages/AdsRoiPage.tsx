import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from 'recharts'
import { getJson, postJson } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type RoiRow = {
  platform: string
  clicks: number
  conversions: number
  reported: number
  conversion_value: number
  spend_cny: number
  cpa: number | null
  roas: number | null
  conversion_rate: number
  report_rate: number
}

type RoiTrendRow = {
  date: string
  clicks: number
  conversions: number
  reported: number
  spend_cny: number
}

type EventReportRow = {
  event_key: string
  count: number
}

const AD_EVENT_LABELS: Record<string, string> = {
  lead_submit: '留资提交',
  wework_add: '企微加好友',
  register: '注册',
  form: '表单',
  purchase: '付费',
}

type RoiDetailRow = {
  id: number
  platform: string
  event_type: string
  event_value: number
  report_status: string
  report_response: string
  click_key: string
  created_at: string
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
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

export function AdsRoiPage() {
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(() => new Date(Date.now() - 29 * 24 * 60 * 60 * 1000), [])
  const [startDate, setStartDate] = useState(fmtDate(defaultStart))
  const [endDate, setEndDate] = useState(fmtDate(defaultEnd))
  const [rows, setRows] = useState<RoiRow[]>([])
  const [trendRows, setTrendRows] = useState<RoiTrendRow[]>([])
  const [detailRows, setDetailRows] = useState<RoiDetailRow[]>([])
  const [platform, setPlatform] = useState('all')
  const [loading, setLoading] = useState(false)
  const [trendLoading, setTrendLoading] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [eventRows, setEventRows] = useState<EventReportRow[]>([])
  const [spendJson, setSpendJson] = useState(
    '[\n  {"stat_date":"2026-05-01","platform":"gdt","spend":1200}\n]',
  )
  const [spendMsg, setSpendMsg] = useState<string | null>(null)
  const [spendLoading, setSpendLoading] = useState(false)
  const [tencentGranularity, setTencentGranularity] = useState<'advertiser' | 'campaign'>('advertiser')
  const [tencentLoading, setTencentLoading] = useState(false)

  async function loadEvents(start = startDate, end = endDate) {
    try {
      const data = await getJson<EventReportRow[]>(`/track/events/report?start_date=${start}&end_date=${end}`)
      setEventRows(data)
    } catch {
      setEventRows([])
    }
  }

  async function onQuery() {
    setErr(null)
    setLoading(true)
    try {
      const data = await getJson<RoiRow[]>(`/ads/roi?start_date=${startDate}&end_date=${endDate}`)
      setRows(data)
      await loadTrend(platform, startDate, endDate)
      await loadDetails(platform, startDate, endDate)
      await loadEvents(startDate, endDate)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadTrend(p = platform, start = startDate, end = endDate) {
    setTrendLoading(true)
    try {
      const data = await getJson<RoiTrendRow[]>(`/ads/roi/trend?platform=${encodeURIComponent(p)}&start_date=${start}&end_date=${end}`)
      setTrendRows(data)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载趋势失败')
      setTrendRows([])
    } finally {
      setTrendLoading(false)
    }
  }

  async function loadDetails(p = platform, start = startDate, end = endDate) {
    setDetailsLoading(true)
    try {
      const data = await getJson<RoiDetailRow[]>(
        `/ads/roi/details?platform=${encodeURIComponent(p)}&start_date=${start}&end_date=${end}&limit=120`,
      )
      setDetailRows(data)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载明细失败')
      setDetailRows([])
    } finally {
      setDetailsLoading(false)
    }
  }

  useEffect(() => {
    void onQuery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exportSummaryCsv() {
    const out = rows.map((r) => [
      r.platform,
      r.clicks,
      r.conversions,
      r.reported,
      `${r.conversion_rate}%`,
      `${r.report_rate}%`,
      Number(r.conversion_value || 0).toFixed(2),
      Number(r.spend_cny || 0).toFixed(2),
      r.cpa != null ? r.cpa : '',
      r.roas != null ? r.roas : '',
    ])
    downloadCsv(
      `ads-roi-summary-${startDate}-to-${endDate}.csv`,
      ['平台', '点击', '转化', '已回传', '转化率', '回传率', '转化价值', '消耗(元)', 'CPA', 'ROAS'],
      out,
    )
  }

  function exportTrendCsv() {
    const out = trendRows.map((r) => [r.date, r.clicks, r.conversions, r.reported, Number(r.spend_cny || 0).toFixed(2)])
    downloadCsv(`ads-roi-trend-${platform}-${startDate}-to-${endDate}.csv`, ['日期', '点击', '转化', '已回传', '消耗(元)'], out)
  }

  function exportDetailsCsv() {
    const out = detailRows.map((r) => [
      r.id,
      r.platform,
      r.event_type,
      r.event_value,
      r.report_status,
      r.click_key,
      r.report_response,
      r.created_at,
    ])
    downloadCsv(
      `ads-roi-details-${platform}-${startDate}-to-${endDate}.csv`,
      ['ID', '平台', '事件', '价值', '回传状态', 'click_key', '回传响应摘要', '创建时间'],
      out,
    )
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.clicks += r.clicks
      acc.conversions += r.conversions
      acc.reported += r.reported
      acc.value += Number(r.conversion_value || 0)
      acc.spend += Number(r.spend_cny || 0)
      return acc
    },
    { clicks: 0, conversions: 0, reported: 0, value: 0, spend: 0 },
  )

  const blendedCpa = totals.conversions > 0 ? totals.spend / totals.conversions : null
  const blendedRoas = totals.spend > 0 ? totals.value / totals.spend : null

  async function onSyncTencentSpend() {
    setSpendMsg(null)
    setTencentLoading(true)
    try {
      const r = await postJson<{ upserted: number; row_count: number; granularity: string }>(
        '/ads/spend/sync/tencent',
        {
          start_date: startDate,
          end_date: endDate,
          granularity: tencentGranularity,
        },
      )
      setSpendMsg(`腾讯广告已同步 ${r.upserted} 条（报表行 ${r.row_count}，粒度 ${r.granularity}）`)
      await onQuery()
    } catch (e) {
      setSpendMsg(e instanceof Error ? e.message : '腾讯同步失败')
    } finally {
      setTencentLoading(false)
    }
  }

  async function onImportSpend() {
    setSpendMsg(null)
    setSpendLoading(true)
    try {
      const parsed = JSON.parse(spendJson) as unknown
      const items = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown }).items
      if (!Array.isArray(items)) {
        setSpendMsg('JSON 须为数组，或 { "items": [...] }')
        return
      }
      await postJson<{ upserted: number }>('/ads/spend/bulk', { items })
      setSpendMsg(`已导入 ${items.length} 条消耗记录`)
      await onQuery()
    } catch (e) {
      setSpendMsg(e instanceof Error ? e.message : '导入失败')
    } finally {
      setSpendLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">广告 ROI 分析</h1>
        <p className="text-muted-foreground">
          归因回传 + 投放成本导入 + 统一事件：支持 CPA / ROAS 与关键行为漏斗（P1）。
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
          <div className="w-40 space-y-1">
            <p className="text-xs text-muted-foreground">平台</p>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              <option value="all">全部</option>
              {rows.map((r) => (
                <option key={r.platform} value={r.platform}>
                  {r.platform}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => void onQuery()} disabled={loading}>
            {loading ? '加载中…' : '查询'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void loadTrend(platform, startDate, endDate)
              void loadDetails(platform, startDate, endDate)
            }}
            disabled={trendLoading}
          >
            {trendLoading ? '刷新趋势中…' : '刷新趋势'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">投放成本导入</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              POST /api/v1/ads/spend/bulk，单条字段：stat_date、platform、gdt|ocean|baidu、spend；可选 campaign_id / campaign_name。
            </p>
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
              <p className="text-xs text-muted-foreground">腾讯广告 API：</p>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={tencentGranularity}
                onChange={(e) => setTencentGranularity(e.target.value as 'advertiser' | 'campaign')}
              >
                <option value="advertiser">账户按日汇总</option>
                <option value="campaign">计划×日明细</option>
              </select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={tencentLoading || loading}
                onClick={() => void onSyncTencentSpend()}
              >
                {tencentLoading ? '同步中…' : '从腾讯广告同步消耗'}
              </Button>
            </div>
            <textarea
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              value={spendJson}
              onChange={(e) => setSpendJson(e.target.value)}
            />
            {spendMsg ? <p className="text-sm text-muted-foreground">{spendMsg}</p> : null}
            <Button type="button" size="sm" disabled={spendLoading} onClick={() => void onImportSpend()}>
              {spendLoading ? '导入中…' : '导入消耗'}
            </Button>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">关键事件（统一事件体系）</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>event_key</TableHead>
                  <TableHead className="text-right">次数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventRows.map((r) => (
                  <TableRow key={r.event_key}>
                    <TableCell className="font-mono text-xs">{r.event_key}</TableCell>
                    <TableCell className="text-right">{r.count}</TableCell>
                  </TableRow>
                ))}
                {eventRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      暂无事件（注册/登录/广告落地后会逐步累积）
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">总点击</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totals.clicks}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">总转化</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totals.conversions}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">已回传</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totals.reported}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">转化价值</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totals.value.toFixed(2)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">总消耗</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totals.spend.toFixed(2)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">综合 CPA / ROAS</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">{blendedCpa != null ? blendedCpa.toFixed(2) : '—'} <span className="text-sm font-normal text-muted-foreground">/</span> {blendedRoas != null ? blendedRoas.toFixed(3) : '—'}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">平台对比</CardTitle>
            <Button variant="outline" size="sm" onClick={exportSummaryCsv} disabled={rows.length === 0}>
              导出汇总 CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-[320px]">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="clicks" name="点击" fill="#60a5fa" />
                <Bar dataKey="conversions" name="转化" fill="#22c55e" />
                <Bar dataKey="reported" name="已回传" fill="#f59e0b" />
                <Bar dataKey="spend_cny" name="消耗" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">日趋势（{platform === 'all' ? '全部平台' : platform}）</CardTitle>
            <Button variant="outline" size="sm" onClick={exportTrendCsv} disabled={trendRows.length === 0}>
              导出趋势 CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-[320px]">
          {trendRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{trendLoading ? '加载中…' : '暂无数据'}</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="clicks" name="点击" stroke="#60a5fa" strokeWidth={2} dot />
                <Line yAxisId="left" type="monotone" dataKey="conversions" name="转化" stroke="#22c55e" strokeWidth={2} dot />
                <Line yAxisId="left" type="monotone" dataKey="reported" name="已回传" stroke="#f59e0b" strokeWidth={2} dot />
                <Line yAxisId="right" type="monotone" dataKey="spend_cny" name="消耗(元)" stroke="#a78bfa" strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">明细表</CardTitle>
        </CardHeader>
        <CardContent>
          {err ? <p className="mb-3 text-sm text-destructive">{err}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>平台</TableHead>
                <TableHead className="text-right">点击</TableHead>
                <TableHead className="text-right">转化</TableHead>
                <TableHead className="text-right">已回传</TableHead>
                <TableHead className="text-right">转化率</TableHead>
                <TableHead className="text-right">回传率</TableHead>
                <TableHead className="text-right">价值</TableHead>
                <TableHead className="text-right">消耗</TableHead>
                <TableHead className="text-right">CPA</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.platform}
                  className={platform === r.platform ? 'bg-muted/50' : ''}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setPlatform(r.platform)
                    void loadTrend(r.platform, startDate, endDate)
                    void loadDetails(r.platform, startDate, endDate)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setPlatform(r.platform)
                      void loadTrend(r.platform, startDate, endDate)
                      void loadDetails(r.platform, startDate, endDate)
                    }
                  }}
                >
                  <TableCell>{r.platform}</TableCell>
                  <TableCell className="text-right">{r.clicks}</TableCell>
                  <TableCell className="text-right">{r.conversions}</TableCell>
                  <TableCell className="text-right">{r.reported}</TableCell>
                  <TableCell className="text-right">{r.conversion_rate}%</TableCell>
                  <TableCell className="text-right">{r.report_rate}%</TableCell>
                  <TableCell className="text-right">{Number(r.conversion_value || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(r.spend_cny || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{r.cpa != null ? r.cpa.toFixed(2) : '—'}</TableCell>
                  <TableCell className="text-right">{r.roas != null ? r.roas.toFixed(3) : '—'}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
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
            <CardTitle className="text-base">转化事件明细（{platform === 'all' ? '全部平台' : platform}）</CardTitle>
            <Button variant="outline" size="sm" onClick={exportDetailsCsv} disabled={detailRows.length === 0 || detailsLoading}>
              导出明细 CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>事件</TableHead>
                <TableHead className="text-right">价值</TableHead>
                <TableHead>回传状态</TableHead>
                <TableHead>click_key</TableHead>
                <TableHead>回传响应摘要</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{AD_EVENT_LABELS[r.event_type] ?? r.event_type}</TableCell>
                  <TableCell className="text-right">{r.event_value}</TableCell>
                  <TableCell>{r.report_status}</TableCell>
                  <TableCell className="max-w-[160px] truncate font-mono text-xs">{r.click_key}</TableCell>
                  <TableCell className="max-w-[300px] truncate">{r.report_response || '-'}</TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {!detailsLoading && detailRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    暂无转化事件
                  </TableCell>
                </TableRow>
              ) : null}
              {detailsLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
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
