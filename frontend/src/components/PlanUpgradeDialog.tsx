/**
 * @file 付费功能升级引导弹窗（体验版点击锁定能力时展示）。
 */
import { Link } from 'react-router-dom'
import { Lock, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FEATURE_LABELS, type PlanUpgradeDetail } from '@/lib/planFeatures'

type PlanUpgradeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail?: PlanUpgradeDetail | null
}

const PRO_HIGHLIGHTS = [
  'AI 意向评分与粘贴对话分析',
  'AI 教练日报与跟进建议',
  '广告 ROI 归因与投放分析',
  '企微会话存档与 AI 解读',
  '自动化流程与完整 AI 助手',
]

export function PlanUpgradeDialog({ open, onOpenChange, detail }: PlanUpgradeDialogProps) {
  const featureLabel =
    detail?.feature_label ||
    (detail?.feature ? FEATURE_LABELS[detail.feature] : null) ||
    '此功能'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-violet-600" />
            升级解锁 {featureLabel}
          </DialogTitle>
          <DialogDescription>
            体验版支持手动管理客户与基础群发；专业版解锁全部 AI 销售能力，帮助团队提升成交效率。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-violet-950">专业版</span>
            <Badge className="bg-violet-600 hover:bg-violet-600">推荐</Badge>
          </div>
          <p className="text-2xl font-bold text-violet-800">
            ¥398
            <span className="text-sm font-normal text-muted-foreground"> / 月</span>
            <span className="ml-2 text-sm font-normal text-muted-foreground">或 ¥3980 / 年</span>
          </p>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {PRO_HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />
                {item}
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            增长版 ¥998/月 另含巨量表单接入、多席位与更高 AI 配额
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button asChild className="w-full">
            <Link to="/app/billing" onClick={() => onOpenChange(false)}>
              查看套餐并升级
            </Link>
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            稍后再说
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
