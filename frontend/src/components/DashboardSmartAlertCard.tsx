/**
 * @file 仪表盘「AI 智能跟进提醒」卡片。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Sparkles, ChevronRight, Clock, AlertTriangle, TrendingUp } from 'lucide-react'
import { getJson } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type AlertItem = {
  id: number
  name: string
  company: string
  stage: string
  intent_score: number
  phone: string
  alert_reason: 'urgent' | 'silent' | 'stuck'
  last_followup_at: string | null
  last_contact_at: string | null
}

type SmartAlerts = {
  total: number
  items: AlertItem[]
  ai_advice: string
}

const reasonConfig: Record<AlertItem['alert_reason'], { label: string; color: string; icon: React.ElementType; bg: string }> = {
  urgent: { label: '高意向待跟', color: 'border-red-300 bg-red-50 text-red-800', icon: AlertTriangle, bg: 'bg-red-500' },
  silent: { label: '高意向沉默', color: 'border-amber-300 bg-amber-50 text-amber-800', icon: Clock, bg: 'bg-amber-500' },
  stuck: { label: '管道滞留', color: 'border-slate-300 bg-slate-50 text-slate-700', icon: TrendingUp, bg: 'bg-slate-500' },
}

const stageMap: Record<string, string> = {
  new: '新线索', following: '跟进中', negotiating: '商务谈判',
  intent_confirm: '意向确认', proposal: '方案报价', deal: '成交', won: '赢单', lost: '流失',
}

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return '从未'
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return '今天'
  if (d === 1) return '昨天'
  return `${d}天前`
}

export function DashboardSmartAlertCard() {
  const navigate = useNavigate()
  const [data, setData] = useState<SmartAlerts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getJson<SmartAlerts>('/dashboard/smart-alerts')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="border-orange-100 bg-gradient-to-br from-orange-50/40 to-white shadow-sm">
        <CardContent className="py-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 animate-pulse rounded-full bg-orange-200" />
            <span className="h-4 w-32 animate-pulse rounded bg-orange-100" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.total === 0) return null

  return (
    <Card className="border-orange-200/80 bg-gradient-to-br from-orange-50/60 to-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base text-orange-950">
            <Bell className="h-5 w-5 text-orange-600" />
            AI 智能跟进提醒
            <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{data.total}</Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* AI 总建议 */}
        {data.ai_advice && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50/80 p-2.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            <p className="text-sm font-medium text-orange-900">{data.ai_advice}</p>
          </div>
        )}

        {/* 告警列表 */}
        <div className="space-y-2">
          {data.items.map((item) => {
            const config = reasonConfig[item.alert_reason]
            const Icon = config.icon
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border p-2.5 transition-colors hover:shadow-sm ${config.color}`}
              >
                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.bg} text-white`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-900 truncate">{item.name}</span>
                    {item.company && (
                      <span className="text-xs text-slate-400 truncate">{item.company}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="rounded bg-white/60 px-1 py-0.5">{stageMap[item.stage] || item.stage}</span>
                    <span>意向 {item.intent_score}分</span>
                    <span className="text-slate-400">{daysAgo(item.last_followup_at)}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 text-xs text-orange-700 hover:bg-orange-100"
                  onClick={() => navigate(`/app/customers/${item.id}`)}
                >
                  去跟进 <ChevronRight className="ml-0.5 h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
