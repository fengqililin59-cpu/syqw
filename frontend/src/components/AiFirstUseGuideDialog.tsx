/**
 * @file 注册后首次进入后台：引导试用站内 AI（一次性弹窗）。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Shield, Sparkles } from 'lucide-react'
import { getJson } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import {
  consumeShowAiGuideSession,
  dismissAiGuide,
  isAiGuideDismissed,
} from '@/lib/aiOnboarding'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const STARTER_PROMPT = encodeURIComponent('新加微信的客户，第一条跟进消息怎么写？')

export function AiFirstUseGuideDialog() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const canAi = useAuthStore((s) => s.hasPerm('ai:use'))
  const isGuest = useAuthStore((s) => s.isGuest)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user?.id || !canAi || isGuest) return
    if (isAiGuideDismissed(user.id)) return

    const fromRegister = consumeShowAiGuideSession()
    if (fromRegister) {
      setOpen(true)
      return
    }

    let cancelled = false
    void getJson<{ usage: { ai_calls_used: number } }>('/billing/subscription')
      .then((sub) => {
        if (cancelled) return
        if ((sub.usage?.ai_calls_used ?? 0) === 0) setOpen(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user?.id, canAi, isGuest])

  function close(dismissPermanent: boolean) {
    if (user?.id && dismissPermanent) dismissAiGuide(user.id)
    setOpen(false)
  }

  function goTry() {
    close(true)
    navigate(`/app/ai-assistant?q=${STARTER_PROMPT}`)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(true)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-violet-600" />
            欢迎使用 ZhiFlow
          </DialogTitle>
          <DialogDescription>
            你已开通 <strong>14 天专业版试用</strong>。建议先用 1 分钟体验站内 AI，感受写话术能省多少时间。
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 text-sm text-slate-700">
          <li className="flex gap-2">
            <Bot className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
            <span>
              <strong>AI 智能助手</strong>：输入客户场景，生成跟进话术与异议处理思路。
            </span>
          </li>
          <li className="flex gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
            <span>
              <strong>客户详情</strong>：在「企微消息」里可一键生成 3 条回复建议。
            </span>
          </li>
          <li className="flex gap-2">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <strong>安全</strong>：AI 不会自动给客户发消息，复制后由你人工发送。
            </span>
          </li>
        </ul>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => close(true)}>
            稍后再说
          </Button>
          <Button type="button" className="w-full sm:w-auto" onClick={goTry}>
            立即试 AI（约 30 秒）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
