/**
 * @file 平台运营：即将到期订阅（试用 / 付费周期）。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarClock, FileDown, Mail, PhoneCall } from 'lucide-react'
import { getJson, http, postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ExpiringRow = {
  tenant_id: number
  tenant_name: string
  contact_name: string | null
  contact_phone: string | null
  plan_code: string
  plan_name: string
  subscription_status: string
  billing_cycle: string
  ends_at: string
  days_remaining: number
  urgency: 'critical' | 'warn' | 'normal'
}

type Res = {
  list: ExpiringRow[]
  total: number
  days: number
  include_past_due: boolean
}

function urgencyBadge(u: ExpiringRow['urgency'], days: number) {
  if (days < 0) {
    return <Badge variant="destructive">已过期 {Math.abs(days)} 天</Badge>
  }
  if (u === 'critical') return <Badge variant="destructive">{days} 天内</Badge>
  if (u === 'warn') return <Badge className="bg-amber-500 hover:bg-amber-600">{days} 天内</Badge>
  return <Badge variant="secondary">{days} 天内</Badge>
}

function statusLabel(s: string) {
  if (s === 'trialing') return '试用中'
  if (s === 'active') return '生效中'
  return s
}

export function PlatformExpiringSubscriptionsPage() {
  const [data, setData] = useState<Res | null>(null)
  const [days, setDays] = useState(14)
  const [includePastDue, setIncludePastDue] = useState(false)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [rowCreating, setRowCreating] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ days: String(days), limit: '100' })
      if (includePastDue) q.set('include_past_due', '1')
      const res = await getJson<Res>(`/platform/subscriptions/expiring?${q}`)
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days, includePastDue])

  useEffect(() => {
    void load()
  }, [load])

  function buildFollowupPayload(row: ExpiringRow) {
    const daysLabel =
      row.days_remaining < 0
        ? `已过期 ${Math.abs(row.days_remaining)} 天`
        : `剩余 ${row.days_remaining} 天`
    const endDate = new Date(row.ends_at).toLocaleDateString('zh-CN')
    const next = new Date()
    if (row.days_remaining > 3) next.setDate(next.getDate() + (row.days_remaining <= 7 ? 1 : 2))
    next.setHours(9, 0, 0, 0)
    return {
      note_type: 'call' as const,
      content: `【续费跟进】${row.plan_name}（${statusLabel(row.subscription_status)}，${daysLabel}），到期日 ${endDate}。请主动联系续费/转化。`,
      next_follow_at: next.toISOString(),
    }
  }

  async function createRowFollowup(row: ExpiringRow) {
    setRowCreating(row.tenant_id)
    try {
      await postJson(`/platform/tenants/${row.tenant_id}/ops-notes`, buildFollowupPayload(row))
      window.alert(`已为「${row.tenant_name}」创建回访任务`)
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '创建失败')
    } finally {
      setRowCreating(null)
    }
  }

  async function batchScheduleFollowups() {
    const urgent = data?.list.filter((r) => r.urgency === 'critical' || r.urgency === 'warn').length ?? 0
    const msg = `将为未来 ${days} 天内、≤7 天到期的租户批量创建「续费跟进」回访备注。\n已存在未完成的回访任务将自动跳过。\n\n预计处理约 ${urgent} 家（含已过期若已勾选）。继续？`
    if (!window.confirm(msg)) return
    setScheduling(true)
    try {
      const res = await postJson<{
        created: number
        skipped: number
      }>('/platform/subscriptions/expiring/schedule-followups', {
        days,
        include_past_due: includePastDue,
        urgency_only: true,
        skip_if_open_followup: true,
      })
      window.alert(`已创建 ${res.created} 条回访任务，跳过 ${res.skipped} 家（已有待跟进）`)
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '批量创建失败')
    } finally {
      setScheduling(false)
    }
  }

  async function batchSendReminderEmails(dryRun = false) {
    const urgent = data?.list.filter((r) => r.urgency === 'critical' || r.urgency === 'warn').length ?? 0
    const action = dryRun ? '预览' : '发送'
    const msg = `将向 ≤7 天到期租户管理员${action}续费提醒邮件（约 ${urgent} 家）。\n7 天内已发过将自动跳过；需租户管理员账号已绑定邮箱且具备计费权限。\n\n继续？`
    if (!window.confirm(msg)) return
    setEmailing(true)
    try {
      const res = await postJson<{
        sent: number
        would_send?: number
        skipped: number
        no_email: number
        failed: number
        dry_run?: boolean
      }>('/platform/subscriptions/expiring/send-reminders', {
        days,
        include_past_due: includePastDue,
        urgency_only: true,
        skip_if_emailed: true,
        dry_run: dryRun,
        limit: 50,
      })
      if (dryRun || res.dry_run) {
        window.alert(
          `预览：可发送 ${res.would_send ?? res.sent} 家，跳过 ${res.skipped}，无邮箱 ${res.no_email}`,
        )
      } else {
        window.alert(
          `已发送 ${res.sent} 封，跳过 ${res.skipped}，无邮箱 ${res.no_email}，失败 ${res.failed}`,
        )
      }
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '发送失败')
    } finally {
      setEmailing(false)
    }
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const q = new URLSearchParams({ days: String(days) })
      if (includePastDue) q.set('include_past_due', '1')
      const res = await http.get(`/platform/subscriptions/expiring/export?${q}`, {
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `即将到期订阅-${days}天.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" asChild>
          <Link to="/app/platform">
            <ArrowLeft className="mr-1 h-4 w-4" />
            运营概览
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">即将到期订阅</h1>
          <p className="text-sm text-muted-foreground">
            专业版试用或付费周期将结束的企业，便于提前续费与转化跟进（不含免费体验档）。
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>未来 7 天</option>
          <option value={14}>未来 14 天</option>
          <option value={30}>未来 30 天</option>
        </select>
        <Button
          size="sm"
          variant={includePastDue ? 'default' : 'outline'}
          onClick={() => setIncludePastDue((v) => !v)}
        >
          含近 7 日已过期
        </Button>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          刷新
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={exporting || !data?.list.length}
          onClick={() => void exportCsv()}
        >
          <FileDown className="mr-1 h-3.5 w-3.5" />
          {exporting ? '导出中…' : '导出 CSV'}
        </Button>
        <Button
          size="sm"
          disabled={scheduling || !data?.list.length}
          onClick={() => void batchScheduleFollowups()}
        >
          <PhoneCall className="mr-1 h-3.5 w-3.5" />
          {scheduling ? '创建中…' : '批量创建回访（≤7天）'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={emailing || !data?.list.length}
          onClick={() => void batchSendReminderEmails(false)}
        >
          <Mail className="mr-1 h-3.5 w-3.5" />
          {emailing ? '发送中…' : '邮件提醒租户'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          disabled={emailing || !data?.list.length}
          onClick={() => void batchSendReminderEmails(true)}
        >
          预览
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/app/platform/ops-followups">待回访列表</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            共 {data?.total ?? '—'} 家
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中…</p>
          ) : !data?.list.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              未来 {days} 天内暂无即将到期的付费/试用订阅
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>租户</TableHead>
                  <TableHead>套餐</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>到期日</TableHead>
                  <TableHead>剩余</TableHead>
                  <TableHead>联系人</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.list.map((row) => (
                  <TableRow key={row.tenant_id}>
                    <TableCell className="font-medium">{row.tenant_name}</TableCell>
                    <TableCell>
                      {row.plan_name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {row.billing_cycle === 'yearly' ? '年付' : '月付'}
                      </span>
                    </TableCell>
                    <TableCell>{statusLabel(row.subscription_status)}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(row.ends_at).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell>{urgencyBadge(row.urgency, row.days_remaining)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.contact_name || '—'}
                      {row.contact_phone ? ` · ${row.contact_phone}` : ''}
                    </TableCell>
                    <TableCell className="space-x-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={rowCreating === row.tenant_id}
                        onClick={() => void createRowFollowup(row)}
                      >
                        {rowCreating === row.tenant_id ? '…' : '回访'}
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/app/platform/tenants/${row.tenant_id}`}>详情</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
