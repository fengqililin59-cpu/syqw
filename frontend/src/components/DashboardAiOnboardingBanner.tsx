/**
 * @file 仪表盘：尚未使用过 AI 时引导首次提问。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { getJson } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { hasPermUser } from '@/lib/roles'
import { Button } from '@/components/ui/button'

type UsageSummary = {
  ai_calls: { current: number; limit: number }
}

export function DashboardAiOnboardingBanner() {
  const perms = useAuthStore((s) => s.permissions)
  const canAi = hasPermUser(perms, 'ai:use')
  const [hide, setHide] = useState(false)
  const [used, setUsed] = useState<number | null>(null)

  useEffect(() => {
    if (!canAi) return
    void getJson<UsageSummary>('/billing/usage')
      .then((u) => setUsed(u.ai_calls?.current ?? 0))
      .catch(() => setUsed(null))
  }, [canAi])

  if (!canAi || hide || used === null || used > 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white px-4 py-3">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
        <div>
          <p className="text-sm font-medium text-violet-950">还没试过 AI 助手？</p>
          <p className="text-xs text-muted-foreground">
            输入客户场景，30 秒生成 3 条跟进话术；在客户详情「企微消息」里也可一键生成回复建议。
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setHide(true)}>
          稍后
        </Button>
        <Button size="sm" asChild>
          <Link to="/app/ai-assistant">去试一次</Link>
        </Button>
      </div>
    </div>
  )
}
