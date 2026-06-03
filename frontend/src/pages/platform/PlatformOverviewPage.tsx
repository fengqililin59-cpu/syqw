/**
 * @file 平台方运营概览。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bot,
  Building2,
  CalendarClock,
  CreditCard,
  Gift,
  Mail,
  TrendingUp,
  Users,
} from 'lucide-react'
import { getJson, postJson } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlatformLaunchChecklistCard } from '@/components/PlatformLaunchChecklistCard'
import { PlatformMrrTrendCard } from '@/components/PlatformMrrTrendCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Overview = {
  tenants_total: number
  subscription: {
    trialing: number
    paid_active: number
    experience_free: number
    expired: number
    expiring_within_14_days?: number
  }
  pending_payments: { count: number; amount: number }
  pending_invoice_requests?: number
  promo_codes_available: number
  mrr_estimate_cny: number
  mrr_mom?: {
    current_mrr: number
    previous_mrr: number | null
    delta_pct: number | null
    previous_month: string
    has_previous_snapshot: boolean
  }
  recent_tenants: { id: number; name: string; created_at: string }[]
  inbox_ai_anomalies?: {
    total: number
    critical: number
    warn: number
    days: number
  }
}

function mrrMomHint(mom: Overview['mrr_mom']) {
  if (!mom) return '按当前付费订阅折算'
  if (mom.previous_mrr == null) return `${mom.previous_month} 无快照 · 实时估算`
  if (mom.delta_pct == null) return `上月 ¥${mom.previous_mrr.toLocaleString('zh-CN')}`
  if (mom.delta_pct > 0) return `环比 +${mom.delta_pct}% ↑`
  if (mom.delta_pct < 0) return `环比 ${mom.delta_pct}% ↓`
  return '环比持平'
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string
  value: string | number
  hint?: string
  icon: typeof Users
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}

type DigestChannels = 'both' | 'email' | 'wework'

type DigestPreview = {
  message: string
  can_send?: boolean
  can_send_wework?: boolean
  can_send_email?: boolean
  delivery_mode?: string
  delivery_mode_label?: string
  cron_delivery?: {
    mode_label: string
    will_send_wework: boolean
    will_send_email: boolean
  }
  smtp_configured?: boolean
  sender_tenant_id: number | null
  email_recipients?: string[]
  recipients: {
    id: number
    username: string
    real_name: string | null
    has_wework: boolean
    email?: string | null
  }[]
  stats: {
    churn_total: number
    churn_critical?: number
    followups_due: number
    followups_overdue?: number
    pending_payments: number
    pending_invoices?: number
    expiring_total?: number
    expiring_critical?: number
    inbox_ai_anomaly_total?: number
    inbox_ai_anomaly_critical?: number
    inbox_ai_anomaly_warn?: number
    mrr_delta_pct?: number | null
    mrr_mom_label?: string
  }
}

export function PlatformOverviewPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [atRiskTotal, setAtRiskTotal] = useState<number | null>(null)
  const [dueFollowups, setDueFollowups] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [digestOpen, setDigestOpen] = useState(false)
  const [digestPreview, setDigestPreview] = useState<DigestPreview | null>(null)
  const [digestLoading, setDigestLoading] = useState(false)
  const [digestSending, setDigestSending] = useState(false)

  useEffect(() => {
    Promise.all([
      getJson<Overview>('/platform/overview'),
      getJson<{ total: number }>('/platform/churn-risks?limit=1').catch(() => ({ total: 0 })),
      getJson<{ counts: { due: number } }>('/platform/ops-followups/due?scope=due&limit=1').catch(() => ({
        counts: { due: 0 },
      })),
    ])
      .then(([ov, churn, followups]) => {
        setData(ov)
        setAtRiskTotal(churn.total)
        setDueFollowups(followups.counts?.due ?? 0)
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : '加载失败'))
  }, [])

  async function openDigestPreview() {
    setDigestLoading(true)
    setDigestOpen(true)
    try {
      const preview = await getJson<DigestPreview>('/platform/digest/preview')
      setDigestPreview(preview)
    } catch (e: unknown) {
      setDigestPreview(null)
      window.alert(e instanceof Error ? e.message : '加载摘要失败')
      setDigestOpen(false)
    } finally {
      setDigestLoading(false)
    }
  }

  async function sendDigestNow(sendChannels: DigestChannels) {
    const canWework = digestPreview?.can_send_wework ?? digestPreview?.can_send
    const canEmail = digestPreview?.can_send_email
    const needWework = sendChannels === 'both' || sendChannels === 'wework'
    const needEmail = sendChannels === 'both' || sendChannels === 'email'
    if ((needWework && !canWework) || (needEmail && !canEmail)) {
      window.alert(
        needWework && needEmail
          ? '无法发送：请配置企微或邮件（见上方提示）'
          : needWework
            ? '无法发送企微：请检查 PLATFORM_ADMIN 与 wework_userid'
            : '无法发送邮件：请配置 SMTP_* 与收件邮箱',
      )
      return
    }
    const label =
      sendChannels === 'both' ? '企微 + 邮件' : sendChannels === 'email' ? '仅邮件' : '仅企微'
    if (!window.confirm(`确定通过「${label}」发送今日运营摘要？`)) return
    setDigestSending(true)
    try {
      const r = await postJson<{
        wework?: { sent: number }
        email?: { sent: number }
      }>('/platform/digest/send', { channels: sendChannels })
      const msg = [
        r.wework?.sent ? `企微 ${r.wework.sent} 人` : null,
        r.email?.sent ? `邮件 ${r.email.sent} 封` : null,
      ]
        .filter(Boolean)
        .join('，')
      window.alert(msg || '已提交发送')
      setDigestOpen(false)
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '发送失败')
    } finally {
      setDigestSending(false)
    }
  }

  if (err) return <p className="text-sm text-destructive">{err}</p>
  if (!data) return <p className="text-sm text-muted-foreground">加载中…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">平台运营概览</h1>
        <p className="mt-1 text-sm text-muted-foreground">全站租户、订阅与收款一览（仅平台超管可见）。</p>
      </div>

      <PlatformLaunchChecklistCard />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard title="注册企业" value={data.tenants_total} icon={Building2} />
        <StatCard title="付费使用中" value={data.subscription.paid_active} hint="专业版/企业版" icon={TrendingUp} />
        <StatCard
          title="待确认收款"
          value={data.pending_payments.count}
          hint={`合计 ¥${data.pending_payments.amount.toLocaleString('zh-CN')}`}
          icon={CreditCard}
        />
        <StatCard
          title="待处理开票"
          value={data.pending_invoice_requests ?? 0}
          hint="租户发票申请"
          icon={Mail}
        />
        <StatCard
          title="估算 MRR"
          value={`¥${(data.mrr_mom?.current_mrr ?? data.mrr_estimate_cny).toLocaleString('zh-CN')}`}
          hint={mrrMomHint(data.mrr_mom)}
          icon={TrendingUp}
        />
      </div>

      {(data.pending_invoice_requests ?? 0) > 0 ? (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-amber-950">
              有 <strong>{data.pending_invoice_requests}</strong> 笔开票申请待处理。
            </p>
            <Button size="sm" asChild>
              <Link to="/app/platform/billing">去处理</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <PlatformMrrTrendCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">订阅分布</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>专业版试用中</span>
              <Badge variant="secondary">{data.subscription.trialing}</Badge>
            </div>
            <div className="flex justify-between">
              <span>体验版（免费档）</span>
              <Badge variant="secondary">{data.subscription.experience_free}</Badge>
            </div>
            <div className="flex justify-between">
              <span>已过期/取消</span>
              <Badge variant="secondary">{data.subscription.expired}</Badge>
            </div>
            <div className="flex justify-between">
              <span>14 天内到期（付费/试用）</span>
              <Badge variant={(data.subscription.expiring_within_14_days ?? 0) > 0 ? 'default' : 'secondary'}>
                {data.subscription.expiring_within_14_days ?? 0}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>可用兑换码</span>
              <Badge variant="secondary">{data.promo_codes_available}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">最近注册</CardTitle>
            <Button size="sm" variant="outline" asChild>
              <Link to="/app/platform/tenants">全部租户</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recent_tenants.map((t) => (
              <Link
                key={t.id}
                to={`/app/platform/tenants/${t.id}`}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
              >
                <span>{t.name}</span>
                <span className="text-xs text-muted-foreground">#{t.id}</span>
              </Link>
            ))}
            {data.recent_tenants.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无租户</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {dueFollowups != null && dueFollowups > 0 ? (
        <Card className="border-violet-200 bg-violet-50/50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-violet-700" />
              <div>
                <p className="font-medium text-violet-950">待平台回访 {dueFollowups} 条</p>
                <p className="text-xs text-violet-900/80">运营备注中设置的「下次跟进」已到期或今日需处理。</p>
              </div>
            </div>
            <Button asChild>
              <Link to="/app/platform/ops-followups">去回访</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-slate-200 bg-slate-50/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-700" />
            <div>
              <p className="font-medium text-slate-950">平台运营日报</p>
              <p className="text-xs text-slate-700/80">
                每日 08:30 自动推送企微与邮件（SMTP）；也可预览并手动发送。
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void openDigestPreview()}>
            预览 / 发送
          </Button>
        </CardContent>
      </Card>

      {(data.subscription.expiring_within_14_days ?? 0) > 0 ? (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-orange-700" />
              <div>
                <p className="font-medium text-orange-950">
                  即将到期订阅 {data.subscription.expiring_within_14_days} 家
                </p>
                <p className="text-xs text-orange-900/80">
                  未来 14 天内试用或付费周期将结束，建议提前联系续费。
                </p>
              </div>
            </div>
            <Button asChild>
              <Link to="/app/platform/subscriptions/expiring">查看到期名单</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {atRiskTotal != null && atRiskTotal > 0 ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
              <div>
                <p className="font-medium text-amber-950">流失风险租户 {atRiskTotal} 家</p>
                <p className="text-xs text-amber-900/80">建议优先联系试用将尽、长期未登录或 AI/跟进停滞的企业。</p>
              </div>
            </div>
            <Button asChild>
              <Link to="/app/platform/churn-risks">查看名单</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {(data.inbox_ai_anomalies?.total ?? 0) > 0 ? (
        <Card
          className={
            (data.inbox_ai_anomalies?.critical ?? 0) > 0
              ? 'border-red-200 bg-red-50/50'
              : 'border-violet-200 bg-violet-50/50'
          }
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-700" />
              <div>
                <p className="font-medium text-violet-950">
                  AI 自动发异常 {data.inbox_ai_anomalies?.total} 家
                  {(data.inbox_ai_anomalies?.critical ?? 0) > 0
                    ? `（严重 ${data.inbox_ai_anomalies?.critical}）`
                    : ''}
                </p>
                <p className="text-xs text-violet-900/80">
                  近 {data.inbox_ai_anomalies?.days ?? 7} 日抽检失败、积压或护栏频繁跳过，建议抽检或平台关停。
                </p>
              </div>
            </div>
            <Button asChild variant={(data.inbox_ai_anomalies?.critical ?? 0) > 0 ? 'destructive' : 'default'}>
              <Link to="/app/platform/inbox-ai-anomalies">查看名单</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/app/platform/billing">订单与兑换码</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/app/platform/subscriptions/expiring">
            <CalendarClock className="mr-1 h-4 w-4" />
            即将到期
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/app/platform/inbox-ai-anomalies">
            <Bot className="mr-1 h-4 w-4" />
            AI 异常
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/app/platform/churn-risks">
            <AlertTriangle className="mr-1 h-4 w-4" />
            流失风险
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/app/platform/ops-followups">
            <CalendarClock className="mr-1 h-4 w-4" />
            待回访
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/app/platform/tenants">
            <Users className="mr-1 h-4 w-4" />
            租户管理
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/app/platform/billing">
            <Gift className="mr-1 h-4 w-4" />
            创建兑换码
          </Link>
        </Button>
      </div>

      <Dialog open={digestOpen} onOpenChange={setDigestOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>平台运营日报</DialogTitle>
          </DialogHeader>
          {digestLoading ? (
            <p className="text-sm text-muted-foreground">生成中…</p>
          ) : digestPreview ? (
            <div className="space-y-3">
              {digestPreview.delivery_mode_label ? (
                <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950">
                  环境默认投递：<strong>{digestPreview.delivery_mode_label}</strong>
                  {digestPreview.cron_delivery ? (
                    <>
                      {' '}
                      · 定时任务将发：
                      {digestPreview.cron_delivery.will_send_wework ? '企微 ' : ''}
                      {digestPreview.cron_delivery.will_send_email ? '邮件' : ''}
                      {!digestPreview.cron_delivery.will_send_wework &&
                      !digestPreview.cron_delivery.will_send_email
                        ? '（无渠道，请检查配置）'
                        : null}
                    </>
                  ) : null}
                  {digestPreview.delivery_mode === 'email_only' ? (
                    <span className="block mt-1 text-blue-800/80">
                      仅邮件模式：无需企微即可每日 08:30 收日报（PLATFORM_OPS_DIGEST_DELIVERY=email_only）。
                    </span>
                  ) : null}
                </p>
              ) : null}
              {!(digestPreview.can_send_wework ?? digestPreview.can_send) ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  企微：需 PLATFORM_ADMIN_USER_IDS、超管 wework_userid 及已配企微租户（可选
                  PLATFORM_DIGEST_TENANT_ID）。
                </p>
              ) : null}
              {!digestPreview.can_send_email ? (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  邮件：需配置 SMTP_*，并在超管 users.email 或 PLATFORM_OPS_DIGEST_EMAILS 中填写收件地址。
                </p>
              ) : null}
              {digestPreview.stats ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {digestPreview.stats.mrr_delta_pct != null ? (
                    <Badge
                      variant="secondary"
                      className={
                        digestPreview.stats.mrr_delta_pct > 0
                          ? 'border-green-200 bg-green-50 text-green-800'
                          : digestPreview.stats.mrr_delta_pct < 0
                            ? 'border-red-200 bg-red-50 text-red-800'
                            : ''
                      }
                    >
                      MRR 环比{' '}
                      {digestPreview.stats.mrr_delta_pct > 0 ? '+' : ''}
                      {digestPreview.stats.mrr_delta_pct}%
                    </Badge>
                  ) : null}
                  {(digestPreview.stats.expiring_total ?? 0) > 0 ? (
                    <Badge variant="secondary">
                      14 天内到期 {digestPreview.stats.expiring_total}
                    </Badge>
                  ) : null}
                  {(digestPreview.stats.pending_invoices ?? 0) > 0 ? (
                    <Badge variant="secondary">
                      待开票 {digestPreview.stats.pending_invoices}
                    </Badge>
                  ) : null}
                  {(digestPreview.stats.churn_total ?? 0) > 0 ? (
                    <Badge variant="secondary">流失风险 {digestPreview.stats.churn_total}</Badge>
                  ) : null}
                  {(digestPreview.stats.inbox_ai_anomaly_total ?? 0) > 0 ? (
                    <Badge
                      variant="secondary"
                      className={
                        (digestPreview.stats.inbox_ai_anomaly_critical ?? 0) > 0
                          ? 'border-red-200 bg-red-50 text-red-800'
                          : 'border-violet-200 bg-violet-50 text-violet-900'
                      }
                    >
                      AI 异常 {digestPreview.stats.inbox_ai_anomaly_total}
                      {(digestPreview.stats.inbox_ai_anomaly_critical ?? 0) > 0
                        ? `（严重 ${digestPreview.stats.inbox_ai_anomaly_critical}）`
                        : ''}
                    </Badge>
                  ) : null}
                  {(digestPreview.stats.followups_due ?? 0) > 0 ? (
                    <Badge variant="secondary">待回访 {digestPreview.stats.followups_due}</Badge>
                  ) : null}
                </div>
              ) : null}
              <pre className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
                {digestPreview.message}
              </pre>
              <p className="text-xs text-muted-foreground">
                企微接收：
                {digestPreview.recipients
                  .map((r) => `${r.real_name || r.username}${r.has_wework ? '' : '（未绑企微）'}`)
                  .join('、')}
              </p>
              {digestPreview.email_recipients?.length ? (
                <p className="text-xs text-muted-foreground">
                  邮件接收：{digestPreview.email_recipients.join('、')}
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDigestOpen(false)}>
              关闭
            </Button>
            <Button
              variant="secondary"
              disabled={digestLoading || digestSending || !digestPreview?.can_send_email}
              onClick={() => void sendDigestNow('email')}
            >
              {digestSending ? '发送中…' : '仅发邮件'}
            </Button>
            <Button
              variant="secondary"
              disabled={
                digestLoading ||
                digestSending ||
                !(digestPreview?.can_send_wework ?? digestPreview?.can_send)
              }
              onClick={() => void sendDigestNow('wework')}
            >
              仅发企微
            </Button>
            <Button
              disabled={
                digestLoading ||
                digestSending ||
                !(
                  (digestPreview?.can_send_wework ?? digestPreview?.can_send) ||
                  digestPreview?.can_send_email
                )
              }
              onClick={() => void sendDigestNow('both')}
            >
              {digestSending ? '发送中…' : '企微+邮件'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
