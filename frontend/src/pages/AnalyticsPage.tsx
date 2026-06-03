/**
 * @file 报表分析页面：漏斗分析 / 团队业绩 / 客户分析。
 */
import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  UserCheck,
  Target,
  PhoneCall,
  ChevronDown,
} from 'lucide-react'
import {
  fetchFunnelReport,
  fetchTeamPerformance,
  fetchCustomerAnalysis,
  fetchReportSummary,
} from '@/api/analytics'
import type {
  FunnelReport,
  TeamPerformance,
  CustomerAnalysis,
  ReportSummary,
} from '@/api/analytics'

// ── 常量 ──
const PERIODS = [
  { value: '', label: '本月' },
  { value: 'last_week', label: '上周' },
  { value: 'last_month', label: '上月' },
  { value: 'last_quarter', label: '上季度' },
]

const FUNNEL_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#22c55e']
const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1']
const INTENT_COLORS: Record<string, string> = { high: '#22c55e', medium: '#f59e0b', low: '#ef4444', '未知': '#9ca3af' }

// ── 简单 UI 组件（避免引入不存在的 shadcn 组件） ──
function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            active === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function StatCard({ title, value, sub, icon: Icon, trend, color }: {
  title: string; value: string | number; sub?: string; icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | null; color?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold" style={color ? { color } : undefined}>{value}</span>
        {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
        {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
      </div>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

function Loading({ text = '加载中…' }: { text?: string }) {
  return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">{text}</div>
}

// ── 漏斗分析 Tab ──
function useFunnelData(period: string) {
  const [data, setData] = useState<FunnelReport | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    fetchFunnelReport(period ? { period } : undefined)
      .then(setData)
      .finally(() => setLoading(false))
  }, [period])
  return { data, loading }
}

function FunnelTab({ period }: { period: string }) {
  const { data, loading } = useFunnelData(period)
  if (loading) return <Loading text="加载漏斗数据…" />
  if (!data) return <div className="text-sm text-muted-foreground">暂无数据</div>

  const s = data.summary
  return (
    <div className="space-y-6">
      {/* 概览卡片 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="总客户数" value={s.totalCustomers} icon={Users} />
        <StatCard
          title="成交数" value={s.dealCount}
          sub={s.yoyDealChange !== null ? `同比 ${s.yoyDealChange > 0 ? '+' : ''}${s.yoyDealChange}%` : undefined}
          icon={UserCheck}
          trend={s.yoyDealChange !== null ? (s.yoyDealChange >= 0 ? 'up' : 'down') : null}
        />
        <StatCard
          title="成交金额" value={`¥${s.dealAmount.toLocaleString()}`}
          sub={s.yoyAmountChange !== null ? `同比 ${s.yoyAmountChange > 0 ? '+' : ''}${s.yoyAmountChange}%` : undefined}
          icon={DollarSign}
          color={s.dealAmount > 0 ? '#22c55e' : undefined}
          trend={s.yoyAmountChange !== null ? (s.yoyAmountChange >= 0 ? 'up' : 'down') : null}
        />
        <StatCard title="整体转化率" value={`${s.overallConversion}%`} sub="新线索 → 成交" icon={Target} color="#3b82f6" />
      </div>

      {/* 漏斗图 */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold">销售漏斗</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.funnel} layout="vertical" margin={{ left: 60, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 13 }} />
              <Tooltip
                formatter={(value: any, name: any) => {
                  if (name === 'count') return [`${value} 人`, '客户数']
                  return [value, name]
                }}
              />
              <Bar dataKey="count" name="count" radius={[0, 6, 6, 0]}>
                {data.funnel.map((_, i) => (
                  <Cell key={i} fill={FUNNEL_COLORS[i] || '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 明细表 */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium">阶段</th>
              <th className="px-4 py-2 text-right font-medium">客户数</th>
              <th className="px-4 py-2 text-right font-medium">转化率</th>
              <th className="px-4 py-2 text-right font-medium">同比变化</th>
              <th className="px-4 py-2 text-right font-medium">平均停留</th>
              <th className="px-4 py-2 text-right font-medium">平均意向分</th>
            </tr>
          </thead>
          <tbody>
            {data.funnel.map((f, i) => (
              <tr key={f.stage} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: FUNNEL_COLORS[i] || '#3b82f6' }} />
                    {f.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-medium">{f.count}</td>
                <td className="px-4 py-2.5 text-right font-mono">{f.conversionRate}%</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {f.yoyChange !== null ? (
                    <span className={f.yoyChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {f.yoyChange > 0 ? '+' : ''}{f.yoyChange}%
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{f.avgDwellDays} 天</td>
                <td className="px-4 py-2.5 text-right font-mono">{f.avgIntent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 团队业绩 Tab ──
function useTeamData(period: string) {
  const [data, setData] = useState<TeamPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    fetchTeamPerformance(period ? { period } : undefined)
      .then(setData)
      .finally(() => setLoading(false))
  }, [period])
  return { data, loading }
}

function TeamTab({ period }: { period: string }) {
  const { data, loading } = useTeamData(period)
  if (loading) return <Loading text="加载团队数据…" />
  if (!data) return <div className="text-sm text-muted-foreground">暂无数据</div>

  const sm = data.summary
  const barData = data.members.slice(0, 10).map((m) => ({ name: m.name, 成交额: m.revenue, 跟进数: m.followupCount }))

  return (
    <div className="space-y-6">
      {/* 概览 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="团队成员" value={sm.totalMembers} icon={Users} />
        <StatCard title="本期成交" value={sm.totalDeals} icon={UserCheck} color="#22c55e" />
        <StatCard title="成交总额" value={`¥${sm.totalRevenue.toLocaleString()}`} icon={DollarSign} color="#3b82f6" />
        <StatCard title="总跟进次数" value={sm.totalFollowups} icon={PhoneCall} />
      </div>

      {/* 排行榜柱状图 */}
      {barData.length > 0 && barData.some((d) => d.成交额 > 0) && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold">业绩 Top 10</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" />
                <YAxis />
                <Tooltip formatter={(value: any) => [`¥${value.toLocaleString()}`, '成交额']} />
                <Bar dataKey="成交额" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 排行榜表格 */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-4 py-2 text-left font-medium">成员</th>
              <th className="px-4 py-2 text-right font-medium">客户数</th>
              <th className="px-4 py-2 text-right font-medium">新增</th>
              <th className="px-4 py-2 text-right font-medium">跟进</th>
              <th className="px-4 py-2 text-right font-medium">成交</th>
              <th className="px-4 py-2 text-right font-medium">转化率</th>
              <th className="px-4 py-2 text-right font-medium">成交额</th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((m, i) => (
              <tr key={m.userId} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium">{m.name}</td>
                <td className="px-4 py-2.5 text-right font-mono">{m.total}</td>
                <td className="px-4 py-2.5 text-right font-mono">{m.newCount}</td>
                <td className="px-4 py-2.5 text-right font-mono">{m.followupCount}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-green-600">{m.dealCount}</td>
                <td className="px-4 py-2.5 text-right font-mono">{m.conversionRate}%</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold">
                  ¥{m.revenue.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 客户分析 Tab ──
function useCustomerData(period: string) {
  const [data, setData] = useState<CustomerAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    fetchCustomerAnalysis(period ? { period } : undefined)
      .then(setData)
      .finally(() => setLoading(false))
  }, [period])
  return { data, loading }
}

function CustomerTab({ period }: { period: string }) {
  const { data, loading } = useCustomerData(period)
  if (loading) return <Loading text="加载客户数据…" />
  if (!data) return <div className="text-sm text-muted-foreground">暂无数据</div>

  const e = data.engagement
  const pieSource = data.sourceDistribution.slice(0, 8)

  return (
    <div className="space-y-6">
      {/* 活跃度概览 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="客户总数" value={e.totalCustomers} icon={Users} />
        <StatCard title="活跃客户" value={e.activeCustomers} sub={`活跃率 ${e.activeRate}%`} icon={UserCheck} color="#22c55e" />
        <StatCard title="总跟进次数" value={e.totalFollowups} sub={`人均 ${e.avgFollowupsPerCustomer} 次`} icon={PhoneCall} />
        <StatCard title="7天未联系" value={e.noFollowup7Days} icon={Target} color={e.noFollowup7Days > 0 ? '#ef4444' : '#22c55e'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 新增趋势 */}
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold">客户新增趋势</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.newCustomerTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="count" name="新增" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                <Area type="monotone" dataKey="deals" name="成交" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 来源分布 */}
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold">客户来源</h3>
          <div className="h-64">
            {pieSource.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieSource}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine
                  >
                    {pieSource.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`${value} 人`, '客户数']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无来源数据</div>
            )}
          </div>
        </div>

        {/* 意向度分布 */}
        <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold">意向度分布</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.intentDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip formatter={(value: any) => [`${value} 人`, '客户数']} />
                  <Bar dataKey="count" name="count" radius={[4, 4, 0, 0]}>
                    {data.intentDistribution.map((d) => (
                      <Cell key={d.level} fill={INTENT_COLORS[d.level] || '#9ca3af'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        {/* 热门标签 */}
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold">热门标签 Top 10</h3>
          <div className="h-64">
            {data.topTags.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topTags} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={75} />
                  <Tooltip formatter={(value: any) => [`${value} 个`, '使用次数']} />
                  <Bar dataKey="value" name="value" radius={[0, 4, 4, 0]} fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无标签数据</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 汇总 Tab ──
function useSummaryData(period: string) {
  const [data, setData] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    fetchReportSummary(period ? { period } : undefined)
      .then(setData)
      .finally(() => setLoading(false))
  }, [period])
  return { data, loading }
}

function SummaryTab({ period }: { period: string }) {
  const { data, loading } = useSummaryData(period)
  if (loading) return <Loading text="加载汇总数据…" />
  if (!data) return <div className="text-sm text-muted-foreground">暂无数据</div>

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <StatCard title="客户总数" value={data.totalCustomers} icon={Users} />
      <StatCard title="本期新增" value={data.newCustomers} icon={UserCheck} color="#3b82f6" />
      <StatCard title="成交数" value={data.dealCount} icon={Target} color="#22c55e" />
      <StatCard title="成交金额" value={`¥${data.revenue.toLocaleString()}`} icon={DollarSign} color="#22c55e" />
      <StatCard title="跟进次数" value={data.followupCount} icon={PhoneCall} />
      <StatCard title="转化率" value={`${data.conversionRate}%`} icon={TrendingUp} color="#3b82f6" />
    </div>
  )
}

// ── 主页面 ──
const TABS = ['汇总', '漏斗分析', '团队业绩', '客户分析']

export default function AnalyticsPage() {
  const [tab, setTab] = useState('汇总')
  const [period, setPeriod] = useState('')

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* 页头 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">数据报表</h1>
          <p className="text-sm text-muted-foreground">
            {PERIODS.find((p) => p.value === period)?.label || '本月'} · {tab}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* 内容区 */}
      {tab === '汇总' && <SummaryTab period={period} />}
      {tab === '漏斗分析' && <FunnelTab period={period} />}
      {tab === '团队业绩' && <TeamTab period={period} />}
      {tab === '客户分析' && <CustomerTab period={period} />}
    </div>
  )
}
