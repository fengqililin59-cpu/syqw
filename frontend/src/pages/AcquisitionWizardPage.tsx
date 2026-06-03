/**
 * @file 获客向导：按渠道配置活码 / 监测链 / 留资，含抖音巨量 API 接入说明。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, Copy, ExternalLink, Rocket } from 'lucide-react'
import { getJson } from '@/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type WizardChannel = {
  id: string
  title: string
  summary: string
  steps: string[]
  links: { label: string; path: string }[]
  templates?: Record<string, string | Record<string, unknown>>
  api_status?: 'ready' | 'partial' | 'planned'
  api_integration?: Record<
    string,
    {
      status?: string
      entry?: string
      route?: string
      platform_key?: string
      vendor_doc?: string
      env_vars?: string[]
      env_vars_suggested?: string[]
      note?: string
    }
  >
}

type WizardData = {
  tenant_id: number
  public_api_base: string
  frontend_base: string
  disclaimer: string
  checklist: { progress_percent: number; done_count: number; total: number; items: { key: string; label: string; done: boolean; link: string }[] }
  channels: WizardChannel[]
}

const STATUS_LABEL: Record<string, string> = {
  ready: '已可用',
  partial: '部分可用',
  planned: '待开发',
}

function statusVariant(s?: string) {
  if (s === 'ready') return 'default' as const
  if (s === 'partial') return 'secondary' as const
  return 'outline' as const
}

export function AcquisitionWizardPage() {
  const [data, setData] = useState<WizardData | null>(null)
  const [channelId, setChannelId] = useState('wework_live')
  const [copyMsg, setCopyMsg] = useState<string | null>(null)

  useEffect(() => {
    void getJson<WizardData>('/dashboard/acquisition-wizard')
      .then((d) => {
        setData(d)
        setChannelId(d.channels[0]?.id || 'wework_live')
      })
      .catch(() => setData(null))
  }, [])

  const channel = data?.channels.find((c) => c.id === channelId)

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    setCopyMsg(`已复制：${label}`)
    setTimeout(() => setCopyMsg(null), 2000)
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">加载中…</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Rocket className="h-6 w-6 text-violet-600" />
          获客向导
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.disclaimer}</p>
        {copyMsg ? <p className="mt-1 text-xs text-green-700">{copyMsg}</p> : null}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">上线进度</CardTitle>
          <CardDescription>
            {data.checklist.done_count}/{data.checklist.total} · {data.checklist.progress_percent}%
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {data.checklist.items.map((item) => (
            <Link
              key={item.key}
              to={item.link}
              className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
            >
              {item.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span>{item.label}</span>
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {data.channels.map((c) => (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant={channelId === c.id ? 'default' : 'outline'}
            onClick={() => setChannelId(c.id)}
          >
            {c.title.split('（')[0]}
            {c.api_status ? (
              <Badge className="ml-2" variant={statusVariant(c.api_status)}>
                {STATUS_LABEL[c.api_status] || c.api_status}
              </Badge>
            ) : null}
          </Button>
        ))}
      </div>

      {channel ? (
        <Card className="border-violet-200/80">
          <CardHeader>
            <CardTitle className="text-lg">{channel.title}</CardTitle>
            <CardDescription>{channel.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {channel.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>

            <div className="flex flex-wrap gap-2">
              {channel.links.map((l) => (
                <Button key={l.path} size="sm" variant="outline" asChild>
                  <Link to={l.path}>
                    {l.label}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              ))}
            </div>

            {channel.templates ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">可复制链接</p>
                {Object.entries(channel.templates).map(([key, val]) => {
                  const text = typeof val === 'string' ? val : JSON.stringify(val, null, 2)
                  return (
                    <div key={key} className="rounded-lg border bg-muted/30 p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">{key}</span>
                        <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => void copyText(text, key)}>
                          <Copy className="mr-1 h-3 w-3" />
                          复制
                        </Button>
                      </div>
                      <pre className="whitespace-pre-wrap break-all font-mono text-xs">{text}</pre>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {channel.id === 'douyin_ads' && channel.api_integration ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm">
                <p className="font-medium text-amber-950">抖音投流 API 在本项目里接哪里？</p>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-amber-900">
                  <li>
                    <strong>点击监测（已接）</strong>：巨量后台「监测链接」填上面的 monitor_url，宏用{' '}
                    <code className="rounded bg-white px-1">clickid</code>。后端入口{' '}
                    <code className="rounded bg-white px-1">GET /api/v1/ads/redirect</code>，代码{' '}
                    <code className="rounded bg-white px-1">adTracking.service.js</code>，平台记为{' '}
                    <code className="rounded bg-white px-1">ocean</code>。
                  </li>
                  <li>
                    <strong>转化回传（已接）</strong>：监测链带回{' '}
                    <code className="rounded bg-white px-1">callback</code> 时留资自动 GET 回传；也可配{' '}
                    <code className="rounded bg-white px-1">OCEAN_ADS_*</code> 或手动{' '}
                    <code className="rounded bg-white px-1">POST /api/v1/ads/conversion</code>。腾讯/百度/快手/小红书同理，见{' '}
                    <code className="rounded bg-white px-1">GET /ads/conversion/platforms</code>。
                  </li>
                  <li>
                    <strong>消耗同步（待接）</strong>：参考已实现的腾讯{' '}
                    <code className="rounded bg-white px-1">tencentAdsSpendSync.service.js</code>，新建 Ocean
                    日报同步；临时可在「广告 ROI」手动导入 JSON。
                  </li>
                  <li>
                    <strong>不要和私信 Webhook 混淆</strong>：设置里的 douyin_client_secret 是「公域私信进收件箱」，不是巨量投放 API。
                  </li>
                </ul>
                <p className="mt-3 text-xs text-amber-800">
                  公网 API 根地址（部署时配置 API_PUBLIC_URL）：{data.public_api_base}
                </p>
              </div>
            ) : null}

            {channel.api_integration ? (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium">开发者：接口与代码路径</summary>
                <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-3">
                  {JSON.stringify(channel.api_integration, null, 2)}
                </pre>
              </details>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
