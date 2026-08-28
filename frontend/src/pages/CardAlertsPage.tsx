/**
 * @file 复购提醒台：待续卡、将到期、余额不足、久未到店。
 * 数据来源与「复购扫描」自动流程一致，可人工先跟进。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, Moon, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  cardRemainingText,
  fetchCardAlerts,
  type CardAlerts,
  type CustomerCard,
  type SleepingCustomer,
} from '@/api/customerCards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function Section({
  title,
  hint,
  icon: Icon,
  color,
  count,
  children,
}: {
  title: string
  hint: string
  icon: LucideIcon
  color: string
  count: number
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" style={{ color }} />
          {title}
          <span className="rounded-full px-2 py-0.5 text-xs text-white" style={{ background: color }}>
            {count}
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function CardRow({ card, extra }: { card: CustomerCard; extra?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0">
      <div className="min-w-0">
        <Link to={`/app/customers/${card.customer_id}`} className="font-medium text-primary hover:underline">
          {card.customer?.name || `客户 #${card.customer_id}`}
        </Link>
        <div className="truncate text-xs text-muted-foreground">
          {card.name} · {card.card_type_label}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="tabular-nums">{cardRemainingText(card)}</div>
        {extra ? <div className="text-xs text-muted-foreground">{extra}</div> : null}
      </div>
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>
}

export function CardAlertsPage() {
  const [data, setData] = useState<CardAlerts | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchCardAlerts())
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const t = data?.thresholds

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">复购提醒台</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          谁该续卡、谁的卡快到期、谁该被叫回来 —— 每天照着这一页跟进即可。
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !data ? <p className="text-sm text-muted-foreground">加载中…</p> : null}

      {data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section
            title="疗程即将用完"
            hint={`剩余次数 ≤ ${t?.low_times} 次，是续卡成功率最高的时机`}
            icon={AlertTriangle}
            color="#f59e0b"
            count={data.low_times.length}
          >
            {data.low_times.length === 0 ? (
              <EmptyHint text="暂无即将用完的疗程" />
            ) : (
              data.low_times.map((c) => <CardRow key={c.id} card={c} />)
            )}
          </Section>

          <Section
            title="卡项即将到期"
            hint={`${t?.expire_days} 天内到期，过期作废前务必联系`}
            icon={CalendarClock}
            color="#ef4444"
            count={data.expiring.length}
          >
            {data.expiring.length === 0 ? (
              <EmptyHint text="暂无即将到期的卡项" />
            ) : (
              data.expiring.map((c) => (
                <CardRow
                  key={c.id}
                  card={c}
                  extra={c.days_to_expire != null ? `还剩 ${c.days_to_expire} 天` : undefined}
                />
              ))
            )}
          </Section>

          <Section
            title="储值余额不足"
            hint={`余额 ≤ ¥${t?.low_amount}，可邀约充值`}
            icon={Wallet}
            color="#3b82f6"
            count={data.low_balance.length}
          >
            {data.low_balance.length === 0 ? (
              <EmptyHint text="暂无余额不足的储值卡" />
            ) : (
              data.low_balance.map((c) => <CardRow key={c.id} card={c} />)
            )}
          </Section>

          <Section
            title="久未到店"
            hint={`超过 ${t?.sleep_days} 天没来，且没有预约在身`}
            icon={Moon}
            color="#8b5cf6"
            count={data.sleeping.length}
          >
            {data.sleeping.length === 0 ? (
              <EmptyHint text="暂无沉睡客户" />
            ) : (
              data.sleeping.map((c: SleepingCustomer) => {
                const gap = daysSince(c.last_visit_at)
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0"
                  >
                    <div className="min-w-0">
                      <Link to={`/app/customers/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name || `客户 #${c.id}`}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        累计到店 {c.visit_count} 次 · 消费 ¥{Number(c.total_paid_amount || 0).toFixed(0)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      {gap == null ? '—' : `${gap} 天未到店`}
                    </div>
                  </div>
                )
              })
            )}
          </Section>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        想让这些提醒自动发出去？在「流程」里新建流程，触发器选择「疗程即将用完」「卡项即将到期」「储值余额不足」或「客户久未到店」即可。
      </p>
    </div>
  )
}

export default CardAlertsPage
