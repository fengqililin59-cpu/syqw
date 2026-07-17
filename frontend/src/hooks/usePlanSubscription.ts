/**
 * @file 读取当前订阅与套餐能力（用于付费墙前端拦截）。
 */
import { useCallback, useEffect, useState } from 'react'
import { getJson } from '@/api/client'
import { planIncludesFeature } from '@/lib/planFeatures'

export type PlanSubscription = {
  subscription: {
    status: 'trialing' | 'active' | 'expired' | 'cancelled'
    is_trial?: boolean
  }
  plan: {
    code: string
    name: string
    features: string[]
    price_monthly: number
    price_yearly: number
  }
}

export function usePlanSubscription() {
  const [data, setData] = useState<PlanSubscription | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const sub = await getJson<PlanSubscription>('/billing/subscription')
      setData(sub)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const hasFeature = useCallback(
    (featureToken: string) => {
      if (!data?.plan) return true
      const { plan, subscription } = data
      if (subscription.status === 'trialing' && plan.code !== 'free') return true
      if (plan.code === 'free' && subscription.status === 'active') return false
      if (['expired', 'cancelled'].includes(subscription.status)) return false
      return planIncludesFeature(plan.features, featureToken)
    },
    [data],
  )

  const isExperienceFree =
    data?.plan.code === 'free' && data?.subscription.status === 'active'

  return { data, loading, reload, hasFeature, isExperienceFree }
}
