/**
 * @file 仪表盘：AI 用量接近上限时提示升级。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { getJson } from '@/api/client'
import { Button } from '@/components/ui/button'

type Sub = {
  usage: { ai_calls_used: number }
  plan: { ai_calls_monthly: number; name: string; code: string }
}

export function DashboardAiQuotaBanner() {
  const [sub, setSub] = useState<Sub | null>(null)

  useEffect(() => {
    void getJson<Sub>('/billing/subscription')
      .then(setSub)
      .catch(() => setSub(null))
  }, [])

  if (!sub) return null
  const used = sub.usage.ai_calls_used
  const limit = sub.plan.ai_calls_monthly
  if (limit <= 0 || limit === -1) return null

  const pct = Math.round((used / limit) * 100)
  if (pct < 70) return null

  const urgent = pct >= 90

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        urgent ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-start gap-2">
        <Sparkles className={`mt-0.5 h-4 w-4 shrink-0 ${urgent ? 'text-red-600' : 'text-amber-700'}`} />
        <div>
          <p className={`text-sm font-medium ${urgent ? 'text-red-900' : 'text-amber-950'}`}>
            本月 AI 已用 {used} / {limit} 次（{pct}%）
          </p>
          <p className="text-xs text-muted-foreground">
            {urgent
              ? '即将用尽，跟进与 AI 助手可能中断。建议升级 AI 助手版（8000 次/月）或 AI 旗舰版。'
              : '用量偏高，可考虑升级 AI 专用套餐，避免月中断档。'}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to="/app/ai-assistant">继续用 AI</Link>
        </Button>
        <Button size="sm" asChild>
          <Link to="/app/billing">查看套餐</Link>
        </Button>
      </div>
    </div>
  )
}
