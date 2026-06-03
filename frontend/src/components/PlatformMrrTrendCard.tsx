/**
 * @file 平台概览 · MRR / 收款趋势图（总量 + 按套餐拆分 + MRR 快照曲线）。
 */
import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
} from 'recharts'
import { getJson, postJson } from '@/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type PlanSeries = { code: string; name: string }

type MrrTrend = {
  current_mrr: number
  range_paid_total: number
  range_paid_count: number
  plan_series: PlanSeries[]
  mrr_by_plan: { code: string; name: string; mrr: number }[]
  has_mrr_snapshots?: boolean
  latest_mrr_snapshot?: {
    snapshot_month: string
    mrr_total: number
    captured_at: string
  } | null
  months: Array<{
    label: string
    month_key: string
    paid_amount: number
    paid_count: number
    new_tenants: number
    mrr_snapshot?: number | null
    active_subscriptions?: number | null
    [key: string]: string | number | null | undefined
  }>
}

const PLAN_COLORS: Record<string, string> = {
  pro: '#0369a1',
  enterprise: '#7c3aed',
  ai_pro: '#059669',
  ai_enterprise: '#0d9488',
  free: '#94a3b8',
  unknown: '#cbd5e1',
}

function planColor(code: string) {
  return PLAN_COLORS[code] || '#64748b'
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-slate-700">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold">
            {p.dataKey === 'new_tenants' || p.dataKey === 'paid_count' || p.dataKey === 'active_subscriptions'
              ? p.value
              : `¥${Number(p.value).toLocaleString('zh-CN')}`}
          </span>
        </div>
      ))}
    </div>
  )
}

