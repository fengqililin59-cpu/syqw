/**
 * @file 意向跟进 playbook 弹窗（支持预警 ID 或客户 ID）。
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bot, BookOpen, Copy, ExternalLink, Loader2, Sparkles } from 'lucide-react'
import { fetchCustomerIntentPlaybook } from '@/api/customers'
import { fetchIntentAlertPlaybook, type IntentAlertPlaybook } from '@/api/settings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  alertId?: number | null
  customerId?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IntentAlertPlaybookDialog({ alertId, customerId, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const [data, setData] = useState<IntentAlertPlaybook | null>(null)
  const [showAssistant, setShowAssistant] = useState(true)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open || (!alertId && !customerId)) {
      setData(null)
      setErr(null)
      setShowAssistant(true)
      return
    }
    setLoading(true)
    const load = alertId
      ? fetchIntentAlertPlaybook(alertId)
      : fetchCustomerIntentPlaybook(customerId!)
    void load
      .then((res) => {
        const r = res as IntentAlertPlaybook & { show_assistant?: boolean; reason?: string }
        if (r.show_assistant === false) {
          setShowAssistant(false)
          setData(null)
          setErr(r.reason || '当前客户暂不需要跟进助手')
          return
        }
        setShowAssistant(true)
        setData(r)
        setErr(null)
      })
      .catch((e: unknown) => {
        setData(null)
        setErr(e instanceof Error ? e.message : '加载失败')
      })
      .finally(() => setLoading(false))
  }, [open, alertId, customerId])

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      window.alert(`已复制${label}`)
    } catch {
      window.alert('复制失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            意向跟进助手
          </DialogTitle>
          <DialogDescription>匹配话术库并生成 AI 跟进提示词，可在企微中直接发送。</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中…
          </p>
        ) : err ? (
          <p className="text-sm text-muted-foreground">{err}</p>
        ) : data && showAssistant ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium">{data.customer.name}</p>
              <p className="text-xs text-muted-foreground">
                {data.alert.score_delta != null ? (
                  <>
                    意向 {data.alert.score_before} → {data.alert.score_after}（+{data.alert.score_delta}）
                  </>
                ) : (
                  <>当前意向 {data.customer.intent_score ?? '—'}</>
                )}
                {data.customer.stage_label ? ` · ${data.customer.stage_label}` : ''}
              </p>
            </div>

            {data.alert.ai_script?.trim() ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">系统已生成话术</p>
                <p className="whitespace-pre-wrap rounded-md border bg-white px-3 py-2 text-sm">
                  {data.alert.ai_script}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void copyText(data.alert.ai_script!, '话术')}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  复制话术
                </Button>
              </div>
            ) : null}

            {data.recommended_scripts.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" />
                  话术库推荐
                </p>
                <ul className="space-y-2">
                  {data.recommended_scripts.map((s) => (
                    <li key={s.id} className="rounded-md border px-3 py-2 text-sm">
                      <p className="font-medium">{s.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.body_preview}…</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-7 px-2"
                        onClick={() => void copyText(s.body, '话术')}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        复制
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                话术库暂无匹配条目，可
                <Link
                  to={data.links.script_library}
                  className="text-primary underline"
                  onClick={() => onOpenChange(false)}
                >
                  前往话术库
                </Link>
                添加「跟进」类话术。
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          {data && showAssistant ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to={data.links.customer} onClick={() => onOpenChange(false)}>
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  客户详情
                </Link>
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false)
                    navigate(data.links.script_library)
                  }}
                >
                  话术库
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    navigate(data.links.ai_assistant)
                  }}
                >
                  <Bot className="mr-1 h-3.5 w-3.5" />
                  AI 写跟进
                </Button>
              </div>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
