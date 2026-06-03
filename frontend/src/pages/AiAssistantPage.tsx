/**
 * @file 站内 AI 智能助手：多轮对话，按 ai_calls 配额计费。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bot, Copy, Loader2, Send, Sparkles } from 'lucide-react'
import { getJson, postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHelpCard } from '@/components/PageHelpCard'
import { cn } from '@/lib/utils'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

type QuotaInfo = {
  usage: { ai_calls_used: number }
  plan: { ai_calls_monthly: number; name: string; code: string }
}

const SCENES = [
  { id: 'general', label: '通用咨询' },
  { id: 'sales', label: '销售话术' },
  { id: 'copy', label: '营销文案' },
  { id: 'followup', label: '客户跟进' },
  { id: 'objection', label: '异议处理' },
] as const

const STARTERS = [
  '帮我写一条朋友圈种草文案，产品是企微私域 CRM',
  '客户说「再考虑考虑」，怎么跟进不惹人烦？',
  '新加微信的客户，第一条消息怎么发？',
  '如何把高意向客户推进到成交？',
]

export function AiAssistantPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content:
        '你好，我是 ZhiFlow 站内 AI 助手。可直接问我私域销售、话术、文案、跟进策略等问题，无需跳转外部网站。',
    },
  ])
  const [input, setInput] = useState('')
  const [scene, setScene] = useState<(typeof SCENES)[number]['id']>('general')
  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [quotaErr, setQuotaErr] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadQuota = useCallback(async () => {
    try {
      const data = await getJson<QuotaInfo>('/billing/subscription')
      setQuota(data)
      setQuotaErr(null)
    } catch {
      setQuotaErr('无法读取 AI 用量')
    }
  }, [])

  useEffect(() => {
    void loadQuota()
  }, [loadQuota])

  useEffect(() => {
    const sceneParam = searchParams.get('scene')?.trim()
    if (sceneParam && SCENES.some((s) => s.id === sceneParam)) {
      setScene(sceneParam as (typeof SCENES)[number]['id'])
    }
    const q = searchParams.get('q')?.trim()
    if (q) setInput(q)
    if (sceneParam || q) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const nextMessages: ChatMsg[] = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const apiMessages = nextMessages.filter((m) => m.role === 'user' || m.role === 'assistant')
      const data = await postJson<{ reply: string }>('/ai/assistant', {
        messages: apiMessages,
        scene,
      })
      setMessages([...nextMessages, { role: 'assistant', content: data.reply }])
      void loadQuota()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '发送失败'
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: msg.includes('上限') || msg.includes('402')
            ? `${msg}。请前往「套餐计费」升级 AI 助手版或 AI 旗舰版。`
            : `抱歉，暂时无法回答：${msg}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const aiUsed = quota?.usage.ai_calls_used ?? 0
  const aiLimit = quota?.plan.ai_calls_monthly ?? 0
  const aiPct =
    aiLimit > 0 ? Math.min(100, Math.round((aiUsed / aiLimit) * 100)) : aiLimit === -1 ? 0 : 100

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-4xl flex-col gap-3">
      <PageHelpCard
        title="AI 智能助手"
        summary="在平台内与 AI 对话，获取销售话术、文案与跟进建议。每条 AI 回复计 1 次调用，可在「套餐计费」查看用量或升级 AI 专用套餐。"
        steps={[
          { title: '选场景', detail: '顶部切换销售话术、文案、跟进等模式，回答更贴合场景。' },
          { title: '直接提问', detail: '可粘贴客户原话，或描述你要写的朋友圈/群发内容。' },
          { title: '复制使用', detail: '鼠标悬停 AI 回复可一键复制，粘贴到企微发给客户。' },
        ]}
        tip="AI 不会自动给客户发消息；外发前请人工核对。用量用尽请到「套餐计费 → AI 专用套餐」升级。"
        defaultOpen={false}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI 智能助手</h1>
            <p className="text-sm text-muted-foreground">站内对话，按次计费，数据不出平台</p>
          </div>
        </div>
        {quota ? (
          <Card className="min-w-[220px] border-sky-200/80 shadow-none">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">
                本月 AI 用量 · {quota.plan.name}
              </p>
              <p className="mt-1 text-sm font-medium">
                {aiLimit === -1 ? `${aiUsed} 次（不限）` : `${aiUsed} / ${aiLimit} 次`}
              </p>
              {aiLimit > 0 ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      aiPct > 90 ? 'bg-red-500' : aiPct > 70 ? 'bg-amber-500' : 'bg-sky-500',
                    )}
                    style={{ width: `${aiPct}%` }}
                  />
                </div>
              ) : null}
              <Link to="/app/billing" className="mt-2 inline-block text-xs text-primary underline">
                升级 AI 套餐
              </Link>
            </CardContent>
          </Card>
        ) : quotaErr ? (
          <p className="text-xs text-muted-foreground">{quotaErr}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {SCENES.map((s) => (
          <Button
            key={s.id}
            type="button"
            size="sm"
            variant={scene === s.id ? 'default' : 'outline'}
            onClick={() => setScene(s.id)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="shrink-0 border-b py-3">
          <CardTitle className="text-sm font-medium">对话</CardTitle>
          <CardDescription className="text-xs">每条回复计 1 次 AI 调用</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-0">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'group relative max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border bg-muted/50 text-foreground',
                  )}
                >
                  {m.content}
                  {m.role === 'assistant' && m.content.length > 20 ? (
                    <button
                      type="button"
                      className="absolute -bottom-1 right-2 opacity-0 transition group-hover:opacity-100"
                      title="复制"
                      onClick={() => void navigator.clipboard.writeText(m.content)}
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 思考中…
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 ? (
            <div className="flex shrink-0 flex-wrap gap-2 border-t px-4 py-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                  onClick={() => void send(s)}
                >
                  <Sparkles className="mr-1 inline h-3 w-3" />
                  {s.slice(0, 28)}…
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex shrink-0 gap-2 border-t p-4">
            <textarea
              className="min-h-[44px] flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={2}
              placeholder="输入问题，Enter 发送，Shift+Enter 换行"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <Button type="button" disabled={loading || !input.trim()} onClick={() => void send()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
