/**
 * @file 平台方 · 全站订单确认与兑换码管理。
 */
import { Fragment, useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { getJson, postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PlatformContractOrderCard } from '@/components/PlatformContractOrderCard'
import { PlatformInvoiceRequestsCard } from '@/components/PlatformInvoiceRequestsCard'
import { PlatformContractAttachmentsPanel } from '@/components/PlatformContractAttachmentsPanel'
import { PlatformPaymentReconcileCard } from '@/components/PlatformPaymentReconcileCard'
import { PlatformTenantStatementsExportCard } from '@/components/PlatformTenantStatementsExportCard'

type PaymentRow = {
  id: number
  tenant?: { name: string } | null
  tenant_id: number
  plan?: { name: string } | null
  amount: number
  status: string
  out_trade_no: string
  created_at: string
  remark?: string | null
  attachment_count?: number
}

type PromoRow = {
  id: number
  code: string
  plan?: { name: string } | null
  billing_cycle: string
  max_redemptions: number
  redemption_count: number
  note: string | null
  valid_until: string | null
}

function fmt(s: string) {
  return dayjs(s).format('YYYY-MM-DD HH:mm')
}

export function PlatformBillingPage() {
  const [pending, setPending] = useState<PaymentRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [promos, setPromos] = useState<PromoRow[]>([])
  const [promoPlan, setPromoPlan] = useState('pro')
  const [promoCycle, setPromoCycle] = useState<'monthly' | 'yearly'>('yearly')
  const [promoMax, setPromoMax] = useState('1')
  const [promoNote, setPromoNote] = useState('')
  const [newCode, setNewCode] = useState<string | null>(null)
  const [expandAttTradeNo, setExpandAttTradeNo] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [p1, p2, p3] = await Promise.all([
      getJson<PaymentRow[]>('/platform/payments/pending'),
      getJson<{ list: PaymentRow[] }>('/platform/payments?page=1&size=30'),
      getJson<PromoRow[]>('/platform/promo-codes'),
    ])
    setPending(p1 || [])
    setPayments(p2.list || [])
    setPromos(p3 || [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function confirm(outTradeNo: string) {
    await postJson('/platform/payments/confirm', { out_trade_no: outTradeNo })
    window.alert('已确认收款')
    await load()
  }

  async function createPromo() {
    const row = await postJson<PromoRow>('/platform/promo-codes', {
      plan_code: promoPlan,
      billing_cycle: promoCycle,
      max_redemptions: Number(promoMax) || 1,
      note: promoNote || null,
      valid_days: 365,
    })
    setNewCode(row.code)
    setPromoNote('')
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">订单与兑换码</h1>
        <p className="mt-1 text-sm text-muted-foreground">确认线下转账、合同年框开单、生成推广兑换码。</p>
      </div>

      <PlatformContractOrderCard onCreated={() => void load()} />

      <PlatformInvoiceRequestsCard />

      <PlatformPaymentReconcileCard />

      <PlatformTenantStatementsExportCard />

      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="text-base">待确认收款</CardTitle>
          <CardDescription>客户提交订单并转账后，在此确认开通。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>企业</TableHead>
                <TableHead>时间</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>备注</TableHead>
                <TableHead>合同</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((p) => (
                <Fragment key={p.id}>
                  <TableRow>
                    <TableCell>{p.tenant?.name || `#${p.tenant_id}`}</TableCell>
                    <TableCell>{fmt(p.created_at)}</TableCell>
                    <TableCell>{p.plan?.name || '—'}</TableCell>
                    <TableCell>¥{Number(p.amount).toLocaleString('zh-CN')}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{p.remark || '—'}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="text-xs text-blue-700 hover:underline"
                        onClick={() =>
                          setExpandAttTradeNo((cur) => (cur === p.out_trade_no ? null : p.out_trade_no))
                        }
                      >
                        {p.attachment_count ? `${p.attachment_count} 个` : '附件'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => void confirm(p.out_trade_no)}>
                        确认收款
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandAttTradeNo === p.out_trade_no ? (
                    <TableRow key={`${p.id}-att`}>
                      <TableCell colSpan={7} className="bg-slate-50/80">
                        <PlatformContractAttachmentsPanel
                          outTradeNo={p.out_trade_no}
                          compact
                          onChange={() => void load()}
                        />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
              {pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    暂无待确认订单
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-violet-200">
        <CardHeader>
          <CardTitle className="text-base">创建兑换码</CardTitle>
          <CardDescription>发给客户或代理，租户在「套餐计费」页自助兑换，无需确认收款。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label>套餐</Label>
              <select className="h-9 rounded-md border px-2 text-sm" value={promoPlan} onChange={(e) => setPromoPlan(e.target.value)}>
                <option value="pro">专业版</option>
                <option value="enterprise">企业版</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>周期</Label>
              <select
                className="h-9 rounded-md border px-2 text-sm"
                value={promoCycle}
                onChange={(e) => setPromoCycle(e.target.value as 'monthly' | 'yearly')}
              >
                <option value="yearly">年付</option>
                <option value="monthly">月付</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>可用次数</Label>
              <Input className="w-20" value={promoMax} onChange={(e) => setPromoMax(e.target.value)} />
            </div>
            <div className="min-w-[180px] flex-1 space-y-1">
              <Label>渠道备注</Label>
              <Input value={promoNote} onChange={(e) => setPromoNote(e.target.value)} placeholder="代理张三 / 活动赠送" />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={() => void createPromo()}>
                生成
              </Button>
            </div>
          </div>
          {newCode ? (
            <p className="rounded-md bg-violet-50 px-3 py-2 text-sm font-medium">
              新码：<code className="select-all">{newCode}</code>
            </p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>兑换码</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead>已用/总量</TableHead>
                <TableHead>备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promos.slice(0, 20).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell>{c.plan?.name}</TableCell>
                  <TableCell>
                    {c.redemption_count}/{c.max_redemptions}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.note || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">近期全站订单</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>企业</TableHead>
                <TableHead>时间</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.tenant?.name || `#${p.tenant_id}`}</TableCell>
                  <TableCell>{fmt(p.created_at)}</TableCell>
                  <TableCell>¥{Number(p.amount).toLocaleString('zh-CN')}</TableCell>
                  <TableCell>
                    {p.status === 'pending' ? (
                      <Badge className="bg-yellow-500">待确认</Badge>
                    ) : p.status === 'paid' ? (
                      <Badge className="bg-green-600">已付</Badge>
                    ) : (
                      p.status
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
