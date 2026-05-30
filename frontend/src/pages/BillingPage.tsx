import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { getJson, postJson } from '@/api/client'
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

type PaymentRow = {
  id: number
  plan: { id: number; name: string; code: string } | null
  billing_cycle: 'monthly' | 'yearly'
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'refunded'
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
        const pay = await getJson<{ list: PaymentRow[] }>('/billing/payments?page=1&size=20')
        setPayments(pay.list || [])
      } else {
        setPayments([])
      }
    } finally {
      setLoading(false)
    }
  }, [canManage])

  useEffect(() => {
    void load()
  }, [load])

  const currentPlan = data?.plan
  const status = data?.subscription.status
  const warnSoon = (data?.days_remaining ?? 999) <= 7
  const isTrialingPro = status === 'trialing' && currentPlan?.code === 'pro'
  const isExperienceFree = currentPlan?.code === 'free' && status === 'active'

  const statusBadge = useMemo(() => {
    if (!status) return <Badge variant="secondary">未知</Badge>
    if (status === 'trialing') return <Badge className="bg-blue-600 hover:bg-blue-600">专业版试用</Badge>
    if (status === 'active' && currentPlan?.code === 'free')
      return <Badge variant="secondary">体验版</Badge>
    if (status === 'active') return <Badge className="bg-green-600 hover:bg-green-600">使用中</Badge>
    if (status === 'expired') return <Badge variant="destructive">已到期</Badge>
    return <Badge variant="secondary">已取消</Badge>
  }, [status, currentPlan?.code])

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

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 bg-slate-50/80">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4 text-sm text-slate-600">
          <p>
            ZhiFlow 为 <strong>B2B 订阅制</strong>，不靠免费版广告变现。新注册享 <strong>14 天专业版试用</strong>
            ，到期后自动降为<strong>体验版</strong>；付费或通过<strong>兑换码</strong>开通正式套餐。
          </p>
          {isPlatformAdmin ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/app/platform">进入平台运营后台 →</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className={warnSoon ? 'border-orange-400' : ''}>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            当前套餐：{planDisplayName(currentPlan, status)}
            {statusBadge}
          </CardTitle>
          <CardDescription>
            {isTrialingPro ? `专业版试用剩余 ${data.days_remaining} 天，到期后降为体验版` : null}
            {status === 'active' && currentPlan.code !== 'free'
              ? `到期时间：${formatDate(data.subscription.current_period_end)}`
              : null}
            {isExperienceFree ? '体验版永久可用但功能与配额受限，升级后可解锁自动化、外呼、审计等能力' : null}
            {status === 'expired' ? <span className="text-red-500">套餐已到期，请续费或输入兑换码</span> : null}
          </CardDescription>
        </CardHeader>
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
          {plans.map((p) => (
            <div
              key={p.id}
              className={`rounded-lg border p-4 ${currentPlan.code === p.code && status !== 'trialing' ? 'border-2 border-blue-500' : ''}`}
            >
              <h3 className="text-lg font-semibold">{p.code === 'free' ? '体验版' : p.name}</h3>
              {p.code === 'free' ? (
                <p className="text-sm text-muted-foreground">试用到期后默认档位</p>
              ) : (
                <p>
                  {formatCny(cycle === 'monthly' ? p.price_monthly : p.price_yearly)} / {cycle === 'monthly' ? '月' : '年'}
                </p>
              )}
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>客户数：{p.customers_limit === -1 ? '不限' : p.customers_limit}</li>
                <li>席位：{p.seats_limit === -1 ? '不限' : p.seats_limit}</li>
                <li>月群发：{p.broadcasts_monthly === -1 ? '不限' : p.broadcasts_monthly}</li>
              </ul>
              <div className="mt-3">
                {(currentPlan.code === p.code && status !== 'trialing') || (isTrialingPro && p.code === 'pro') ? (
                  <Badge>{isTrialingPro && p.code === 'pro' ? '试用中' : '当前套餐'}</Badge>
                ) : p.code === 'free' ? (
                  <Badge variant="secondary">默认体验</Badge>
                ) : (
                  <Button disabled={!canManage || p.code === 'free'} onClick={() => setPickPlan(p)}>
                    提交订单
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

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
                            <Badge className="bg-yellow-500 hover:bg-yellow-500">待平台确认</Badge>
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
              <p className="text-sm text-muted-foreground">转账后由平台方确认收款，套餐才会生效（不可自行确认）。</p>
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
