/**
 * @file 平台方 · 单租户详情与开通操作。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { getJson, postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type TenantDetail = {
  tenant: { id: number; name: string; contact_name: string | null; contact_phone: string | null; created_at: string }
  subscription: {
    plan: { name: string; code: string } | null
    subscription: { status: string; trial_ends_at: string | null; current_period_end: string | null }
    days_remaining: number
    usage: { customers_count: number; seats_count: number }
  }
  users: { id: number; username: string; real_name: string | null; role: string; last_login_at: string | null }[]
  payments: {
    id: number
    amount: number
    status: string
    plan: { name: string } | null
    created_at: string
    out_trade_no: string
  }[]
  promo_redemptions: { promo_code: string; plan_name: string; redeemed_at: string }[]
}

function fmt(s?: string | null) {
  return s ? dayjs(s).format('YYYY-MM-DD HH:mm') : '—'
}

export function PlatformTenantDetailPage() {
  const { tenantId } = useParams()
  const [data, setData] = useState<TenantDetail | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

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
    await postJson(`/platform/tenants/${tenantId}/subscription`, { plan_code: planCode, billing_cycle: 'yearly' })
    setMsg(`已开通 ${planCode === 'enterprise' ? '企业版' : '专业版'}（年付）`)
    await load()
  }

  async function extendTrial() {
    if (!tenantId) return
    await postJson(`/platform/tenants/${tenantId}/extend-trial`, { days: 14 })
    setMsg('已延长 14 天专业版试用')
    await load()
  }

  if (!data) return <p className="text-sm text-muted-foreground">加载中…</p>

  const sub = data.subscription
  const plan = sub.plan

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/platform/tenants">← 租户列表</Link>
        </Button>
        <h1 className="text-2xl font-semibold">{data.tenant.name}</h1>
        <Badge variant="secondary">#{data.tenant.id}</Badge>
      </div>

      {msg ? <p className="text-sm text-green-600">{msg}</p> : null}

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
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={() => void grant('pro')}>
                开通专业版（年）
              </Button>
              <Button size="sm" variant="outline" onClick={() => void grant('enterprise')}>
                开通企业版（年）
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void extendTrial()}>
                延长试用 14 天
              </Button>
            </div>
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
          <CardTitle className="text-base">账号列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>最近登录</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.real_name || '—'}</TableCell>
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
