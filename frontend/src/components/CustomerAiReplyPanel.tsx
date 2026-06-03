/**
 * @file 客户上下文 AI 回复建议（调用 /ai/chat，计入 ai_calls）+ 跟进助手话术。
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bot, Copy, Loader2, Sparkles } from 'lucide-react'
import { postJson } from '@/api/client'
import { fetchCustomerIntentPlaybook, type CustomerIntentPlaybook } from '@/api/customers'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { IntentAlertPlaybookDialog } from '@/components/IntentAlertPlaybookDialog'

type Props = {
  customerId: number
  /** 预填客户最近一条消息 */
  lastCustomerMessage?: string | null
}

export function CustomerAiReplyPanel({ customerId, lastCustomerMessage }: Props) {
  const navigate = useNavigate()
  const [input, setInput] = useState(lastCustomerMessage?.trim() || '')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<string | null>(null)
  const [replies, setReplies] = useState<string[]>([])
  const [playbookUsed, setPlaybookUsed] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [playbook, setPlaybook] = useState<CustomerIntentPlaybook | null>(null)
  const [playbookOpen, setPlaybookOpen] = useState(false)

  useEffect(() => {
    if (lastCustomerMessage?.trim()) setInput(lastCustomerMessage.trim())
  }, [lastCustomerMessage])

  useEffect(() => {
    void fetchCustomerIntentPlaybook(customerId)
      .then((r) => {
        if (r.show_assistant === false) setPlaybook(null)
        else setPlaybook(r)
      })
      .catch(() => setPlaybook(null))
  }, [customerId])

  async function generate() {
    const msg = input.trim()
    if (!msg) {
      setErr('请先输入或粘贴客户刚说的话')
      return
    }
    setErr(null)
    setLoading(true)
    setReplies([])
    setStage(null)
    setPlaybookUsed(false)
    try {
      const data = await postJson<{
        stage: string
        replies: string[]
        playbook_used?: boolean
        playbook_scripts_count?: number
      }>('/ai/chat', {
        customer_id: customerId,
        message: msg,
        include_playbook_context: true,
      })
      setStage(data.stage || null)
      setReplies(data.replies || [])
      setPlaybookUsed(Boolean(data.playbook_used))
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : '生成失败'
      setErr(text)
    } finally {
      setLoading(false)
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
  }

  const topScript = playbook?.recommended_scripts?.[0]

  return (
    <div className="mb-4 rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-semibold text-violet-950">AI 回复建议</span>
          <span className="text-xs text-muted-foreground">结合该客户聊天记录 · 计 1 次 AI 调用</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {playbook ? (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPlaybookOpen(true)}>
              <Sparkles className="mr-1 h-3 w-3" />
              跟进助手
            </Button>
          ) : null}
          <Link to="/app/ai-assistant" className="text-xs text-primary underline self-center">
            打开 AI 助手
          </Link>
        </div>
      </div>

      {topScript ? (
        <div className="mb-3 rounded-lg border border-violet-100 bg-white/90 px-3 py-2">
          <p className="text-xs font-medium text-violet-900">话术库 · {topScript.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{topScript.body_preview}…</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setInput(topScript.body)}>
              填入场景
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void copyText(topScript.body)}>
              <Copy className="mr-1 h-3 w-3" />
              复制
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label className="text-xs">客户刚说 / 你想回复的场景</Label>
        <textarea
          className="min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="粘贴客户微信原话，例如：你们价格能不能再优惠？"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={loading} onClick={() => void generate()}>
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            生成 3 条回复话术
          </Button>
          {playbook?.links?.ai_assistant ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate(playbook.links.ai_assistant)}
            >
              AI 写跟进
            </Button>
          ) : null}
        </div>
        {err ? <p className="text-xs text-destructive">{err}</p> : null}
        {stage ? (
          <p className="text-xs text-violet-800">
            判断阶段：<strong>{stage}</strong>
            {playbookUsed ? (
              <span className="ml-2 text-muted-foreground">· 已结合跟进助手话术库</span>
            ) : null}
          </p>
        ) : null}
        {replies.length > 0 ? (
          <div className="space-y-2">
            {replies.map((line, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-2 rounded-lg border border-violet-100 bg-white p-2.5 text-sm"
              >
                <span className="flex-1 leading-relaxed">{line}</span>
                <Button type="button" size="sm" variant="ghost" className="shrink-0 h-8" onClick={() => void copyText(line)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">复制后请在企微中人工发送，AI 不会自动发给客户。</p>
          </div>
        ) : null}
      </div>

      <IntentAlertPlaybookDialog
        customerId={customerId}
        open={playbookOpen}
        onOpenChange={setPlaybookOpen}
      />
    </div>
  )
}
