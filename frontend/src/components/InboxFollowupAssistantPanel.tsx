/**
 * @file 收件箱 · 意向跟进助手（话术推荐 + 填入回复框）。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronDown, ChevronUp, Copy, Sparkles } from 'lucide-react'
import { fetchCustomerIntentPlaybook, type CustomerIntentPlaybook } from '@/api/customers'
import { Button } from '@/components/ui/button'
import { IntentAlertPlaybookDialog } from '@/components/IntentAlertPlaybookDialog'

type Props = {
  customerId: number | null | undefined
  /** 将话术填入收件箱回复框 */
  onApplyReply: (text: string) => void
}

export function InboxFollowupAssistantPanel({ customerId, onApplyReply }: Props) {
  const navigate = useNavigate()
  const [playbook, setPlaybook] = useState<CustomerIntentPlaybook | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    const cid = customerId ? Number(customerId) : 0
    if (!cid) {
      setPlaybook(null)
      return
    }
    setLoading(true)
    void fetchCustomerIntentPlaybook(cid)
      .then((r) => {
        if (r.show_assistant === false) setPlaybook(null)
        else setPlaybook(r)
      })
      .catch(() => setPlaybook(null))
      .finally(() => setLoading(false))
  }, [customerId])

  if (!customerId) return null
  if (!loading && !playbook) return null

  const scripts = playbook?.recommended_scripts?.slice(0, 3) ?? []

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      window.alert('已复制')
    } catch {
      window.alert('复制失败')
    }
  }

  return (
    <>
      <div className="rounded-lg border border-violet-200/90 bg-gradient-to-r from-violet-50/90 to-white px-2 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-950"
            onClick={() => setExpanded((v) => !v)}
          >
            <Sparkles className="h-3.5 w-3.5 text-violet-600" />
            跟进助手
            {playbook?.alert.score_delta != null ? (
              <span className="font-normal text-violet-800/80">
                意向 +{playbook.alert.score_delta}
              </span>
            ) : playbook?.customer.intent_score != null ? (
              <span className="font-normal text-violet-800/80">意向 {playbook.customer.intent_score}</span>
            ) : null}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <div className="flex flex-wrap gap-1">
            {playbook?.alert.ai_script?.trim() ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={() => onApplyReply(playbook.alert.ai_script!.trim())}
              >
                填入系统话术
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setDialogOpen(true)}
            >
              完整助手
            </Button>
            {playbook?.links?.ai_assistant ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => navigate(playbook.links.ai_assistant)}
              >
                AI 优化
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <p className="mt-1 text-[11px] text-muted-foreground">加载推荐话术…</p>
        ) : expanded && scripts.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {scripts.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-violet-100 bg-white/80 px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-xs font-medium text-slate-800">
                    <BookOpen className="h-3 w-3 shrink-0 text-violet-600" />
                    {s.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{s.body_preview}…</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => void copyText(s.body)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => onApplyReply(s.body)}
                  >
                    填入
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : expanded && playbook ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            暂无话术库匹配。点回复栏 🤖 将自动带入跟进助手上下文生成草稿。
          </p>
        ) : null}
      </div>

      <IntentAlertPlaybookDialog
        customerId={customerId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