export function PlatformMrrTrendCard() {
  const [trend, setTrend] = useState<MrrTrend | null>(null)
  const [months, setMonths] = useState(12)
  const [view, setView] = useState<'total' | 'plan' | 'mrr'>('total')
  const [snapshotBusy, setSnapshotBusy] = useState(false)
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null)

  function loadTrend() {
    void getJson<MrrTrend>(`/platform/mrr-trend?months=${months}`)
      .then((data) => {
        setTrend({
          ...data,
          plan_series: data.plan_series || [],
          mrr_by_plan: data.mrr_by_plan || [],
        })
      })
      .catch(() => setTrend(null))
  }

  useEffect(() => {
    loadTrend()
  }, [months])

  const empty =
    !trend?.months.length ||
    trend.months.every(
      (m) =>
        m.paid_amount === 0 &&
        m.new_tenants === 0 &&
        (m.mrr_snapshot == null || m.mrr_snapshot === 0),
    )

  const planSeries = trend?.plan_series ?? []
  const hasMrrLine = Boolean(trend?.has_mrr_snapshots)

  const snapshotMomLabel = (() => {
    const rows = (trend?.months ?? []).filter((m) => m.mrr_snapshot != null && m.mrr_snapshot > 0)
    if (rows.length < 2) return null
    const prev = Number(rows[rows.length - 2].mrr_snapshot)
    const cur = Number(rows[rows.length - 1].mrr_snapshot)
    if (!prev) return null
    const pct = Math.round(((cur - prev) / prev) * 10000) / 100
    if (pct > 0) return `快照环比 +${pct}%`
    if (pct < 0) return `快照环比 ${pct}%`
    return '快照环比持平'
  })()

  async function captureSnapshot() {
    setSnapshotBusy(true)
    setSnapshotMsg(null)
    try {
      const r = await postJson<{ snapshot_month: string; mrr_total: number }>(
        '/platform/mrr-snapshots/capture',
        {},
      )
      setSnapshotMsg(`已保存 ${r.snapshot_month} 快照 MRR ¥${r.mrr_total.toLocaleString('zh-CN')}`)
      loadTrend()
    } catch (e: unknown) {
      setSnapshotMsg(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSnapshotBusy(false)
    }
  }

  async function backfillSnapshots() {
    setSnapshotBusy(true)
    setSnapshotMsg(null)
    try {
      const r = await postJson<{ created: number; skipped: number }>(
        '/platform/mrr-snapshots/backfill',
        { months },
      )
      setSnapshotMsg(`补录 ${r.created} 个月，跳过已有 ${r.skipped} 个月`)
      loadTrend()
    } catch (e: unknown) {
      setSnapshotMsg(e instanceof Error ? e.message : '补录失败')
    } finally {
      setSnapshotBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">收款与增长趋势</CardTitle>
          <CardDescription>
            按月已支付订单（现金口径）；当前估算 MRR ¥
            {trend?.current_mrr.toLocaleString('zh-CN') ?? '—'} / 月
            {trend?.latest_mrr_snapshot ? (
              <span className="ml-1">
                · 最近快照 {trend.latest_mrr_snapshot.snapshot_month} ¥
                {trend.latest_mrr_snapshot.mrr_total.toLocaleString('zh-CN')}
                {snapshotMomLabel ? ` · ${snapshotMomLabel}` : ''}
              </span>
            ) : null}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5 text-xs">
            <button
              type="button"
              className={`rounded px-2 py-1 ${view === 'total' ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setView('total')}
            >
              总收款
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 ${view === 'plan' ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setView('plan')}
              disabled={planSeries.length === 0}
            >
              按套餐
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 ${view === 'mrr' ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setView('mrr')}
            >
              MRR 快照
            </button>
          </div>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            <option value={6}>近 6 个月</option>
            <option value={12}>近 12 个月</option>
            <option value={18}>近 18 个月</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {trend?.mrr_by_plan?.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {trend.mrr_by_plan.map((p) => (
              <Badge key={p.code} variant="secondary" className="text-xs font-normal">
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full"
                  style={{ background: planColor(p.code) }}
                />
                {p.name} MRR ¥{p.mrr.toLocaleString('zh-CN')}
              </Badge>
            ))}
          </div>
        ) : null}

        {view === 'mrr' ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={snapshotBusy} onClick={() => void captureSnapshot()}>
              立即快照当月
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={snapshotBusy} onClick={() => void backfillSnapshots()}>
              补录缺失月份
            </Button>
            {!hasMrrLine ? (
              <span className="text-xs text-muted-foreground">
                尚无历史快照；可手动补录或开启 ENABLE_PLATFORM_MRR_SNAPSHOT_CRON=1
              </span>
            ) : null}
            {snapshotMsg ? <span className="text-xs text-violet-800">{snapshotMsg}</span> : null}
          </div>
        ) : null}

        {trend ? (
          <p className="mb-3 text-xs text-muted-foreground">
            区间内收款 ¥{trend.range_paid_total.toLocaleString('zh-CN')}（{trend.range_paid_count} 笔）·
            新注册 {trend.months.reduce((s, m) => s + m.new_tenants, 0)} 家企业
            {hasMrrLine ? ' · MRR 曲线来自每日快照落库' : ''}
          </p>
        ) : null}
        {empty ? (
          <p className="py-12 text-center text-sm text-muted-foreground">该时间范围内暂无收款数据</p>
        ) : view === 'mrr' ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend?.months ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (v >= 10000 ? `${v / 10000}万` : String(v))}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="mrr_snapshot"
                  name="MRR 快照(元/月)"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="paid_amount"
                  name="月收款(元)"
                  stroke="#0369a1"
                  fill="#0ea5e922"
                  strokeWidth={1.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : view === 'plan' && planSeries.length > 0 ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend?.months ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 10000 ? `${v / 10000}万` : String(v))} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {planSeries.map((pl) => (
                  <Bar
                    key={pl.code}
                    dataKey={pl.code}
                    name={pl.name}
                    stackId="paid"
                    fill={planColor(pl.code)}
                    barSize={28}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend?.months ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="amount"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (v >= 10000 ? `${v / 10000}万` : String(v))}
                />
                <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  yAxisId="amount"
                  type="monotone"
                  dataKey="paid_amount"
                  name="月收款(元)"
                  stroke="#0369a1"
                  fill="#0ea5e933"
                  strokeWidth={2}
                />
                {hasMrrLine ? (
                  <Line
                    yAxisId="amount"
                    type="monotone"
                    dataKey="mrr_snapshot"
                    name="MRR 快照"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                ) : null}
                <Bar
                  yAxisId="count"
                  dataKey="new_tenants"
                  name="新注册企业"
                  fill="#a78bfa"
                  barSize={14}
                  radius={[4, 4, 0, 0]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
