/**
 * @file 平台方运营概览。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, CreditCard, Gift, TrendingUp, Users } from 'lucide-react'
import { getJson } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Overview = {
  tenants_total: number
  subscription: {
    trialing: number
    paid_active: number
    experience_free: number
    expired: number
  }
  pending_payments: { count: number; amount: number }
  promo_codes_available: number
  mrr_estimate_cny: number
  recent_tenants: { id: number; name: string; created_at: string }[]
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

export function PlatformOverviewPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    getJson<Overview>('/platform/overview')
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : '加载失败'))
  }, [])

  if (err) return <p className="text-sm text-destructive">{err}</p>
  if (!data) return <p className="text-sm text-muted-foreground">加载中…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">平台运营概览</h1>
        <p className="mt-1 text-sm text-muted-foreground">全站租户、订阅与收款一览（仅平台超管可见）。</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="注册企业" value={data.tenants_total} icon={Building2} />
        <StatCard title="付费使用中" value={data.subscription.paid_active} hint="专业版/企业版" icon={TrendingUp} />
        <StatCard
          title="待确认收款"
          value={data.pending_payments.count}
          hint={`合计 ¥${data.pending_payments.amount.toLocaleString('zh-CN')}`}
          icon={CreditCard}
        />
        <StatCard
          title="估算 MRR"
          value={`¥${data.mrr_estimate_cny.toLocaleString('zh-CN')}`}
          hint="按当前付费订阅折算"
          icon={TrendingUp}
        />
      </div>

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

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/app/platform/billing">订单与兑换码</Link>
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
    </div>
  )
}
