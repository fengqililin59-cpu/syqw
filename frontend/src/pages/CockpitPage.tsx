/**
 * @file 老板驾驶舱：登录首屏。先回答「今天怎么样、这个月赚没赚钱、现在该做什么」。
 * 详细 CRM 报表下沉到「经营看板」二级页面。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, Lightbulb, RefreshCw } from 'lucide-react'
import {
  fetchCockpitOverview,
  fetchCockpitSuggestions,
  fetchCockpitTrends,
  type CockpitOverview,
  type CockpitSuggestion,
  type CockpitTrends,
} from '@/api/cockpit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const PRIORITY_STYLE: Record<CockpitSuggestion['priority'], { label: string; color: string }> = {
  high: { label: '优先', color: '#ef4444' },
  medium: { label: '重要', color: '#f59e0b' },
  low: { label: '可选', color: '#6b7280' },
}

function Metric({
  label,
  value,
  unit,
  hint,
  accent,
}: {
  label: string
  value: string | number
  unit?: string
  hint?: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>
          {value}
        </span>
        {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

function yuan(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return n.toFixed(0)
}

export function CockpitPage() {
  const [overview, setOverview] = useState<CockpitOverview | null>(null)
  const [trends, setTrends] = useState<CockpitTrends | null>(null)
  const [suggestions, setSuggestions] = useState<CockpitSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [ov, tr, sg] = await Promise.all([
        fetchCockpitOverview(),
        fetchCockpitTrends(30),
        fetchCockpitSuggestions(),
      ])
      setOverview(ov)
      setTrends(tr)
      setSuggestions(sg.suggestions)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const t = overview?.today
  const m = overview?.month

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">经营驾驶舱</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {overview ? `数据截至 ${overview.date}` : '正在加载今日经营数据'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            刷新
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/dashboard">
              <BarChart3 className="mr-1.5 h-4 w-4" />
              经营看板
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {t ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">今天</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Metric label="新增客户" value={t.new_customers} unit="人" />
            <Metric label="预约" value={t.appointments} unit="人" />
            <Metric label="到店" value={t.arrived} unit="人" accent="#10b981" />
            <Metric label="到店率" value={t.arrival_rate == null ? '—' : `${t.arrival_rate}%`} />
            <Metric label="收入" value={`¥${yuan(t.revenue)}`} accent="#6366f1" />
          </div>
        </section>
      ) : null}

      {m ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">本月</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Metric label="新增客户" value={m.new_customers} unit="人" />
            <Metric label="到店人次" value={m.arrived} />
            <Metric label="收入" value={`¥${yuan(m.income)}`} accent="#6366f1" />
            <Metric label="广告花费" value={`¥${yuan(m.ad_spend)}`} />
            <Metric
              label="获客成本"
              value={m.cac == null ? '—' : `¥${m.cac.toFixed(0)}`}
              hint={m.cac == null ? '需录入广告消耗' : undefined}
            />
            <Metric
              label="ROI"
              value={m.roi == null ? '—' : `${m.roi}`}
              hint={m.roi == null ? '需录入广告消耗' : '收入 ÷ 广告花费'}
              accent={m.roi != null && m.roi >= 1 ? '#10b981' : undefined}
            />
          </div>
          {m.repurchase_rate != null ? (
            <p className="text-xs text-muted-foreground">
              复购率 {m.repurchase_rate}%（到店 2 次及以上的客户占比）
            </p>
          ) : null}
        </section>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            今天最该做的事
          </CardTitle>
          <p className="text-sm text-muted-foreground">全部基于本店真实数据推导，点进去就能开始跟进。</p>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {loading ? '正在分析…' : '暂时没有需要特别处理的事项，保持节奏就好。'}
            </p>
          ) : (
            <div className="space-y-2">
              {suggestions.map((s) => {
                const style = PRIORITY_STYLE[s.priority]
                return (
                  <div
                    key={s.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-[11px] text-white"
                          style={{ background: style.color }}
                        >
                          {style.label}
                        </span>
                        <span className="font-medium">{s.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{s.detail}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={s.action_to}>{s.action_label}</Link>
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {trends && trends.series.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">近 {trends.days} 天趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <AreaChart data={trends.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="new_customers"
                    name="新增客户"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.15}
                  />
                  <Area
                    type="monotone"
                    dataKey="arrived"
                    name="到店"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

export default CockpitPage
