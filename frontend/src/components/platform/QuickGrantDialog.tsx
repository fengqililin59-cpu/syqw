/**
 * @file 平台方 · 快速开通弹窗：选择套餐 + 计费周期，一键为租户激活订阅。
 */
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { postJson } from '@/api/client'
import { Check, Zap } from 'lucide-react'

type PlanOption = {
  code: string
  name: string
  monthlyPrice: number
  yearlyPrice: number
  highlight?: string
  features: string[]
}

const PLANS: PlanOption[] = [
  {
    code: 'pro',
    name: '专业版',
    monthlyPrice: 398,
    yearlyPrice: 3980,
    highlight: '最受欢迎',
    features: ['5000 客户', '20 席位', '10000 次群发/月', '2000 次 AI 调用/月'],
  },
  {
    code: 'growth',
    name: '增长版',
    monthlyPrice: 998,
    yearlyPrice: 9980,
    features: ['20000 客户', '50 席位', '30000 次群发/月', '5000 次 AI 调用/月'],
  },
]

type BillingCycle = 'monthly' | 'yearly'

type QuickGrantDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: number
  tenantName: string
  onSuccess: (msg: string) => void
}

export function QuickGrantDialog({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  onSuccess,
}: QuickGrantDialogProps) {
  const [planCode, setPlanCode] = useState('pro')
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPlan = PLANS.find((p) => p.code === planCode)!
  const price = billingCycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice
  const periodLabel = billingCycle === 'yearly' ? '/年' : '/月'

  async function handleGrant() {
    setLoading(true)
    setError(null)
    try {
      await postJson(`/platform/tenants/${tenantId}/subscription`, {
        plan_code: planCode,
        billing_cycle: billingCycle,
      })
      const label = `${selectedPlan.name}（${billingCycle === 'yearly' ? '年付' : '月付'}）`
      onSuccess(`已为「${tenantName}」开通 ${label}`)
      onOpenChange(false)
      // 重置状态
      setPlanCode('pro')
      setBillingCycle('yearly')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '开通失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            快速开通
          </DialogTitle>
          <DialogDescription>
            为「{tenantName}」立即激活付费套餐，客户刷新页面即可使用。
          </DialogDescription>
        </DialogHeader>

        {/* 套餐选择 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">选择套餐</Label>
          <div className="grid gap-2">
            {PLANS.map((plan) => {
              const isActive = planCode === plan.code
              return (
                <button
                  key={plan.code}
                  type="button"
                  onClick={() => setPlanCode(plan.code)}
                  className={`relative flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
                    isActive
                      ? 'border-green-500 bg-green-50/50'
                      : 'border-border bg-background hover:border-muted-foreground/30'
                  }`}
                >
                  {isActive && (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{plan.name}</span>
                      {plan.highlight ? (
                        <Badge variant="default" className="bg-green-600 text-[10px]">
                          {plan.highlight}
                        </Badge>
                      ) : null}
                    </div>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {plan.features.map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 计费周期 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">计费周期</Label>
          <div className="flex gap-2">
            {(['monthly', 'yearly'] as BillingCycle[]).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`flex-1 rounded-md border-2 px-4 py-2 text-sm font-medium transition-colors ${
                  billingCycle === cycle
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {cycle === 'yearly' ? '年付' : '月付'}
                {cycle === 'yearly' && (
                  <span className="ml-1 text-[10px] text-amber-600">省 2 个月</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 价格预览 */}
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-center">
          <span className="text-sm text-muted-foreground">开通价格：</span>
          <span className="text-2xl font-bold text-foreground">¥{price.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground">{periodLabel}</span>
        </div>

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={() => void handleGrant()} disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? '开通中…' : '确认开通'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
