/**
 * @file 粘贴对话立即评分 — 零配置 AI 体验入口。
 */
import { useMemo, useState } from 'react'
import { Copy, Loader2, Sparkles, Zap } from 'lucide-react'
import { postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHelpCard } from '@/components/PageHelpCard'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { PREMIUM_FEATURES } from '@/lib/planFeatures'
import { usePlanGate } from '@/hooks/usePlanGate'

type QuickScoreResult = {
  intent_score: number
  intent_level: string
  stage?: string
  confidence?: string
  reasoning: string
  scripts: string[]
  demo?: boolean
}

const SAMPLE_CHAT = `销售：您好，我是中数云的小王，看到您留了联系方式，想了解下您这边团队规模？
客户：我们销售团队大概 15 人，现在用 Excel 管客户，老板想上企微 CRM。
销售：明白，那您最头疼的是跟进提醒还是线索分配？
客户：主要是高意向客户容易漏跟，销售各自记笔记，老板看不到谁在推进。
销售：我们 AI 会根据聊天记录自动打意向分，还能生成跟进话术。您方便这周五下午 demo 一下吗？
客户：可以，先把报价和试用方案发我，我和老板商量，最好这周内定。`

const SCRIPT_LABELS = ['关怀型', '价值型', '促成型']

function intentLevelColor(level: string) {
  if (level.includes('高')) return 'bg-emerald-500/15 text-emerald-700 border-emerald-200'
  if (level.includes('低')) return 'bg-slate-500/15 text-slate-700 border-slate-200'
  return 'bg-amber-500/15 text-amber-800 border-amber-200'
}

function ScoreRing({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, Math.round(score)))
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  const strokeClass =
    value >= 70 ? 'stroke-emerald-500' : value >= 40 ? 'stroke-amber-500' : 'stroke-slate-400'

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-muted" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={cn('transition-all duration-700 ease-out', strokeClass)}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums tracking-tight">{value}</span>
        <span className="text-xs text-muted-foreground">意向分</span>
      </div>
    </div>
  )
}

export function QuickScorePage() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QuickScoreResult | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const { runGated, gateDialog, locked } = usePlanGate(PREMIUM_FEATURES.AI_INTENT_SCORE)

  const charCount = text.length
  const canSubmit = text.trim().length > 0 && charCount <= 8000 && !loading

  const metaLine = useMemo(() => {
    if (!result) return null
    const parts = [result.stage, result.confidence ? `置信度 ${result.confidence}` : null].filter(Boolean)
    return parts.length ? parts.join(' · ') : null
  }, [result])

  async function analyze() {
    runGated(async () => {
      const payload = text.trim().slice(0, 8000)
      if (!payload || loading) return

      setLoading(true)
      setError(null)

      try {
        const data = await postJson<QuickScoreResult>('/ai/quick-score', { text: payload })
        setResult(data)
      } catch (e: unknown) {
        setResult(null)
        setError(e instanceof Error ? e.message : '分析失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    })
  }

  async function copyScript(script: string, idx: number) {
    try {
      await navigator.clipboard.writeText(script)
      setCopiedIdx(idx)
      window.setTimeout(() => setCopiedIdx(null), 1800)
    } catch {
      setCopiedIdx(null)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-6">
      {gateDialog}
      {locked ? (
        <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-4 py-3 text-sm text-violet-900">
          体验版不含 AI 意向评分。升级专业版后可粘贴对话立即分析，并生成跟进话术。
        </div>
      ) : null}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Zap className="h-6 w-6" />
          <h1 className="text-2xl font-semibold tracking-tight">粘贴对话，立即评分</h1>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          从微信或企微复制一段真实对话，无需配置会话存档，AI 会判断客户意向并生成 3 条可直接发送的跟进话术。
        </p>
      </div>

      <PageHelpCard
        title="适合第一次体验"
        summary="演示账号会返回示例结果；正式租户将调用真实 AI。建议粘贴 10 轮以上对话，包含客户提问与决策信号，评分更准确。"
        steps={[
          { title: '复制对话', detail: '从微信/企微聊天记录复制销售与客户的往来' },
          { title: '点击 AI 分析', detail: '系统自动给出 0-100 意向分与 3 条跟进话术' },
          { title: '一键复制发送', detail: '选一条话术复制到企微，立即跟进客户' },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">对话内容</CardTitle>
            <CardDescription>最长 8000 字，可直接粘贴销售与客户的聊天记录</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 8000))}
              placeholder={SAMPLE_CHAT}
              rows={14}
              className="min-h-[280px] w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={cn('text-xs tabular-nums', charCount >= 7800 ? 'text-amber-600' : 'text-muted-foreground')}>
                {charCount} / 8000
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setText(SAMPLE_CHAT)}>
                  填入示例
                </Button>
                <Button type="button" disabled={!canSubmit} onClick={() => void analyze()}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      分析中…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      AI 分析
                    </>
                  )}
                </Button>
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>

        <Card className={cn(!result && 'border-dashed')}>
          <CardHeader>
            <CardTitle className="text-lg">AI 判断结果</CardTitle>
            <CardDescription>
              {result?.demo ? '演示模式预置结果' : result ? '基于粘贴内容生成' : '提交后将在此展示意向分与话术'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!result ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <Zap className="h-10 w-10 opacity-30" />
                <p className="text-sm">粘贴对话后点击「AI 分析」</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3">
                  <ScoreRing score={result.intent_score} />
                  <Badge variant="outline" className={cn('px-3 py-1 text-sm', intentLevelColor(result.intent_level))}>
                    {result.intent_level}
                  </Badge>
                  {metaLine ? <p className="text-xs text-muted-foreground">{metaLine}</p> : null}
                </div>

                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">AI 判断理由</p>
                  <p className="text-sm leading-relaxed">{result.reasoning}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">推荐跟进话术</p>
                  {result.scripts.map((script, idx) => (
                    <div key={idx} className="rounded-lg border bg-background p-3 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">{SCRIPT_LABELS[idx] ?? `话术 ${idx + 1}`}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => void copyScript(script, idx)}>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          {copiedIdx === idx ? '已复制' : '复制'}
                        </Button>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{script}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
