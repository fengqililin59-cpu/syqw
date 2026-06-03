/**
 * @file 平台运营：全站流失风险租户列表。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Mail, PhoneCall } from 'lucide-react'
import { getJson, postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ChurnTenant = {
  tenant_id: number
  tenant_name: string
  plan_code: string | null
  plan_name: string | null
  subscription_status: string | null
  level: 'warn' | 'critical'
  risk_count: number
  risks: { code: string; level: string; title: string; detail: string }[]
}

type Res = {
  list: ChurnTenant[]
  total: number
  scanned: number
  cap: number
}

function buildChurnFollowupPayload(row: ChurnTenant) {
  const levelLabel = row.level === 'critical' ? '严重' : '关注'
  const titles = row.risks.map((r) => r.title).join('、')
  const next = new Date()
  if (row.level !== 'critical') next.setDate(next.getDate() + 1)
  next.setHours(9, 0, 0, 0)
  return {
    note_type: 'call' as const,
    content: `【流失挽回·${levelLabel}】${titles}。请主动联系了解使用情况并推动续费/激活。`,
    next_follow_at: next.toISOString(),
  }
}

export function PlatformChurnRisksPage() {
  const [data, setData] = useState<Res | null>(null)
  const [level, setLevel] = useState<'' | 'critical' | 'warn'>('')
  const [loading, setLoading] = useState(true)
  const [scheduling, setScheduling] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [rowCreating, setRowCreating] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ limit: '100' })
      if (level) q.set('level', level)
      const res = await getJson<Res>(`/platform/churn-risks?${q}`)
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [level])

  useEffect(() => {
    void load()
  }, [load])

  async function createRowFollowup(row: ChurnTenant) {
    setRowCreating(row.tenant_id)
    try {
      await postJson(`/platform/tenants/${row.tenant_id}/ops-notes`, buildChurnFollowupPayload(row))
      window.alert(`已为「${row.tenant_name}」创建回访任务`)
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '创建失败')
    } finally {
      setRowCreating(null)
    }
  }

  async function batchSendReminderEmails(dryRun = false) {
    const criticalCount = data?.list.filter((r) => r.level === 'critical').length ?? 0
    const action = dryRun ? '预览' : '发送'
    if (
      !window.confirm(
        `将向「严重」风险租户管理员${action}使用提醒邮件（约 ${criticalCount} 家）。\n7 天内已发过将跳过。继续？`,
      )
    ) {
      return
    }
    setEmailing(true)
    try {
      const res = await postJson<{
        sent: number
        would_send?: number
        skipped: number
        no_email: number
        failed: number
        dry_run?: boolean
      }>('/platform/churn-risks/send-reminders', {
        critical_only: true,
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

  async function batchScheduleFollowups() {
    const criticalCount = data?.list.filter((r) => r.level === 'critical').length ?? 0
    const msg = `将为「严重」风险租户批量创建「流失挽回」回访备注（约 ${criticalCount} 家，以扫描结果为准）。\n已存在未完成的回访任务将自动跳过。继续？`
    if (!window.confirm(msg)) return
    setScheduling(true)
    try {
      const res = await postJson<{ created: number; skipped: number }>(
        '/platform/churn-risks/schedule-followups',
        { critical_only: true, skip_if_open_followup: true },
      )
      window.alert(`已创建 ${res.created} 条回访任务，跳过 ${res.skipped} 家（已有待跟进）`)
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '批量创建失败')
    } finally {
      setScheduling(false)
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
          <h1 className="text-2xl font-semibold">流失风险租户</h1>
          <p className="text-sm text-muted-foreground">
            根据登录、AI 用量、跟进频率等规则扫描，便于主动回访挽回。
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={level === '' ? 'default' : 'outline'} onClick={() => setLevel('')}>
          全部
        </Button>
        <Button size="sm" variant={level === 'critical' ? 'default' : 'outline'} onClick={() => setLevel('critical')}>
          严重
        </Button>
        <Button size="sm" variant={level === 'warn' ? 'default' : 'outline'} onClick={() => setLevel('warn')}>
          关注
        </Button>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          刷新
        </Button>
        <Button
          size="sm"
          disabled={scheduling || !data?.list.length}
          onClick={() => void batchScheduleFollowups()}
        >
          <PhoneCall className="mr-1 h-3.5 w-3.5" />
          {scheduling ? '创建中…' : '批量创建回访（严重）'}
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

      {data ? (
        <p className="text-xs text-muted-foreground">
          已扫描最近 {data.scanned} 个租户（上限 {data.cap}），命中 {data.total} 个风险租户
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            风险列表
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>企业</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead>等级</TableHead>
                <TableHead>风险项</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>加载中…</TableCell>
                </TableRow>
              ) : !data?.list.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    暂无风险租户（或筛选无结果）
                  </TableCell>
                </TableRow>
              ) : (
                data.list.map((row) => (
                  <TableRow key={row.tenant_id}>
                    <TableCell>
                      <span className="font-medium">{row.tenant_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">#{row.tenant_id}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.plan_name || row.plan_code || '—'}
                      {row.subscription_status ? (
                        <span className="block text-xs text-muted-foreground">{row.subscription_status}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {row.level === 'critical' ? (
                        <Badge variant="destructive">严重</Badge>
                      ) : (
                        <Badge className="bg-amber-500 hover:bg-amber-500">关注</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md text-xs text-muted-foreground">
                      <ul className="list-inside list-disc space-y-0.5">
                        {row.risks.map((r) => (
                          <li key={r.code}>
                            <span className="text-foreground">{r.title}</span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
