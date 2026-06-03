/**
 * @file 平台方 · 单租户详情：开通、延试用、流失风险、运营回访备注。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { AlertTriangle, Bot, FileDown, Gift, Mail } from 'lucide-react'
import {
  downloadPlatformTenantStatement,
  sendPlatformTenantReminder,
} from '@/api/platformBilling'
import { getJson, postJson, patchJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PlatformTenantAiAuditCard } from '@/components/platform/PlatformTenantAiAuditCard'

type OpsNote = {
  id: number
  note_type: string
  content: string
  next_follow_at: string | null
  created_at: string
  author: { username: string; real_name: string | null } | null
}

type TenantDetail = {
  tenant: { id: number; name: string; contact_name: string | null; contact_phone: string | null; created_at: string }
  subscription: {
    plan: { name: string; code: string } | null
    subscription: { status: string; trial_ends_at: string | null; current_period_end: string | null }
    days_remaining: number
    usage: { customers_count: number; seats_count: number; ai_calls_used?: number }
  }
  users: {
    id: number
    username: string
    real_name: string | null
    email?: string | null
    role: string
    last_login_at: string | null
  }[]
  payments: {
    id: number
    amount: number
    status: string
    plan: { name: string } | null
    created_at: string
    out_trade_no: string
  }[]
  promo_redemptions: { promo_code: string; plan_name: string; redeemed_at: string }[]
  churn_risk?: {
    level: 'ok' | 'warn' | 'critical'
    risks: { code: string; level: string; title: string; detail: string }[]
  }
  inbox_ai?: {
    platform_disabled: boolean
    tenant_auto_send_faq: boolean
    tenant_auto_send_pricing: boolean
    metrics_7d?: {
      days: number
      auto_sent: number
      qa_failed: number
      qa_pending: number
      skip_count: number
      anomaly_level: 'warn' | 'critical' | null
      anomaly_reasons: { code: string; title: string; detail: string }[]
    } | null
  }
  ops_notes?: OpsNote[]
}

const NOTE_TYPE_LABEL: Record<string, string> = {
  call: '电话',
  wechat: '企微',
  email: '邮件',
  other: '其他',
}

function fmt(s?: string | null) {
  return s ? dayjs(s).format('YYYY-MM-DD HH:mm') : '—'
}

export function PlatformTenantDetailPage() {
  const { tenantId } = useParams()
  const [data, setData] = useState<TenantDetail | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [trialDays, setTrialDays] = useState(14)
  const [noteType, setNoteType] = useState('call')
  const [noteContent, setNoteContent] = useState('')
  const [noteNextFollow, setNoteNextFollow] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [statementMonth, setStatementMonth] = useState(dayjs().format('YYYY-MM'))
  const [exportingBill, setExportingBill] = useState(false)
  const [sendingMail, setSendingMail] = useState<'expiring' | 'churn' | null>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    const d = await getJson<TenantDetail>(`/platform/tenants/${tenantId}`)
    setData(d)
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  async function grant(planCode: string) {
    if (!tenantId) return
    if (!window.confirm(`确认为该企业开通 ${planCode === 'enterprise' ? '企业版' : '专业版'}（年付）？`)) return
    await postJson(`/platform/tenants/${tenantId}/subscription`, { plan_code: planCode, billing_cycle: 'yearly' })
    setMsg(`已开通 ${planCode === 'enterprise' ? '企业版' : '专业版'}（年付）`)
    await load()
  }

  async function extendTrial(days?: number) {
    if (!tenantId) return
    const d = days ?? trialDays
    if (!window.confirm(`确认延长专业版试用 ${d} 天？`)) return
    await postJson(`/platform/tenants/${tenantId}/extend-trial`, { days: d })
    setMsg(`已延长 ${d} 天专业版试用`)
    await load()
  }

  async function downloadStatement(format: 'pdf' | 'html' = 'pdf') {
    if (!tenantId) return
    setExportingBill(true)
    try {
      await downloadPlatformTenantStatement(Number(tenantId), {
        month: statementMonth || undefined,
        format,
      })
      setMsg(format === 'pdf' ? '账单 PDF 已下载' : '账单 HTML 已下载')
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExportingBill(false)
    }
  }

  async function sendReminder(kind: 'expiring' | 'churn') {
    if (!tenantId) return
    const label = kind === 'expiring' ? '续费/到期' : '流失挽回'
    if (!window.confirm(`向该租户管理员发送「${label}」提醒邮件？\n7 天内已发过同类型将跳过。`)) return
    setSendingMail(kind)
    try {
      const res = await sendPlatformTenantReminder(Number(tenantId), kind, {
        skip_if_emailed: true,
        ...(kind === 'churn' ? { force: churn?.level !== 'ok' } : {}),
      })
      if (res.skipped) {
        setMsg(res.reason || '已跳过发送')
      } else if (res.no_email) {
        window.alert('未找到管理员邮箱：请确保有带 settings:manage 权限且已填写邮箱的账号')
      } else {
        setMsg(`已发送至 ${res.email}`)
        await load()
      }
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '发送失败')
    } finally {
      setSendingMail(null)
    }
  }

  async function saveOpsNote() {
    if (!tenantId || !noteContent.trim()) return
    setSavingNote(true)
    try {
      await postJson(`/platform/tenants/${tenantId}/ops-notes`, {
        note_type: noteType,
        content: noteContent.trim(),
        next_follow_at: noteNextFollow ? new Date(noteNextFollow).toISOString() : null,
      })
      setNoteContent('')
      setNoteNextFollow('')
      setMsg('回访备注已保存')
      await load()
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSavingNote(false)
    }
  }

  async function toggleInboxAiPlatform(disabled: boolean) {
    if (!tenantId) return
    const label = disabled ? '关停' : '恢复'
    if (!window.confirm(`确认${label}该企业收件箱 AI 自动发送？`)) return
    await patchJson(`/platform/tenants/${tenantId}/inbox-ai-controls`, {
      inbox_ai_platform_disabled: disabled,
    })
    setMsg(disabled ? '已关停 AI 自动发送' : '已恢复 AI 自动发送')
    await load()
  }

  if (!data) return <p className="text-sm text-muted-foreground">加载中…</p>

  const sub = data.subscription
  const plan = sub.plan
  const churn = data.churn_risk
  const aiUsed = sub.usage.ai_calls_used ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/platform/tenants">← 租户列表</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/platform/churn-risks">流失风险名单</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/platform/ops-followups">待回访</Link>
        </Button>
        <h1 className="text-2xl font-semibold">{data.tenant.name}</h1>
        <Badge variant="secondary">#{data.tenant.id}</Badge>
      </div>

      {msg ? <p className="text-sm text-green-600">{msg}</p> : null}

      {churn && churn.level !== 'ok' && churn.risks.length > 0 ? (
        <Card className={churn.level === 'critical' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              流失风险 · {churn.level === 'critical' ? '严重' : '关注'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {churn.risks.map((r) => (
                <li key={r.code}>
                  <strong>{r.title}</strong>
                  <span className="text-muted-foreground"> — {r.detail}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {data.inbox_ai ? (
        <Card
          className={
            data.inbox_ai.platform_disabled
              ? 'border-red-300 bg-red-50/40'
              : data.inbox_ai.metrics_7d?.anomaly_level === 'critical'
                ? 'border-red-200 bg-red-50/30'
                : data.inbox_ai.metrics_7d?.anomaly_level === 'warn'
                  ? 'border-amber-200 bg-amber-50/30'
                  : 'border-violet-200 bg-violet-50/30'
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <Bot className="h-4 w-4" />
              收件箱 AI 自动发送（平台管控）
              {data.inbox_ai.metrics_7d?.anomaly_level ? (
                <Badge
                  variant={data.inbox_ai.metrics_7d.anomaly_level === 'critical' ? 'destructive' : 'secondary'}
                >
                  近 {data.inbox_ai.metrics_7d.days} 日异常 ·{' '}
                  {data.inbox_ai.metrics_7d.anomaly_level === 'critical' ? '严重' : '关注'}
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              关停后该企业无法在系统设置中开启 FAQ/询价自动发送；已开启的开关会被关闭。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={data.inbox_ai.platform_disabled ? 'destructive' : 'secondary'}>
                {data.inbox_ai.platform_disabled ? '平台已关停' : '平台允许'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                租户侧：FAQ {data.inbox_ai.tenant_auto_send_faq ? '开' : '关'} · 询价{' '}
                {data.inbox_ai.tenant_auto_send_pricing ? '开' : '关'}
              </span>
              {data.inbox_ai.platform_disabled ? (
                <Button size="sm" variant="outline" onClick={() => void toggleInboxAiPlatform(false)}>
                  恢复自动发送
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => void toggleInboxAiPlatform(true)}>
                  一键关停
                </Button>
              )}
            </div>
            {data.inbox_ai.metrics_7d ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border bg-background/80 px-3 py-2">
                  <p className="text-xs text-muted-foreground">近 {data.inbox_ai.metrics_7d.days} 日自动发送</p>
                  <p className="text-lg font-semibold tabular-nums">{data.inbox_ai.metrics_7d.auto_sent}</p>
                </div>
                <div className="rounded-md border bg-background/80 px-3 py-2">
                  <p className="text-xs text-muted-foreground">抽检失败</p>
                  <p
                    className={`text-lg font-semibold tabular-nums ${data.inbox_ai.metrics_7d.qa_failed > 0 ? 'text-red-700' : ''}`}
                  >
                    {data.inbox_ai.metrics_7d.qa_failed}
                  </p>
                </div>
                <div className="rounded-md border bg-background/80 px-3 py-2">
                  <p className="text-xs text-muted-foreground">待抽检</p>
                  <p className="text-lg font-semibold tabular-nums">{data.inbox_ai.metrics_7d.qa_pending}</p>
                </div>
                <div className="rounded-md border bg-background/80 px-3 py-2">
                  <p className="text-xs text-muted-foreground">护栏跳过</p>
                  <p className="text-lg font-semibold tabular-nums">{data.inbox_ai.metrics_7d.skip_count}</p>
                </div>
              </div>
            ) : null}
            {(data.inbox_ai.metrics_7d?.anomaly_reasons?.length ?? 0) > 0 ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {data.inbox_ai.metrics_7d!.anomaly_reasons.map((r) => (
                  <li key={r.code}>
                    <strong className="text-foreground">{r.title}</strong> — {r.detail}
                  </li>
                ))}
              </ul>
            ) : null}
            {!data.inbox_ai.platform_disabled &&
            (data.inbox_ai.metrics_7d?.anomaly_level === 'critical' ||
              data.inbox_ai.metrics_7d?.anomaly_level === 'warn') ? (
              <Button size="sm" variant="outline" asChild>
                <Link to="/app/platform/inbox-ai-anomalies">查看全站异常名单</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {tenantId ? <PlatformTenantAiAuditCard tenantId={Number(tenantId)} /> : null}

      <Card className="border-sky-200 bg-sky-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">账单与邮件提醒</CardTitle>
          <CardDescription>导出该租户订阅账单；向管理员邮箱发送续费或流失提醒（需 SMTP）。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">账单月份</Label>
            <Input
              type="month"
              className="h-9 w-40"
              value={statementMonth}
              onChange={(e) => setStatementMonth(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={exportingBill}
            onClick={() => void downloadStatement('pdf')}
          >
            <FileDown className="mr-1 h-3.5 w-3.5" />
            {exportingBill ? '导出中…' : '下载账单 PDF'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            disabled={exportingBill}
            onClick={() => void downloadStatement('html')}
          >
            HTML
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={sendingMail !== null}
            onClick={() => void sendReminder('expiring')}
          >
            <Mail className="mr-1 h-3.5 w-3.5" />
            {sendingMail === 'expiring' ? '发送中…' : '到期提醒邮件'}
          </Button>
          {churn && churn.level !== 'ok' ? (
            <Button
              size="sm"
              variant="outline"
              disabled={sendingMail !== null}
              onClick={() => void sendReminder('churn')}
            >
              <Mail className="mr-1 h-3.5 w-3.5" />
              {sendingMail === 'churn' ? '发送中…' : '流失提醒邮件'}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-violet-200 bg-violet-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">运营快捷操作</CardTitle>
          <CardDescription>延长试用、开通套餐、创建兑换码（挽回流失风险租户）。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>延长试用（天）</Label>
              <Input
                type="number"
                min={1}
                max={90}
                className="w-24"
                value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value) || 14)}
              />
            </div>
            <Button size="sm" onClick={() => void extendTrial()}>
              延长专业版试用
            </Button>
            <Button size="sm" variant="outline" onClick={() => void extendTrial(7)}>
              +7 天
            </Button>
            <Button size="sm" variant="outline" onClick={() => void extendTrial(30)}>
              +30 天
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void grant('pro')}>
              开通专业版（年）
            </Button>
            <Button size="sm" variant="outline" onClick={() => void grant('enterprise')}>
              开通企业版（年）
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/app/platform/billing">
                <Gift className="mr-1 h-4 w-4" />
                创建兑换码
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">订阅信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              当前套餐：<strong>{plan?.code === 'free' ? '体验版' : plan?.name || '—'}</strong>
            </p>
            <p>
              状态：<Badge variant="secondary">{sub.subscription.status}</Badge>
              {sub.days_remaining >= 0 ? ` · 剩余 ${sub.days_remaining} 天` : null}
            </p>
            <p>试用截止：{fmt(sub.subscription.trial_ends_at)}</p>
            <p>付费到期：{fmt(sub.subscription.current_period_end)}</p>
            <p>
              用量：客户 {sub.usage.customers_count} · 席位 {sub.usage.seats_count}
              {aiUsed >= 0 ? ` · 本月 AI ${aiUsed} 次` : null}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">联系信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>联系人：{data.tenant.contact_name || '—'}</p>
            <p>电话：{data.tenant.contact_phone || '—'}</p>
            <p>注册时间：{fmt(data.tenant.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">运营回访备注</CardTitle>
          <CardDescription>仅平台超管可见，用于记录电话/企微回访与下次跟进时间。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[120px_1fr_160px_auto]">
            <div className="space-y-1">
              <Label>方式</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={noteType}
                onChange={(e) => setNoteType(e.target.value)}
              >
                <option value="call">电话</option>
                <option value="wechat">企微</option>
                <option value="email">邮件</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>备注内容</Label>
              <Input
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="例：已电话沟通，愿意续费，需申请折扣"
              />
            </div>
            <div className="space-y-1">
              <Label>下次跟进</Label>
              <Input
                type="datetime-local"
                value={noteNextFollow}
                onChange={(e) => setNoteNextFollow(e.target.value)}
              />
            </div>
            <Button className="md:self-end" size="sm" disabled={savingNote} onClick={() => void saveOpsNote()}>
              {savingNote ? '保存中…' : '保存备注'}
            </Button>
          </div>

          {(data.ops_notes?.length ?? 0) > 0 ? (
            <ul className="space-y-2">
              {data.ops_notes!.map((n) => (
                <li key={n.id} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{NOTE_TYPE_LABEL[n.note_type] || n.note_type}</Badge>
                    <span>{fmt(n.created_at)}</span>
                    {n.author ? (
                      <span>
                        {n.author.real_name || n.author.username}
                      </span>
                    ) : null}
                    {n.next_follow_at ? (
                      <span className="text-amber-700">下次：{fmt(n.next_follow_at)}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-foreground">{n.content}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">暂无回访记录，挽回客户时建议留下沟通摘要。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">账号列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>最近登录</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.real_name || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.email || '—'}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell>{fmt(u.last_login_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">支付与兑换记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{fmt(p.created_at)}</TableCell>
                  <TableCell>{p.plan?.name || '—'}</TableCell>
                  <TableCell>¥{p.amount}</TableCell>
                  <TableCell>{p.status}</TableCell>
                </TableRow>
              ))}
              {data.payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    暂无支付记录
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          {data.promo_redemptions.length > 0 ? (
            <div className="text-sm text-muted-foreground">
              兑换码：
              {data.promo_redemptions.map((r) => (
                <span key={r.promo_code} className="mr-3">
                  {r.promo_code} → {r.plan_name}（{fmt(r.redeemed_at)}）
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
