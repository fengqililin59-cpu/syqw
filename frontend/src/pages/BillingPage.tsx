import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileDown } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { isWechatInAppBrowser } from '@/lib/wechatPay'
import dayjs from 'dayjs'
import { getJson, http, postJson } from '@/api/client'
import { ALIPAY_UI_ENABLED } from '@/config/paymentFeatures'
import { hasPermUser } from '@/lib/roles'
import { useAuthStore } from '@/store/authStore'
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { PlanFeatureComparisonTable } from '@/components/PlanFeatureComparisonTable'
import { OnlinePayCheckoutDialog, type OnlinePayChannel } from '@/components/OnlinePayCheckoutDialog'
import { BillingInvoiceSection } from '@/components/BillingInvoiceSection'
import { BalanceSection } from '@/components/BalanceSection'
import { AddonSection } from '@/components/AddonSection'
import {
  AI_FEATURE_ROWS,
  AI_PLAN_COLUMNS,
  CRM_FEATURE_ROWS,
  CRM_PLAN_COLUMNS,
} from '@/lib/planComparison'

interface Plan {
  id: number
  name: string
  code: string
  price_monthly: number
  price_yearly: number
  customers_limit: number
  seats_limit: number
  broadcasts_monthly: number
  ai_calls_monthly: number
  features: string[]
}

interface SubscriptionData {
  subscription: {
    status: 'trialing' | 'active' | 'expired' | 'cancelled'
    trial_ends_at: string | null
    current_period_end: string | null
    billing_cycle: string
    is_trial?: boolean
  }
  plan: Plan
  usage: {
    customers_count: number
    seats_count: number
    broadcasts_used: number
    ai_calls_used: number
  }
  is_expired: boolean
  days_remaining: number
}

type PendingOnlineRow = {
  out_trade_no: string
  pay_channel?: 'wechat' | 'alipay'
  pay_code_url: string | null
  pay_mode?: 'native' | 'jsapi' | null
  amount: number
  billing_cycle: 'monthly' | 'yearly'
  plan: { name: string; code: string } | null
  created_at: string
}

type PaymentRow = {
  id: number
  plan: { id: number; name: string; code: string } | null
  billing_cycle: 'monthly' | 'yearly'
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  pay_channel?: 'wechat' | 'alipay' | 'manual'
  out_trade_no: string
  created_at: string
  remark?: string | null
}

