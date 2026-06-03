/**
 * @file 仪表盘 · 今日 AI 自动回复提醒，便于销售抽查。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, ChevronRight } from 'lucide-react'
import { fetchAiOpsStats } from '@/api/aiEmployee'
import { useAuthStore } from '@/store/authStore'
import { hasPermUser } from '@/lib/roles'
import { Button } from '@/components/ui/button'

export function DashboardAiAutoReplyBanner() {
  const navigate = useNavigate()
  const permissions = useAuthStore((s) => s.permissions)
  const canSee =
    hasPermUser(permissions, 'ai:use') ||
    hasPermUser(permissions, 'ai:approve') ||
    hasPermUser(permissions, 'inbox:view')

  const [autoSent, setAutoSent] = useState(0)
  const [threads, setThreads] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canSee) return
    let cancelled = false
    setLoading(true)
    void fetchAiOpsStats({ days: 1 })
      .then((s) => {
        if (!cancelled) {
          setAutoSent(s.ai_replies_auto_sent ?? 0)
          setThreads(s.threads_with_ai_auto_sent ?? 0)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAutoSent(0)
          setThreads(0)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canSee])

  if (!canSee || loading || autoSent <= 0) return null

  return (
    <div className="rounded-xl border border-violet-300 bg-gradient-to-r from-violet-50 to-indigo-50/80 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
            <Bot className="h-5 w-5 text-violet-800" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-violet-950">
              今日 AI 已自动回复 · <span className="tabular-nums">{autoSent}</span> 条
              {threads > 0 ? (
                <span className="font-normal text-violet-900/90">
                  {' '}
                  · 涉及 <span className="tabular-nums">{threads}</span> 个会话
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-violet-900/80">
              建议抽查自动发送内容是否准确；复杂询价与投诉类仍须人工跟进。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-violet-300 bg-white/80"
            onClick={() => navigate('/app/inbox?filter=ai_auto_sent')}
          >
            收件箱
          </Button>
          <Button size="sm" onClick={() => navigate('/app/ai-review?tab=auto_sent')}>
            质检复盘
            <ChevronRight className="ml-0.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
