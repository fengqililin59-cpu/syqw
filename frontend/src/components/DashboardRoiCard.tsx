/**
 * @file 仪表盘：AI 使用与跟进效率（简易 ROI）。
 */
import { Link } from 'react-router-dom'
import { Clock, Sparkles, Target, TrendingUp } from 'lucide-react'
import type { DashboardStats } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function formatHours(minutes: number) {
  if (minutes < 60) return `约 ${minutes} 分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `约 ${h} 小时 ${m} 分` : `约 ${h} 小时`
}

export function DashboardRoiCard({ roi }: { roi: NonNullable<DashboardStats['roi_summary']> }) {
  const aiPct = roi.ai_usage_percent
  const limitLabel =
    roi.ai_calls_limit === -1 ? '不限' : roi.ai_calls_limit > 0 ? `${roi.ai_calls_limit} 次/月` : '—'

  return (
    <Card className="border-emerald-200/70 bg-gradient-to-br from-emerald-50/60 to-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-lg font-semibold text-emerald-950">本月效率概览</CardTitle>
          <p className="mt-1 text-sm text-emerald-900/70">{roi.note}</p>
        </div>
        <Button size="sm" variant="outline" className="border-emerald-200" asChild>
          <Link to="/app/billing">套餐与 AI 配额</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-emerald-100 bg-white/80 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-violet-600" />
              本月 AI 调用
            </div>
            <p className="text-2xl font-bold text-slate-900">{roi.ai_calls_used}</p>
            <p className="text-xs text-muted-foreground">
              配额 {limitLabel}
              {aiPct != null ? ` · 已用 ${aiPct}%` : null}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-white/80 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              估算节省时间
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatHours(roi.estimated_minutes_saved)}</p>
            <p className="text-xs text-muted-foreground">写话术 / 回复建议</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-white/80 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-sky-600" />
              近 7 日跟进记录
            </div>
            <p className="text-2xl font-bold text-slate-900">{roi.follow_ups_last_7d}</p>
            <p className="text-xs text-muted-foreground">条跟进已登记</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-white/80 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="h-3.5 w-3.5 text-amber-600" />
              待跟进客户
            </div>
            <p className="text-2xl font-bold text-slate-900">{roi.pending_followup}</p>
            <p className="text-xs text-muted-foreground">计划日已到</p>
          </div>
        </div>
        {roi.plan_name ? (
          <p className="mt-3 text-xs text-muted-foreground">
            当前套餐：{roi.plan_name}
            {aiPct != null && aiPct >= 70 ? (
              <span className="ml-2 text-amber-700">AI 用量偏高，可考虑升级 AI 专用套餐</span>
            ) : null}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
