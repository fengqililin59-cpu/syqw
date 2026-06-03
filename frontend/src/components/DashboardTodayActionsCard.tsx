/**
 * @file 仪表盘「今日必做」：把 ROI 转化为每日可执行动作（提升打开率与粘性）。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ChevronRight, ListTodo, Send } from 'lucide-react'
import { getJson, postJson } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { isAdminUser } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type TodayActionItem = {
  key: string
  priority: 'critical' | 'high' | 'normal'
  title: string
  description: string
  count?: number
  link: string
  cta: string
}

type TodayActions = {
  items: TodayActionItem[]
  total: number
  critical_count: number
  headline: string
}

function priorityBadge(p: TodayActionItem['priority']) {
  if (p === 'critical') return <Badge variant="destructive">紧急</Badge>
  if (p === 'high') return <Badge className="bg-amber-500 hover:bg-amber-600">重要</Badge>
  return <Badge variant="secondary">建议</Badge>
}

export function DashboardTodayActionsCard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)
  const [data, setData] = useState<TodayActions | null>(null)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    void getJson<TodayActions>('/dashboard/today-actions')
      .then(setData)
      .catch(() => setData(null))
  }, [])

  async function pushToWework() {
    if (!window.confirm('向本企业所有管理员推送「今日必做」企微摘要？')) return
    setPushBusy(true)
    try {
      const r = await postJson<{ sent: number }>('/dashboard/today-actions/push-wework', {})
      if (r.sent > 0) window.alert(`已推送 ${r.sent} 位管理员`)
      else window.alert('未推送：请确认已配置企微且管理员已绑定 wework_userid')
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '推送失败')
    } finally {
      setPushBusy(false)
    }
  }

  if (!data) return null

  if (data.total === 0) {
    return (
      <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-emerald-950">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            今日必做
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-emerald-900/90">{data.headline}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/app/customers')}>
              查看客户
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/app/ai-assistant')}>
              用 AI 写话术
            </Button>
            {isAdmin ? (
              <Button size="sm" variant="outline" disabled={pushBusy} onClick={() => void pushToWework()}>
                <Send className="mr-1 h-3.5 w-3.5" />
                推送到企微
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-violet-200/90 bg-gradient-to-br from-violet-50/70 to-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base text-violet-950">
            <ListTodo className="h-5 w-5 text-violet-700" />
            今日必做
            {data.critical_count > 0 ? (
              <Badge variant="destructive" className="font-normal">
                {data.critical_count} 项紧急
              </Badge>
            ) : null}
          </CardTitle>
          <p className="mt-1 text-xs text-violet-900/75">{data.headline}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap justify-end gap-2 pb-1">
          {isAdmin ? (
            <Button size="sm" variant="outline" disabled={pushBusy} onClick={() => void pushToWework()}>
              <Send className="mr-1 h-3.5 w-3.5" />
              {pushBusy ? '推送中…' : '推送到企微'}
            </Button>
          ) : null}
        </div>
        {data.items.map((item) => (
          <div
            key={item.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white/90 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {priorityBadge(item.priority)}
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
            </div>
            <Button size="sm" onClick={() => navigate(item.link)}>
              {item.cta}
              <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
