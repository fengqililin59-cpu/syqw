/**
 * @file 仪表盘：活跃流失 / 用量风险提醒（管理员可见）。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { getJson } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { isAdminUser } from '@/lib/roles'
import { Button } from '@/components/ui/button'

type ChurnRisk = {
  level: 'ok' | 'warn' | 'critical'
  risks: {
    code: string
    level: string
    title: string
    detail: string
    action_path: string
  }[]
}

export function DashboardChurnRiskBanner() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)
  const [data, setData] = useState<ChurnRisk | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    void getJson<ChurnRisk>('/dashboard/churn-risk')
      .then(setData)
      .catch(() => setData(null))
  }, [isAdmin])

  if (!isAdmin || hidden || !data || data.level === 'ok' || !data.risks.length) return null

  const critical = data.level === 'critical'

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        critical ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${critical ? 'text-red-600' : 'text-amber-700'}`} />
          <div className="min-w-0 space-y-2">
            <p className={`text-sm font-semibold ${critical ? 'text-red-950' : 'text-amber-950'}`}>
              活跃提醒 · 建议本周处理
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {data.risks.map((r) => (
                <li key={r.code}>
                  <span className="font-medium">{r.title}</span>
                  <span className="text-muted-foreground"> — {r.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button size="sm" variant="outline" asChild>
            <Link to={data.risks[0]?.action_path || '/app'}>去处理</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setHidden(true)}>
            知道了
          </Button>
        </div>
      </div>
    </div>
  )
}
