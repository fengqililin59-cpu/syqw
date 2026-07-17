/**
 * @file 前端付费墙拦截：点击锁定能力时弹升级引导。
 */
import { useCallback, useState } from 'react'
import { PlanUpgradeDialog } from '@/components/PlanUpgradeDialog'
import { usePlanSubscription } from '@/hooks/usePlanSubscription'
import type { PremiumFeatureToken } from '@/lib/planFeatures'

export function usePlanGate(feature: PremiumFeatureToken) {
  const { hasFeature, loading } = usePlanSubscription()
  const [dialogOpen, setDialogOpen] = useState(false)
  const locked = !loading && !hasFeature(feature)

  const runGated = useCallback(
    (action: () => void | Promise<void>) => {
      if (loading || hasFeature(feature)) {
        void action()
        return
      }
      setDialogOpen(true)
    },
    [feature, hasFeature, loading],
  )

  const gateDialog = (
    <PlanUpgradeDialog open={dialogOpen} onOpenChange={setDialogOpen} detail={{ feature }} />
  )

  return { locked, loading, runGated, gateDialog, openUpgrade: () => setDialogOpen(true) }
}
