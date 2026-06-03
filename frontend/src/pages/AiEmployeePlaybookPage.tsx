/**
 * @file AI 员工启动向导：分步检查 + 跳转配置。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, CheckCircle2, Circle, Copy, ExternalLink } from 'lucide-react'
import { getJson } from '@/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type PlaybookItem = {
  key: string
  label: string
  done: boolean
  path: string
  hint?: string
  required?: boolean
}

type PlaybookPhase = {
  id: string
  title: string
  summary: string
  items: PlaybookItem[]
}

type PlaybookData = {
  progress: {
    required_percent: number
    all_percent: number
    done_required: number
    required_total: number
  }
  phases: PlaybookPhase[]
  daily_routine: { time: string; action: string }[]
  limits: string[]
  webhook: {
    douyin_url: string
    xhs_url: string
    douyin_configured: boolean
    xhs_configured: boolean
  } | null
  server_env_hints: string[]
  inbox_auto_draft?: { enabled: boolean; delay_seconds: number; pending_threads?: number }
}

export function AiEmployeePlaybookPage() {
  const [data, setData] = useState<PlaybookData | null>(null)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)

  useEffect(() => {
    void getJson<PlaybookData>('/dashboard/ai-employee-playbook')
      .then(setData)
      .catch(() => setData(null))
  }, [])

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
    setCopyMsg('已复制')
    setTimeout(() => setCopyMsg(null), 2000)
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">加载中…</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Bot className="h-7 w-7 text-violet-600" />
          <h1 className="text-2xl font-bold tracking-tight">AI 员工启动向导</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          按「企微接客 → 收件箱接话 → AI 草稿 → 规则跟进 → 电话短信成交」配置。AI
          <strong className="font-medium text-foreground"> 不会 </strong>
          未经确认直接发给客户。
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">必做项进度</CardTitle>
          <CardDescription>
            {data.progress.done_required} / {data.progress.required_total} 项已完成
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-violet-600 transition-all"
              style={{ width: `${data.progress.required_percent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">全部项（含可选）{data.progress.all_percent}%</p>
        </CardContent>
      </Card>

      {data.phases.map((phase) => {
        const phaseDone = phase.items.filter((i) => i.done).length
        return (
          <Card key={phase.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{phase.title}</CardTitle>
                  <CardDescription>{phase.summary}</CardDescription>
                </div>
                <Badge variant="secondary">
                  {phaseDone}/{phase.items.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {phase.items.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    {item.done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {item.label}
                        {!item.required ? (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">（可选）</span>
                        ) : null}
                      </p>
                      {item.hint ? <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p> : null}
                    </div>
                  </div>
                  <Button size="sm" variant={item.done ? 'outline' : 'default'} asChild>
                    <Link to={item.path}>{item.done ? '查看' : '去配置'}</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}

      {data.webhook ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">公域 Webhook 地址（复制到抖音/小红书后台）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  抖音 {data.webhook.douyin_configured ? '✓ 已配密钥' : '未配密钥'}
                </span>
                <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => void copyText(data.webhook!.douyin_url)}>
                  <Copy className="mr-1 h-3 w-3" />
                  复制
                </Button>
              </div>
              <code className="block break-all text-xs">{data.webhook.douyin_url}</code>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  小红书 {data.webhook.xhs_configured ? '✓ 已配 Token' : '未配 Token'}
                </span>
                <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => void copyText(data.webhook!.xhs_url)}>
                  <Copy className="mr-1 h-3 w-3" />
                  复制
                </Button>
              </div>
              <code className="block break-all text-xs">{data.webhook.xhs_url}</code>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link to="/app/settings">系统设置 → 公域 Webhook</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">销售每日节奏（建议）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.daily_routine.map((r) => (
            <p key={r.time}>
              <span className="font-medium">{r.time}：</span>
              {r.action}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="text-base text-amber-950">能力边界（避免预期偏差）</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {data.limits.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {data.inbox_auto_draft ? (
        <Card className="border-violet-200 bg-violet-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">收件箱自动草稿</CardTitle>
            <CardDescription>
              {data.inbox_auto_draft.enabled
                ? `已开启 · 延迟 ${data.inbox_auto_draft.delay_seconds}s 后草稿并尝试自动发送`
                : '未开启 · 在 backend/.env 设置 INBOX_AUTO_DRAFT=1'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {data.server_env_hints.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">运维可开环境变量（增强自动化）</CardTitle>
            <CardDescription>需服务器 backend/.env，重启后生效</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-muted-foreground">
              {data.server_env_hints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2 pb-8">
        <Button asChild>
          <Link to="/app/inbox">
            打开收件箱
            <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/app/acquisition-wizard">获客向导</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/app/help">帮助中心</Link>
        </Button>
      </div>

      {copyMsg ? <p className="fixed bottom-4 right-4 rounded-md bg-foreground px-3 py-1.5 text-xs text-background">{copyMsg}</p> : null}
    </div>
  )
}
