/**
 * @file 仪表盘：KPI 卡片 + 近 7 日趋势面积图 + 客户阶段饼图（数据来自 /dashboard/stats）。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  TrendingUp,
  Handshake,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { getJson } from '@/api/client'
import type { DashboardStats } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'
import { hasPermUser, isAdminUser } from '@/lib/roles'

const TREND_NEW_COLOR = '#334155'
const TREND_DEAL_COLOR = '#059669'
const CHART_GRID_COLOR = '#F1F5F9'
const CHART_AXIS_COLOR = '#64748B'

const PIE_STAGE_COLORS: Record<string, string> = {
  新线索: '#7eb3f0',
  意向确认: '#a78bfa',
  方案报价: '#34d399',
  商务谈判: '#34d399',
  成交: '#4ade80',
  流失: '#94a3b8',
}

const FALLBACK_PIE_COLORS = ['#7eb3f0', '#a78bfa', '#34d399', '#34d399', '#4ade80', '#94a3b8']

function getPieColor(name: string, index: number) {
  return PIE_STAGE_COLORS[name] ?? FALLBACK_PIE_COLORS[index % FALLBACK_PIE_COLORS.length]
}

function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-1">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-4 rounded-[22px] bg-white p-6 shadow-sm">
            <Sk className="h-11 w-11 rounded-2xl" />
            <Sk className="h-3.5 w-20" />
            <Sk className="h-10 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-[24px] bg-white p-6 shadow-sm">
          <Sk className="h-5 w-36" />
          <Sk className="mt-2 h-4 w-64" />
          <Sk className="mt-6 h-[320px] w-full rounded-2xl" />
        </div>
        <div className="rounded-[24px] bg-white p-6 shadow-sm">
          <Sk className="h-5 w-28" />
          <Sk className="mt-2 h-4 w-52" />
          <Sk className="mt-6 h-[320px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[136px] rounded-2xl border border-slate-100 bg-white px-3.5 py-3 text-xs shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
      <p className="mb-2 font-semibold text-slate-700">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-500">{p.dataKey}</span>
          </div>
          <span className="font-semibold text-slate-900">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function renderTrendLegend() {
  const items = [
    { label: '新增客户', color: TREND_NEW_COLOR },
    { label: '成交客户', color: TREND_DEAL_COLOR },
  ]

  return (
    <div className="flex items-center gap-5 pt-3 text-xs text-slate-600">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full ring-4 ring-white" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function PieLegend({ stageItems }: { stageItems: Array<{ name: string; color: string }> }) {
  return (
    <div className="flex flex-col gap-2 text-[12px] text-slate-600">
      {stageItems.map((item) => (
        <div key={item.name} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="font-medium text-slate-700">{item.name}</span>
        </div>
      ))}
    </div>
  )
}

type KpiItem = {
  label: string
  value: number
  icon: React.ElementType
  iconBg: string
  iconColor: string
  accent: string
  rate: number | null
  hint: string
  onClick?: () => void
}

type OnboardingChecklist = {
  progress_percent: number
  done_count: number
  total: number
  items: { key: string; label: string; done: boolean; link: string; hint?: string }[]
  cron_hints: string[]
}

export function DashboardHomePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const permissions = useAuthStore((s) => s.permissions)
  const isAdmin = isAdminUser(user)
  const canViewDashboard = hasPermUser(permissions, 'dashboard:view')
  const canCustomers = hasPermUser(permissions, 'customer:view')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingChecklist | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllChannel, setShowAllChannel] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const [s, ob] = await Promise.all([
          getJson<DashboardStats>('/dashboard/stats'),
          isAdmin && canViewDashboard
            ? getJson<OnboardingChecklist>('/dashboard/onboarding').catch(() => null)
            : Promise.resolve(null),
        ])
        if (!cancelled) {
          setStats(s)
          setOnboarding(ob)
        }
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAdmin, canViewDashboard])

  if (loading || (!stats && !err)) return <DashboardSkeleton />

  if (err) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Inbox className="mb-4 h-10 w-10 text-slate-300" />
        <p className="font-medium text-slate-600">数据加载失败</p>
        <p className="mt-1 text-sm text-slate-400">{err}</p>
      </div>
    )
  }

  if (!stats) return null

  const pieData = stats.stage_distribution.filter((x) => x.value > 0)
  const hasCustomers = (stats.total_customers?.value ?? 0) > 0
  const pieLegendItems = pieData.map((item, index) => ({
    name: item.name,
    color: getPieColor(item.name, index),
  }))

  const trendData = stats.last_7_days_labels.map((label, i) => ({
    date: label,
    新增: stats.last_7_days_new[i] ?? 0,
    成交: stats.last_7_days_deal[i] ?? 0,
  }))

  const trendEmpty = trendData.every((d) => d.新增 === 0 && d.成交 === 0)
  const overdueCount = stats.pending_followup?.value ?? stats.overdue_follow_up_count ?? 0
  const overdueTicketCount = stats.overdue_ticket_count ?? 0
  const kpis: KpiItem[] = [
    {
      label: '总客户数',
      value: stats.total_customers?.value ?? 0,
      icon: Users,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-700',
      accent: 'linear-gradient(90deg,#7eb3f0,#a78bfa)',
      rate: stats.total_customers?.rate ?? null,
      hint: '客户池规模',
      onClick: () => navigate('/app/customers'),
    },
    {
      label: '高意向客户',
      value: stats.high_intent?.value ?? 0,
      icon: TrendingUp,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-700',
      accent: 'linear-gradient(90deg,#4ade80,#22d3ee)',
      rate: stats.high_intent?.rate ?? null,
      hint: '重点跟进对象',
      onClick: () => navigate('/app/intent-alerts'),
    },
    {
      label: '本月成交',
      value: stats.deals_this_month?.value ?? 0,
      icon: Handshake,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-700',
      accent: 'linear-gradient(90deg,#fb923c,#fbbf24)',
      rate: stats.deals_this_month?.rate ?? null,
      hint: '本月转化结果',
    },
    {
      label: '待跟进',
      value: overdueCount,
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-700',
      accent: 'linear-gradient(90deg,#f87171,#fb7185)',
      rate: stats.pending_followup?.rate ?? null,
      hint: '需要尽快处理',
      onClick: () => navigate('/app/follow-ups?overdue=1'),
    },
    {
      label: 'SLA 逾期工单',
      value: overdueTicketCount,
      icon: Clock,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-700',
      accent: 'linear-gradient(90deg,#ef4444,#f97316)',
      rate: null,
      hint: '售后需尽快处理',
      onClick: () => navigate('/app/service-desk?sla=overdue'),
    },
  ]

  return (
    <div className="space-y-8 pb-10" style={{ background: '#f0f4f8' }}>
      {!hasCustomers ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <Inbox className="h-5 w-5 text-slate-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700">还没有客户数据</p>
            <p className="text-xs text-slate-400">
              管理员：先在「系统设置」配企微，再用「渠道活码」或「自动化流程 → 一键起步包」获客。销售：可请管理员导入或分配客户。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {isAdmin ? (
              <Button size="sm" variant="outline" onClick={() => navigate('/app/settings')}>
                配置企微
              </Button>
            ) : null}
            <Button size="sm" onClick={() => navigate('/app/customers')}>
              客户管理
            </Button>
          </div>
        </div>
      ) : null}

      {canCustomers && !isAdmin ? (
        <Card className="border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-sky-950">销售每日 3 步</CardTitle>
            <p className="text-sm text-sky-900/70">不用记菜单，按这个顺序用就行。</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-0">
            <Button size="sm" variant="secondary" onClick={() => navigate('/app/follow-ups?overdue=1')}>
              1. 看待跟进
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/app/customers')}>
              2. 查客户资料
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/app/customers/pipeline')}>
              3. 更新销售阶段
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {onboarding && onboarding.progress_percent < 100 ? (
        <Card className="border-sky-300/80 bg-white shadow-md ring-1 ring-sky-100">
          <CardHeader className="border-b border-sky-100 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg font-semibold text-slate-900">上线检查清单</CardTitle>
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-sm font-semibold text-sky-800">
                {onboarding.done_count}/{onboarding.total} · {onboarding.progress_percent}%
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              管理员首次上线约 15 分钟。按顺序点「去配置」，跑通「留资 → 入库 → 欢迎语 → 跟进」。
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {onboarding.items.map((item) => (
              <div
                key={item.key}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${item.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {item.done ? '✓ ' : '○ '}
                    {item.label}
                  </p>
                  {item.hint ? <p className="mt-0.5 text-xs text-slate-400">{item.hint}</p> : null}
                </div>
                {!item.done && item.link ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => navigate(item.link)}>
                    去配置
                  </Button>
                ) : null}
              </div>
            ))}
            {onboarding.cron_hints.length > 0 ? (
              <p className="text-xs text-amber-800">
                需运维在服务器开启定时任务后，延迟节点与自动跟进才会生效（联系管理员处理）。
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            role={kpi.onClick ? 'button' : undefined}
            tabIndex={kpi.onClick ? 0 : undefined}
            onClick={kpi.onClick}
            onKeyDown={kpi.onClick ? (e) => {
              if (e.key === 'Enter') kpi.onClick?.()
            } : undefined}
            className={[
              'group relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200',
              kpi.onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md' : '',
            ].join(' ')}
          >
            <div className="relative mb-5 flex items-center justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset ring-slate-100 ${kpi.iconBg}`}>
                <kpi.icon className={`h-[18px] w-[18px] ${kpi.iconColor}`} />
              </div>
              {kpi.rate !== null ? (
                <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold" style={{ color: kpi.rate >= 0 ? '#10b981' : '#ef4444' }}>
                  {kpi.rate >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {Math.abs(kpi.rate).toFixed(1)}%
                </div>
              ) : null}
            </div>

            <p className="relative mb-2 text-[12px] font-medium text-[#94a3b8]">{kpi.label}</p>
            <p className="relative text-[28px] font-extrabold tracking-tight text-slate-900">{kpi.value}</p>
            <div className="relative mt-2 text-[12px]" style={{ color: '#94a3b8' }}>{kpi.hint}</div>

            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '2.5px',
                borderRadius: '0 0 10px 10px',
                background: kpi.accent,
              }}
            />
          </div>
        ))}
      </div>

      {stats.funnel && stats.funnel.length > 0 ? (
        <Card className="bg-white shadow-sm" style={{ border: '0.5px solid #e2e8f0', borderRadius: 12 }}>
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900">获客 → 成交漏斗</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              加好友回调 → CRM 入库 → 推进中阶段 → 累计成交；转化率相对上一环节。
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {(() => {
              const max = Math.max(...stats.funnel!.map((s) => s.count), 1)
              return stats.funnel!.map((step, i) => (
                <div key={step.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{step.label}</span>
                    <span className="tabular-nums text-slate-900">
                      {step.count}
                      {step.conversion_from_prev_percent != null ? (
                        <span className="ml-2 text-xs text-slate-400">
                          ({step.conversion_from_prev_percent}%)
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(4, (step.count / max) * 100)}%`,
                        background:
                          i === stats.funnel!.length - 1
                            ? 'linear-gradient(90deg,#4ade80,#059669)'
                            : 'linear-gradient(90deg,#7eb3f0,#6366f1)',
                      }}
                    />
                  </div>
                </div>
              ))
            })()}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => navigate('/app/customers/pipeline')}>
                销售看板
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/app/channel-live')}>
                渠道活码
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {stats.revenue && (stats.revenue.paid_total > 0 || stats.revenue.order_count > 0) ? (
        <Card className="bg-white shadow-sm" style={{ border: '0.5px solid #e2e8f0', borderRadius: 12 }}>
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900">成交与 Pipeline 金额</CardTitle>
            <p className="mt-1 text-sm text-slate-500">基于服务台订单（已付款 / 已发货 / 已完成）汇总。</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <p className="text-xs text-slate-500">本月成交额</p>
                <p className="text-xl font-bold text-slate-900">
                  ¥{stats.revenue.paid_mtd.toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <p className="text-xs text-slate-500">累计成交额</p>
                <p className="text-xl font-bold text-slate-900">
                  ¥{stats.revenue.paid_total.toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <p className="text-xs text-slate-500">Pipeline 关联金额</p>
                <p className="text-xl font-bold text-emerald-700">
                  ¥{stats.revenue.pipeline_amount.toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <p className="text-xs text-slate-500">有效订单</p>
                <p className="text-xl font-bold text-slate-900">{stats.revenue.order_count} 笔</p>
              </div>
            </div>
            {stats.revenue.by_stage.length > 0 ? (
              <div className="space-y-2">
                {stats.revenue.by_stage.slice(0, 6).map((row) => {
                  const max = Math.max(...stats.revenue!.by_stage.map((r) => r.amount), 1)
                  return (
                    <div key={row.stage} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{row.stage_label}</span>
                        <span className="tabular-nums text-slate-900">
                          ¥{row.amount.toLocaleString('zh-CN')}
                          <span className="ml-2 text-xs text-slate-400">{row.order_count} 笔</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.max(4, (row.amount / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => navigate('/app/service-desk')}>
              服务台 · 订单
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.7fr_1fr]">
        <Card className="bg-white shadow-sm" style={{ background: '#ffffff', border: '0.5px solid #e2e8f0', borderRadius: 12 }}>
          <CardHeader className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight text-slate-900">近 7 日新增与成交趋势</CardTitle>
              <p className="mt-1 text-sm text-slate-500">按自然日统计，帮助你观察短期增长节奏与成交效率。</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/customers')}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              查看详情 <ChevronRight className="h-3 w-3" />
            </button>
          </CardHeader>

          <CardContent className="pt-6">
            {trendEmpty ? (
              <div className="flex h-[320px] flex-col items-center justify-center gap-2 text-center">
                <Inbox className="h-8 w-8 text-slate-200" />
                <p className="text-sm text-slate-400">近 7 日暂无数据</p>
              </div>
            ) : (
              <div className="h-[320px] rounded-2xl bg-white p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                    <defs>
                      <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={TREND_NEW_COLOR} stopOpacity={0.03} />
                        <stop offset="100%" stopColor={TREND_NEW_COLOR} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradDeal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={TREND_DEAL_COLOR} stopOpacity={0.03} />
                        <stop offset="100%" stopColor={TREND_DEAL_COLOR} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: CHART_AXIS_COLOR }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: CHART_AXIS_COLOR }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend content={renderTrendLegend} />
                    <Area
                      type="monotone"
                      dataKey="新增"
                      stroke={TREND_NEW_COLOR}
                      strokeWidth={2}
                      fill="url(#gradNew)"
                      dot={{ r: 4, fill: '#FFFFFF', stroke: TREND_NEW_COLOR, strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: '#FFFFFF', stroke: TREND_NEW_COLOR, strokeWidth: 2 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="成交"
                      stroke={TREND_DEAL_COLOR}
                      strokeWidth={2}
                      fill="url(#gradDeal)"
                      dot={{ r: 4, fill: '#FFFFFF', stroke: TREND_DEAL_COLOR, strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: '#FFFFFF', stroke: TREND_DEAL_COLOR, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[24px] bg-white shadow-sm" style={{ background: '#ffffff', border: '0.5px solid #e2e8f0' }}>
          <CardHeader className="border-b border-slate-100 pb-5">
            <CardTitle className="text-lg font-semibold tracking-tight text-slate-900">客户阶段分布</CardTitle>
            <p className="mt-1 text-sm text-slate-500">查看客户在不同阶段的占比结构，识别当前转化瓶颈。</p>
          </CardHeader>

          <CardContent className="pt-6">
            {!hasCustomers || pieData.length === 0 ? (
              <div className="flex h-[320px] flex-col items-center justify-center gap-2 text-center">
                <Inbox className="h-8 w-8 text-slate-200" />
                <p className="text-sm text-slate-400">暂无客户数据</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-50 md:hidden">
                  {pieData.slice(0, showAllChannel ? undefined : 4).map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: getPieColor(item.name, i) }} />
                        <span className="text-sm text-slate-600">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{item.value}</span>
                    </div>
                  ))}
                  {pieData.length > 4 && !showAllChannel ? (
                    <button
                      type="button"
                      onClick={() => setShowAllChannel(true)}
                      className="w-full pt-2 text-center text-xs text-slate-600 hover:text-slate-900"
                    >
                      查看全部 {pieData.length} 个阶段
                    </button>
                  ) : null}
                </div>

                <div className="hidden items-center gap-6 md:flex">
                  <div className="flex h-[320px] flex-1 items-center bg-white p-4" style={{ background: '#ffffff', borderRadius: 12 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="42%"
                          cy="50%"
                          outerRadius={92}
                          innerRadius={48}
                          paddingAngle={3}
                        >
                          {pieData.map((item, i) => (
                            <Cell key={i} fill={getPieColor(item.name, i)} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [value ?? 0, name]}
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #f1f5f9',
                            boxShadow: '0 16px 40px rgba(15,23,42,0.12)',
                            fontSize: 12,
                            color: '#334155',
                            backgroundColor: '#ffffff',
                          }}
                          itemStyle={{ color: '#334155' }}
                          labelStyle={{ color: '#334155' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-[132px] shrink-0 p-1">
                    <PieLegend stageItems={pieLegendItems} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
