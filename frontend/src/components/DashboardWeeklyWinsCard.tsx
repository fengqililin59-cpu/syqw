/**
 * @file 仪表盘：本周战果 + 行动建议（强化价值感知）。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PartyPopper, ArrowRight, Copy, FileDown, Send } from 'lucide-react'
import { getJson, http, postJson } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { isAdminUser } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type WeeklyWins = {
  week_label: string
  new_customers: number
  follow_ups: number
  new_deals: number
  high_intent_new: number
  ai_calls_month: number
  estimated_hours_saved_month: number
  pending_followup: number
  highlights: string[]
  recent_deal_customers?: { id: number; name: string }[]
  insight: string
}

export type { WeeklyWins }

export function DashboardWeeklyWinsCard({ data: dataProp }: { data?: WeeklyWins | null }) {
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)
  const [dataLocal, setDataLocal] = useState<WeeklyWins | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const data = dataProp ?? dataLocal

  useEffect(() => {
    if (dataProp !== undefined) return
    void getJson<WeeklyWins>('/dashboard/weekly-wins')
      .then(setDataLocal)
      .catch(() => setDataLocal(null))
  }, [dataProp])

  if (!data) return null

  async function copyShareText() {
    setShareBusy(true)
    try {
      const { text } = await getJson<{ text: string }>('/dashboard/weekly-wins/share')
      await navigator.clipboard.writeText(text)
      window.alert('周报已复制，可粘贴到企微群或发给老板')
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '复制失败')
    } finally {
      setShareBusy(false)
    }
  }

  async function exportPrintableReport() {
    setShareBusy(true)
    try {
      const res = await http.get('/dashboard/weekly-wins/export', { responseType: 'blob' })
      const blob = new Blob([res.data as BlobPart], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank', 'noopener,noreferrer')
      if (!w) {
        const a = document.createElement('a')
        a.href = url
        a.download = 'ZhiFlow周报.html'
        a.click()
        window.alert('已下载 HTML 周报，用浏览器打开后打印为 PDF')
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '导出失败')
    } finally {
      setShareBusy(false)
    }
  }

  async function pushToWework() {
    if (!window.confirm('向本企业所有管理员推送本周战报？')) return
    setShareBusy(true)
    try {
      const r = await postJson<{ sent: number; skipped?: string }>(
        '/dashboard/weekly-wins/push-wework',
        {},
      )
      if (r.sent > 0) window.alert(`已通过企微应用消息推送给 ${r.sent} 位管理员`)
      else window.alert('未推送：请确认已配置企微且管理员已绑定 wework_userid')
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '推送失败')
    } finally {
      setShareBusy(false)
    }
  }

  const hasActivity =
    data.new_customers > 0 ||
    data.follow_ups > 0 ||
    data.new_deals > 0 ||
    data.ai_calls_month > 0

  return (
    <Card className="border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-sky-950">
          <PartyPopper className="h-5 w-5 text-amber-500" />
          本周战果
          <span className="text-sm font-normal text-muted-foreground">({data.week_label})</span>
        </CardTitle>
        {data.new_deals > 0 ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            本周成交 {data.new_deals} 位
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {hasActivity ? (
          <ul className="flex flex-wrap gap-2">
            {data.highlights.map((h) => (
              <li
                key={h}
                className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-medium text-sky-900"
              >
                {h}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">本周数据还不多，完成一次跟进并试用 AI 后这里会更有看头。</p>
        )}

        <p className="rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-700">{data.insight}</p>

        <div className="flex flex-wrap gap-2">
          {data.pending_followup > 0 ? (
            <Button size="sm" asChild>
              <Link to="/app/follow-ups?overdue=1">
                处理待跟进
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
          <Button size="sm" variant="outline" asChild>
            <Link to="/app/ai-assistant">用 AI 写话术</Link>
          </Button>
          {data.new_deals > 0 ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/app/customers/pipeline">查看看板</Link>
            </Button>
          ) : null}
          <Button size="sm" variant="outline" disabled={shareBusy} onClick={() => void copyShareText()}>
            <Copy className="mr-1 h-3.5 w-3.5" />
            复制周报
          </Button>
          <Button size="sm" variant="outline" disabled={shareBusy} onClick={() => void exportPrintableReport()}>
            <FileDown className="mr-1 h-3.5 w-3.5" />
            导出 PDF
          </Button>
          {isAdmin ? (
            <Button size="sm" variant="outline" disabled={shareBusy} onClick={() => void pushToWework()}>
              <Send className="mr-1 h-3.5 w-3.5" />
              推送到企微
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
