import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { getJson, postJson } from '@/api/client'
import { hasPermUser } from '@/lib/roles'
import { useAuthStore } from '@/store/authStore'
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
}

function formatCny(amount: number) {
  return Number(amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
}

function formatDate(s?: string | null) {
  return s ? dayjs(s).format('YYYY-MM-DD HH:mm') : '—'
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
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [pickPlan, setPickPlan] = useState<Plan | null>(null)
  const [remark, setRemark] = useState('')

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

  const statusBadge = useMemo(() => {
    if (!status) return <Badge variant="secondary">未知</Badge>
    if (status === 'trialing') return <Badge className="bg-blue-600 hover:bg-blue-600">试用中</Badge>
    if (status === 'active') return <Badge className="bg-green-600 hover:bg-green-600">使用中</Badge>
    if (status === 'expired') return <Badge variant="destructive">已到期</Badge>
    return <Badge variant="secondary">已取消</Badge>
  }, [status])

  async function submitOrder() {
    if (!pickPlan) return
    await postJson('/billing/payment', {
      plan_code: pickPlan.code,
      billing_cycle: cycle,
      pay_channel: 'manual',
      remark: remark || null,
    })
    window.alert('订单已提交，请完成转账后联系管理员确认')
    setPickPlan(null)
    setRemark('')
    await load()
  }

  async function handleConfirm(outTradeNo: string) {
    await postJson('/billing/payment/confirm', { out_trade_no: outTradeNo })
    window.alert('已确认收款，套餐已激活')
    await load()
  }

  if (loading) return <p className="text-sm text-muted-foreground">加载中…</p>
  if (!data || !currentPlan) return <p className="text-sm text-destructive">计费数据加载失败</p>

  return (
    <div className="space-y-4">
      <Card className={warnSoon ? 'border-orange-400' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            当前套餐：{currentPlan.name}
            {statusBadge}
          </CardTitle>
          <CardDescription>
            {status === 'trialing' ? `试用剩余 ${data.days_remaining} 天` : null}
            {status === 'active' ? `到期时间：${formatDate(data.subscription.current_period_end)}` : null}
            {status === 'expired' ? <span className="text-red-500">套餐已到期，请续费</span> : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {currentPlan.code !== 'enterprise' ? <Button onClick={() => {}}>升级套餐</Button> : null}
          {status === 'active' ? <Button variant="outline">续费</Button> : null}
        </CardContent>
      </Card>

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
            <div key={p.id} className={`rounded-lg border p-4 ${currentPlan.code === p.code ? 'border-2 border-blue-500' : ''}`}>
              <h3 className="text-lg font-semibold">{p.name}</h3>
              {p.code === 'free' ? (
                <p>免费</p>
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
                {currentPlan.code === p.code ? (
                  <Badge>当前套餐</Badge>
                ) : (
                  <Button disabled={!canManage} onClick={() => setPickPlan(p)}>
                    选择此套餐
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
              <AccordionTrigger value="payments">支付记录</AccordionTrigger>
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
                          {p.status === 'pending' ? <Badge className="bg-yellow-500 hover:bg-yellow-500">待确认</Badge> : null}
                          {p.status === 'paid' ? <Badge className="bg-green-600 hover:bg-green-600">已支付</Badge> : null}
                          {p.status === 'failed' ? <Badge variant="destructive">失败</Badge> : null}
                          {p.status === 'refunded' ? <Badge variant="secondary">已退款</Badge> : null}
                        </TableCell>
                        <TableCell>
                          {canManage && p.status === 'pending' ? (
                            <Button size="sm" variant="outline" onClick={() => void handleConfirm(p.out_trade_no)}>
                              确认收款
                            </Button>
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
            <DialogTitle>提交订单</DialogTitle>
          </DialogHeader>
          {pickPlan ? (
            <div className="space-y-3">
              <p>套餐：{pickPlan.name}</p>
              <p>
                价格：{formatCny(cycle === 'monthly' ? pickPlan.price_monthly : pickPlan.price_yearly)} /{' '}
                {cycle === 'monthly' ? '月' : '年'}
              </p>
              <p className="text-sm text-muted-foreground">支付方式：手动转账</p>
              <p className="text-sm text-muted-foreground">收款账户：请联系管理员获取</p>
              <div className="space-y-1">
                <Label>备注</Label>
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
