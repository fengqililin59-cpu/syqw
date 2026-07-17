/**
 * @file 全局监听 plan_feature 402，弹出升级引导而非直接跳转。
 */
import { useEffect, useState } from 'react'
import { PlanUpgradeDialog } from '@/components/PlanUpgradeDialog'
import { PLAN_UPGRADE_EVENT, type PlanUpgradeDetail } from '@/lib/planFeatures'

export function PlanUpgradeProvider() {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<PlanUpgradeDetail | null>(null)

  useEffect(() => {
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent<PlanUpgradeDetail>
      setDetail(custom.detail ?? null)
      setOpen(true)
    }
    window.addEventListener(PLAN_UPGRADE_EVENT, handler)
    return () => window.removeEventListener(PLAN_UPGRADE_EVENT, handler)
  }, [])

  return <PlanUpgradeDialog open={open} onOpenChange={setOpen} detail={detail} />
}