function formatCny(amount: number) {
  return Number(amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
}

function formatDate(s?: string | null) {
  return s ? dayjs(s).format('YYYY-MM-DD HH:mm') : '—'
}

function planDisplayName(plan: Plan, status?: SubscriptionData['subscription']['status']) {
  if (plan.code === 'free') return '体验版'
  if (status === 'trialing') return `${plan.name}（试用中）`
  return plan.name
}

function UsageBar({ label, used, limit, unit = '个' }: { label: string; used: number; limit: number; unit?: string }) {
  if (limit === -1) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          <span>
            {used} {unit}（不限）
          </span>
        </div>
        <div className="h-2 rounded bg-green-500" />
      </div>
    )
  }
  const pct = Math.min(Math.round((used / Math.max(1, limit)) * 100), 100)
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span>
          {used} / {limit} {unit}
        </span>
      </div>
      <div className="h-2 rounded bg-gray-200">
        <div className={`${color} h-2 rounded`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function BillingPage() {
  const perms = useAuthStore((s) => s.permissions)
  const canManage = hasPermUser(perms, 'settings:manage')
  const { isPlatformAdmin } = usePlatformAdmin()
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [pickPlan, setPickPlan] = useState<Plan | null>(null)
  const [remark, setRemark] = useState('')
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null)
  const [onlineCheckout, setOnlineCheckout] = useState<{
    channel: OnlinePayChannel
    plan_code: string
    plan_name: string
    billing_cycle: 'monthly' | 'yearly'
    amount_label: string
  } | null>(null)
  const [wechatEnabled, setWechatEnabled] = useState(false)
  const [alipayEnabled, setAlipayEnabled] = useState(false)
  const [pendingOnline, setPendingOnline] = useState<PendingOnlineRow[]>([])
  const [resumeOnline, setResumeOnline] = useState<{
    channel: OnlinePayChannel
    out_trade_no: string
    code_url: string
    pay_mode?: 'native' | 'jsapi' | null
  } | null>(null)
  const [wechatJsapiEnabled, setWechatJsapiEnabled] = useState(false)
  const [statementMonth, setStatementMonth] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()

  const paidPayments = useMemo(
    () => payments.filter((p) => p.status === 'paid'),
    [payments],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [subData, plansData] = await Promise.all([
        getJson<SubscriptionData>('/billing/subscription'),
        getJson<Plan[]>('/billing/plans'),
      ])
      setData(subData)
      setPlans(plansData)
      if (canManage) {
        const [pay, channels, pending] = await Promise.all([
          getJson<{ list: PaymentRow[] }>('/billing/payments?page=1&size=20'),
          getJson<{
            wechat: { enabled: boolean; jsapi_enabled?: boolean }
            alipay: { enabled: boolean }
          }>(
            '/billing/payment/channels',
          ).catch(() => ({
            wechat: { enabled: false, jsapi_enabled: false },
            alipay: { enabled: false },
          })),
          getJson<{ list: PendingOnlineRow[] }>('/billing/payments/pending-online').catch(() => ({
            list: [],
          })),
        ])
        setPayments(pay.list || [])
        setWechatEnabled(channels.wechat?.enabled === true)
        setWechatJsapiEnabled(channels.wechat?.jsapi_enabled === true)
        setAlipayEnabled(ALIPAY_UI_ENABLED && channels.alipay?.enabled === true)
        setPendingOnline(pending.list || [])
      } else {
        setPayments([])
        setWechatEnabled(false)
        setAlipayEnabled(false)
        setPendingOnline([])
      }
    } finally {
      setLoading(false)
    }
  }, [canManage])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const oauth = searchParams.get('wx_pay_oauth')
    if (oauth === 'ok') {
      void load()
      searchParams.delete('wx_pay_oauth')
      setSearchParams(searchParams, { replace: true })
    }
    if (oauth === 'fail') {
      window.alert('微信授权失败，请重试或使用扫码支付')
      searchParams.delete('wx_pay_oauth')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, load])

  const currentPlan = data?.plan
  const status = data?.subscription.status
  const warnSoon = (data?.days_remaining ?? 999) <= 7
  const isTrialingPro = status === 'trialing' && currentPlan?.code === 'pro'
  const isExperienceFree = currentPlan?.code === 'free' && status === 'active'
  const crmPlans = plans.filter((p) => !p.code.startsWith('ai_'))
  const aiPlans = plans.filter((p) => p.code.startsWith('ai_'))
  const proPlan = crmPlans.find((p) => p.code === 'pro')
  const enterprisePlan = crmPlans.find((p) => p.code === 'enterprise')
  const paidPlanPriceHint = useMemo(() => {
    const parts: string[] = []
    if (proPlan) parts.push(`专业版 ${formatCny(proPlan.price_monthly)}/月`)
    if (enterprisePlan) parts.push(`企业版 ${formatCny(enterprisePlan.price_monthly)}/月`)
    return parts.length ? parts.join('、') : '专业版 / 企业版'
  }, [proPlan, enterprisePlan])

  const statusBadge = useMemo(() => {
    if (!status) return <Badge variant="secondary">未知</Badge>
    if (status === 'trialing') return <Badge className="bg-blue-600 hover:bg-blue-600">专业版试用</Badge>
    if (status === 'active' && currentPlan?.code === 'free')
      return <Badge variant="secondary">体验版</Badge>
    if (status === 'active') return <Badge className="bg-green-600 hover:bg-green-600">使用中</Badge>
    if (status === 'expired') return <Badge variant="destructive">已到期</Badge>
    return <Badge variant="secondary">已取消</Badge>
  }, [status, currentPlan?.code])

  function openOnlinePay(
    channel: OnlinePayChannel,
    p: Plan,
    amountLabel: string,
  ) {
    setResumeOnline(null)
    setOnlineCheckout({
      channel,
      plan_code: p.code,
      plan_name: p.name,
      billing_cycle: cycle,
      amount_label: amountLabel,
    })
  }

  async function submitOrder() {
    if (!pickPlan) return
    await postJson('/billing/payment', {
      plan_code: pickPlan.code,
      billing_cycle: cycle,
      pay_channel: 'manual',
      remark: remark || null,
    })
    window.alert('订单已提交。请完成转账后联系平台方确认收款（租户管理员无法自行确认）。')
    setPickPlan(null)
    setRemark('')
    await load()
  }

  async function exportStatement(format: 'pdf' | 'html' = 'pdf') {
    try {
      const params = {
        format,
        ...(statementMonth ? { month: statementMonth } : { months: 12 }),
      }
      const res = await http.get('/billing/statement/export', { params, responseType: 'blob' })
      const isPdf = format === 'pdf'
      const blob = new Blob([res.data as BlobPart], {
        type: isPdf ? 'application/pdf' : 'text/html;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      if (isPdf) {
        const a = document.createElement('a')
        a.href = url
        a.download = statementMonth
          ? `ZhiFlow-订阅账单-${statementMonth}.pdf`
          : 'ZhiFlow-订阅账单.pdf'
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 30_000)
        return
      }
      const w = window.open(url, '_blank', 'noopener,noreferrer')
      if (!w) {
        const a = document.createElement('a')
        a.href = url
        a.download = 'ZhiFlow-订阅账单.html'
        a.click()
        window.alert('已下载 HTML 账单，用浏览器打开后打印为 PDF')
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '导出失败')
    }
  }

  async function handleRedeem() {
    setRedeemMsg(null)
    try {
      await postJson('/billing/redeem', { code: redeemCode.trim() })
      setRedeemCode('')
      setRedeemMsg('兑换成功，套餐已激活')
      await load()
    } catch (e: unknown) {
      setRedeemMsg(e instanceof Error ? e.message : '兑换失败')
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">加载中…</p>
  if (!data || !currentPlan) return <p className="text-sm text-destructive">计费数据加载失败</p>

  const inWechatBrowser = isWechatInAppBrowser()

  return (
    <div className="space-y-4">
      {inWechatBrowser && wechatJsapiEnabled ? (
        <Card className="border-green-200 bg-green-50/60">
          <CardContent className="pt-4 text-sm text-green-900">
            当前在微信内打开，支付时将直接调起微信支付（无需扫码）。
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-blue-300 bg-gradient-to-br from-blue-50/90 to-slate-50/50">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg text-blue-950">新用户必读：试用与体验版的区别</CardTitle>
              <CardDescription className="text-blue-900/80">
                ZhiFlow 为 B2B 订阅制，不靠免费版广告变现。
              </CardDescription>
            </div>
            {isPlatformAdmin ? (
              <Button size="sm" variant="outline" asChild>
                <Link to="/app/platform">进入平台运营后台 →</Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-blue-950">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>注册即享 14 天专业版全功能试用</strong>（自动化、完整 AI、意向预警等与付费专业版一致）。
              <span className="font-medium"> 这不是体验版试用。</span>
            </li>
            <li>
              <strong>试用到期后自动降为体验版</strong>：永久免费的默认档位，客户数 / 群发 / AI 等有配额上限，部分高级能力不可用。
            </li>
            <li>
              <strong>付费正式开通</strong>：{paidPlanPriceHint}（支持月付 / 年付），也可用兑换码、微信 / 支付宝或线下转账。
            </li>
          </ul>
          {isTrialingPro ? (
            <p className="rounded-lg border border-blue-200 bg-white/80 px-3 py-2">
              您当前为<strong>专业版试用中</strong>，剩余 {data.days_remaining} 天（截止{' '}
              {formatDate(data.subscription.trial_ends_at)}）。到期未付费将自动切换为体验版，数据保留。
            </p>
          ) : null}
          {isExperienceFree ? (
            <p className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-slate-700">
              您当前为<strong>体验版</strong>（试用已结束或未开通付费）。升级专业版可恢复试用期内用过的完整能力。
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canManage && pendingOnline.some((p) => p.pay_code_url) ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">待完成支付</CardTitle>
            <CardDescription>
              2 小时内重复下单将复用同一支付单。微信内打开将自动使用 JSAPI 支付。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingOnline
              .filter((p) => p.pay_code_url)
              .map((p) => (
                <div
                  key={p.out_trade_no}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-white px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{p.plan?.name || '套餐'}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {p.pay_channel === 'alipay' ? '支付宝' : '微信'} · {formatCny(p.amount)} ·{' '}
                      {p.billing_cycle === 'yearly' ? '年付' : '月付'} · {formatDate(p.created_at)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setOnlineCheckout(null)
                      setResumeOnline({
                        channel: p.pay_channel === 'alipay' ? 'alipay' : 'wechat',
                        out_trade_no: p.out_trade_no,
                        code_url: p.pay_code_url!,
                        pay_mode: p.pay_mode ?? (p.pay_code_url?.startsWith('jsapi:') ? 'jsapi' : 'native'),
                      })
                    }}
                  >
                    继续支付
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}

      {warnSoon || data.is_expired ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            data.is_expired || (data.days_remaining ?? 0) <= 3
              ? 'border-orange-400 bg-orange-50 text-orange-950'
              : 'border-blue-300 bg-blue-50 text-blue-950'
          }`}
        >
          {isTrialingPro ? (
            <p>
              <strong>专业版试用剩余 {data.days_remaining} 天</strong>
              （截止 {formatDate(data.subscription.trial_ends_at)}）。到期后自动降为体验版：客户上限 100、月 AI
              100 次、无自动化。建议现在提交订单或使用兑换码，避免销售节奏中断。
            </p>
          ) : null}
          {status === 'active' && currentPlan.code !== 'free' && (data.days_remaining ?? 0) <= 7 ? (
            <p>
              <strong>付费套餐将于 {formatDate(data.subscription.current_period_end)} 到期</strong>
              （剩余 {data.days_remaining} 天），请及时续费。
            </p>
          ) : null}
          {data.is_expired || status === 'expired' ? (
            <p className="text-red-700">套餐已到期，请续费或输入兑换码恢复能力。</p>
          ) : null}
        </div>
      ) : null}

      <Card className={warnSoon ? 'border-orange-400' : ''}>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            当前套餐：{planDisplayName(currentPlan, status)}
            {statusBadge}
          </CardTitle>
          <CardDescription>
            {isTrialingPro && !warnSoon
              ? `14 天专业版试用，剩余 ${data.days_remaining} 天；到期未付费将自动降为体验版（非继续试用）`
              : null}
            {status === 'active' && currentPlan.code !== 'free' && !warnSoon
              ? `到期时间：${formatDate(data.subscription.current_period_end)}`
              : null}
            {isExperienceFree
              ? '体验版为试用结束后的免费档位（永久可用，配额与功能受限）；非「体验版试用」'
              : null}
          </CardDescription>
          </div>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="month"
                className="h-8 w-36 text-xs"
                value={statementMonth}
                onChange={(e) => setStatementMonth(e.target.value)}
                placeholder={dayjs().format('YYYY-MM')}
                title="留空导出近 12 个月"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => void exportStatement('pdf')}>
                <FileDown className="mr-1 h-3.5 w-3.5" />
                {statementMonth ? '导出该月 PDF' : '下载账单 PDF'}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => void exportStatement('html')}>
                HTML
              </Button>
            </div>
          ) : null}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>为什么选 ZhiFlow？</CardTitle>
          <CardDescription>与「纯 SCRM」或「纯 AI 平台」相比的核心差异（价值对比，非功能数量比拼）。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-3 text-left">维度</th>
                  <th className="bg-blue-50 p-3 text-left font-semibold text-blue-950">ZhiFlow</th>
                  <th className="p-3 text-left text-muted-foreground">传统企微 SCRM</th>
                  <th className="p-3 text-left text-muted-foreground">纯 AI / Agent 平台</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="p-3 font-medium text-foreground">定位</td>
                  <td className="bg-blue-50/50 p-3 text-foreground">私域销售闭环 + 人审 AI</td>
                  <td className="p-3">获客、活码、群发为主</td>
                  <td className="p-3">造 Bot / 工作流</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-medium text-foreground">AI 怎么用</td>
                  <td className="bg-blue-50/50 p-3 text-foreground">跟进话术、意向预警、站内助手；不自动外发</td>
                  <td className="p-3">多为增值插件或没有</td>
                  <td className="p-3">强，但需自己接 CRM</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-medium text-foreground">适合谁</td>
                  <td className="bg-blue-50/50 p-3 text-foreground">5–30 人销售团队、已用企微</td>
                  <td className="p-3">要大厂品牌与全家桶</td>
                  <td className="p-3">技术团队自建</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-foreground">付费方式</td>
                  <td className="bg-blue-50/50 p-3 text-foreground">CRM 套餐 + 可选 AI 加购；微信 / 支付宝 / 兑换码 / 转账</td>
                  <td className="p-3">通常年框 + 实施费</td>
                  <td className="p-3">按 Token / 席位</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">兑换码开通</CardTitle>
            <CardDescription>向平台方索取兑换码后，可在此直接激活套餐（无需等待确认收款）。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1 space-y-1">
              <Label>兑换码</Label>
              <Input
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                placeholder="例如 ZF-PRO-XXXXXXXX"
              />
            </div>
            <Button type="button" onClick={() => void handleRedeem()}>
              立即兑换
            </Button>
            {redeemMsg ? <p className="w-full text-sm text-muted-foreground">{redeemMsg}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>本月用量</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <UsageBar label="客户数" used={data.usage.customers_count} limit={currentPlan.customers_limit} />
          <UsageBar label="席位数" used={data.usage.seats_count} limit={currentPlan.seats_limit} />
          <UsageBar label="本月群发" used={data.usage.broadcasts_used} limit={currentPlan.broadcasts_monthly} unit="次" />
          <UsageBar label="本月AI调用" used={data.usage.ai_calls_used} limit={currentPlan.ai_calls_monthly} unit="次" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>套餐对比</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant={cycle === 'monthly' ? 'default' : 'outline'} onClick={() => setCycle('monthly')}>
              月付
            </Button>
            <Button size="sm" variant={cycle === 'yearly' ? 'default' : 'outline'} onClick={() => setCycle('yearly')}>
              年付
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {crmPlans.map((p) => (
            <div
              key={p.id}
              className={`rounded-lg border p-4 ${currentPlan.code === p.code && status !== 'trialing' ? 'border-2 border-blue-500' : ''}`}
            >
              <h3 className="text-lg font-semibold">{p.code === 'free' ? '体验版' : p.name}</h3>
              {p.code === 'free' ? (
                <p className="text-sm text-muted-foreground">14 天专业版试用结束后的免费档位（非试用）</p>
              ) : p.code === 'pro' ? (
                <p className="text-sm text-muted-foreground">新注册默认 14 天全功能试用，到期需付费续用</p>
              ) : (
                <p>
                  {formatCny(cycle === 'monthly' ? p.price_monthly : p.price_yearly)} / {cycle === 'monthly' ? '月' : '年'}
                </p>
              )}
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>客户数：{p.customers_limit === -1 ? '不限' : p.customers_limit}</li>
                <li>席位：{p.seats_limit === -1 ? '不限' : p.seats_limit}</li>
                <li>月群发：{p.broadcasts_monthly === -1 ? '不限' : p.broadcasts_monthly}</li>
                <li className="font-medium text-violet-700">
                  月 AI 调用：{p.ai_calls_monthly === -1 ? '不限' : `${p.ai_calls_monthly} 次`}
                </li>
              </ul>
              <div className="mt-3">
                {(currentPlan.code === p.code && status !== 'trialing') || (isTrialingPro && p.code === 'pro') ? (
                  <Badge>{isTrialingPro && p.code === 'pro' ? '试用中' : '当前套餐'}</Badge>
                ) : p.code === 'free' ? (
                  <Badge variant="secondary">试用到期后默认</Badge>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {wechatEnabled && p.code !== 'free' ? (
                      <Button
                        disabled={!canManage}
                        onClick={() =>
                          openOnlinePay(
                            'wechat',
                            p,
                            `${formatCny(cycle === 'monthly' ? p.price_monthly : p.price_yearly)} / ${cycle === 'monthly' ? '月' : '年'}`,
                          )
                        }
                      >
                        微信支付
                      </Button>
                    ) : null}
                    {alipayEnabled && p.code !== 'free' ? (
                      <Button
                        disabled={!canManage}
                        variant="secondary"
                        onClick={() =>
                          openOnlinePay(
                            'alipay',
                            p,
                            `${formatCny(cycle === 'monthly' ? p.price_monthly : p.price_yearly)} / ${cycle === 'monthly' ? '月' : '年'}`,
                          )
                        }
                      >
                        支付宝
                      </Button>
                    ) : null}
                    <Button
                      disabled={!canManage || p.code === 'free'}
                      variant={wechatEnabled || alipayEnabled ? 'outline' : 'default'}
                      onClick={() => setPickPlan(p)}
                    >
                      线下转账
                    </Button>
                    {p.code !== 'free' ? (
                      <Button
                        disabled={!canManage}
                        variant="outline"
                        onClick={() => {
                          const el = document.getElementById('balance-section')
                          if (el) el.scrollIntoView({ behavior: 'smooth' })
                        }}
                      >
                        余额充值
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CRM 套餐功能对比</CardTitle>
          <CardDescription>
            新注册先享 14 天专业版试用（全功能）；到期未付费降为体验版。付费专业版适合多数销售团队。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlanFeatureComparisonTable
            title="CRM 套餐功能对比"
            columns={CRM_PLAN_COLUMNS}
            rows={CRM_FEATURE_ROWS}
            plans={crmPlans}
            quotaRow
            description="「有限」表示体验版可用但配额较低。具体客户数、席位、群发次数见上方套餐卡片。"
          />
        </CardContent>
      </Card>

      {aiPlans.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>AI 套餐功能对比</CardTitle>
            <CardDescription>重度使用 AI 的团队可单独加购，不必先升企业版。</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanFeatureComparisonTable
              title="AI 套餐功能对比"
              columns={AI_PLAN_COLUMNS}
              rows={AI_FEATURE_ROWS}
              plans={[...crmPlans.filter((p) => ['free', 'pro'].includes(p.code)), ...aiPlans]}
              quotaRow
            />
          </CardContent>
        </Card>
      ) : null}

      {aiPlans.length > 0 ? (
        <Card className="border-violet-200/80 bg-gradient-to-br from-violet-50/50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              AI 专用套餐
              <Badge className="bg-violet-600 hover:bg-violet-600">推荐</Badge>
            </CardTitle>
            <CardDescription>
              重度使用 AI 智能助手、文案、意向评分的团队，AI 调用额度更高，性价比更优。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {aiPlans.map((p) => (
              <div
                key={p.id}
                className={`rounded-lg border border-violet-200 bg-white p-4 ${currentPlan.code === p.code ? 'ring-2 ring-violet-500' : ''}`}
              >
                <h3 className="text-lg font-semibold text-violet-950">{p.name}</h3>
                <p className="mt-1 text-2xl font-bold text-violet-700">
                  {formatCny(cycle === 'monthly' ? p.price_monthly : p.price_yearly)}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {cycle === 'monthly' ? '月' : '年'}
                  </span>
                </p>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <li className="font-semibold text-violet-800">
                    月 AI 调用：{p.ai_calls_monthly === -1 ? '不限' : `${p.ai_calls_monthly.toLocaleString()} 次`}
                  </li>
                  <li>客户数：{p.customers_limit === -1 ? '不限' : p.customers_limit}</li>
                  <li>席位：{p.seats_limit === -1 ? '不限' : p.seats_limit}</li>
                  <li>含站内 AI 助手、文案、意向预警、话术库</li>
                </ul>
                <div className="mt-4">
                  {currentPlan.code === p.code ? (
                    <Badge>当前套餐</Badge>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {wechatEnabled ? (
                        <Button
                          disabled={!canManage}
                          onClick={() =>
                            openOnlinePay(
                              'wechat',
                              p,
                              `${formatCny(cycle === 'monthly' ? p.price_monthly : p.price_yearly)} / ${cycle === 'monthly' ? '月' : '年'}`,
                            )
                          }
                        >
                          微信支付
                        </Button>
                      ) : null}
                      {alipayEnabled ? (
                        <Button
                          disabled={!canManage}
                          variant="secondary"
                          onClick={() =>
                            openOnlinePay(
                              'alipay',
                              p,
                              `${formatCny(cycle === 'monthly' ? p.price_monthly : p.price_yearly)} / ${cycle === 'monthly' ? '月' : '年'}`,
                            )
                          }
                        >
                          支付宝
                        </Button>
                      ) : null}
                      <Button disabled={!canManage} variant="outline" onClick={() => setPickPlan(p)}>
                        线下转账
                      </Button>
                      <Button
                        disabled={!canManage}
                        variant="outline"
                        onClick={() => {
                          const el = document.getElementById('balance-section')
                          if (el) el.scrollIntoView({ behavior: 'smooth' })
                        }}
                      >
                        余额充值
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canManage ? <BillingInvoiceSection canManage={canManage} paidPayments={paidPayments} /> : null}

      {canManage ? <div id="balance-section"><BalanceSection /></div> : null}

      {canManage ? <AddonSection /> : null}

      <Card>
        <CardContent className="pt-4">
          <Accordion type="single" defaultValue="payments">
            <AccordionItem value="payments">
              <AccordionTrigger value="payments">本企业支付记录</AccordionTrigger>
              <AccordionContent value="payments">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>套餐</TableHead>
                      <TableHead>周期</TableHead>
                      <TableHead>金额</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.created_at)}</TableCell>
                        <TableCell>{p.plan?.name || '—'}</TableCell>
                        <TableCell>{p.billing_cycle === 'yearly' ? '年付' : '月付'}</TableCell>
                        <TableCell>{formatCny(p.amount)}</TableCell>
                        <TableCell>
                          {p.status === 'pending' ? (
                            <Badge className="bg-yellow-500 hover:bg-yellow-500">
                              {p.pay_channel === 'wechat' || p.pay_channel === 'alipay'
                                ? '待支付'
                                : '待平台确认'}
                            </Badge>
                          ) : null}
                          {p.status === 'paid' ? <Badge className="bg-green-600 hover:bg-green-600">已支付</Badge> : null}
                          {p.status === 'failed' ? <Badge variant="destructive">失败</Badge> : null}
                          {p.status === 'refunded' ? <Badge variant="secondary">已退款</Badge> : null}
                        </TableCell>
                        <TableCell>
                          {p.status === 'pending' ? (
                            <span className="text-xs text-muted-foreground">联系平台确认</span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          暂无记录
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <OnlinePayCheckoutDialog
        channel={onlineCheckout?.channel ?? resumeOnline?.channel ?? 'wechat'}
        open={!!onlineCheckout || !!resumeOnline}
        onOpenChange={(o) => {
          if (!o) {
            setOnlineCheckout(null)
            setResumeOnline(null)
          }
        }}
        payload={
          onlineCheckout
            ? {
                plan_code: onlineCheckout.plan_code,
                plan_name: onlineCheckout.plan_name,
                billing_cycle: onlineCheckout.billing_cycle,
                amount_label: onlineCheckout.amount_label,
              }
            : null
        }
        resumeOrder={resumeOnline}
        onPaid={() => {
          setOnlineCheckout(null)
          setResumeOnline(null)
          void load()
        }}
      />

      <Dialog open={!!pickPlan} onOpenChange={(o) => !o && setPickPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>提交订单（线下转账）</DialogTitle>
          </DialogHeader>
          {pickPlan ? (
            <div className="space-y-3">
              <p>套餐：{pickPlan.name}</p>
              <p>
                价格：{formatCny(cycle === 'monthly' ? pickPlan.price_monthly : pickPlan.price_yearly)} /{' '}
                {cycle === 'monthly' ? '月' : '年'}
              </p>

              {/* 收款账户信息 */}
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
                  <span className="text-sm font-semibold text-blue-800">收款账户信息</span>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">户名：</span>
                  <span className="font-medium">杭州中数云科智慧科技有限公司</span>
                  <span className="text-muted-foreground">账号：</span>
                  <span className="font-mono font-medium select-all">3301041060007320900</span>
                  <span className="text-muted-foreground">开户行：</span>
                  <span>杭州银行股份有限公司香积寺路支行</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">转账时请备注公司名称或订单号，到账后 1 个工作日内确认开通。</p>
              </div>

              <p className="text-sm text-muted-foreground">
                转账后由平台方确认收款，套餐才会生效。也可使用微信 / 支付宝扫码即时开通。
              </p>
              <div className="space-y-1">
                <Label>备注（转账流水号等）</Label>
                <Input value={remark} onChange={(e) => setRemark(e.target.value)} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickPlan(null)}>
              取消
            </Button>
            <Button onClick={() => void submitOrder()}>提交订单</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
