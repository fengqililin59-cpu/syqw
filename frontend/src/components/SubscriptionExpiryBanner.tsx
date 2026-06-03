/**
 * @file 全站：试用/付费到期提醒条（≤7 天或已到期）。
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, X } from 'lucide-react'
import { getJson } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { hasPermUser } from '@/lib/roles'
import { Button } from '@/components/ui/button'

type Sub = {
  subscription: {
    status: 'trialing' | 'active' | 'expired' | 'cancelled'
    trial_ends_at: string | null
    current_period_end: string | null
  }
  plan: { code: string; name: string }
  days_remaining: number
  is_expired: boolean
}

const DISMISS_KEY = 'zf_sub_expiry_banner_dismiss'

function dismissStorageKey(tenantId: number, kind: string) {
  return `${DISMISS_KEY}_${tenantId}_${kind}`
}

function isDismissed(tenantId: number, kind: string): boolean {
  try {
    const raw = localStorage.getItem(dismissStorageKey(tenantId, kind))
    if (!raw) return false
    const { until } = JSON.parse(raw) as { until: number }
    return typeof until === 'number' && until > Date.now()
  } catch {
    return false
  }
}

function dismissForDay(tenantId: number, kind: string) {
  localStorage.setItem(
    dismissStorageKey(tenantId, kind),
    JSON.stringify({ until: Date.now() + 24 * 60 * 60 * 1000 }),
  )
}

export function SubscriptionExpiryBanner() {
  const tenantId = useAuthStore((s) => s.tenantId)
  const perms = useAuthStore((s) => s.permissions)
  const canBilling = hasPermUser(perms, 'settings:manage')
  const [data, setData] = useState<Sub | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    void getJson<Sub>('/billing/subscription')
      .then(setData)
      .catch(() => setData(null))
  }, [])

  const alert = useMemo(() => {
    if (!data) return null
    const { subscription: sub, plan, days_remaining: days, is_expired: expired } = data
    const status = sub.status

    if (expired || status === 'expired') {
      return {
        kind: 'expired',
        urgent: true,
        title: '套餐已到期',
        body: '已切换为体验版，自动化、高配额 AI 等能力受限。请续费或兑换码开通。',
      }
    }

    if (status === 'trialing' && plan.code === 'pro' && days <= 7) {
      return {
        kind: `trial_${days}`,
        urgent: days <= 3,
        title: days <= 0 ? '专业版试用今日结束' : `专业版试用剩余 ${days} 天`,
        body:
          days <= 3
            ? '到期后将降为体验版（客户/群发/AI 配额收紧）。建议提前提交订单或使用兑换码。'
            : '试用期内可体验自动化、完整 AI 与意向预警。到期前升级可无缝延续数据。',
      }
    }

    if (status === 'active' && plan.code !== 'free' && days <= 7 && days >= 0) {
      return {
        kind: `paid_${days}`,
        urgent: days <= 3,
        title: `付费套餐剩余 ${days} 天`,
        body: '请及时续费，避免到期后降为体验版影响团队使用。',
      }
    }

    if (status === 'active' && plan.code === 'free') {
      return null
    }

    return null
  }, [data])

  useEffect(() => {
    if (!tenantId || !alert) return
    setHidden(isDismissed(tenantId, alert.kind))
  }, [tenantId, alert])

  if (!alert || hidden) return null

  const onDismiss = () => {
    if (tenantId) dismissForDay(tenantId, alert.kind)
    setHidden(true)
  }

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        alert.urgent ? 'border-orange-300 bg-orange-50' : 'border-blue-200 bg-blue-50'
      }`}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Clock className={`mt-0.5 h-4 w-4 shrink-0 ${alert.urgent ? 'text-orange-700' : 'text-blue-700'}`} />
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${alert.urgent ? 'text-orange-950' : 'text-blue-950'}`}>
            {alert.title}
          </p>
          <p className="text-xs text-muted-foreground">{alert.body}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canBilling ? (
          <Button size="sm" asChild>
            <Link to="/app/billing">去升级 / 续费</Link>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">请联系管理员续费</span>
        )}
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-black/5"
          aria-label="今日不再提示"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
