/**
 * @file 公域导流模板：抖音 / 小红书 / 视频号 / 公众号话术与落地建议（静态）。
 */
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getJson } from '@/api/client'

const blocks = [
  {
    title: '抖音',
    way: '主页链接、私信自动回复、短视频置顶评论',
    copy: '「私信我领 XX 福利」「评论区扣 1 发你资料」',
    landing: '企业微信「联系我」落地页；state 填裂变邀请码以归因邀请关系。',
  },
  {
    title: '小红书',
    way: '笔记正文引导、评论区、瞬间、合集简介',
    copy: '「想要资料包的后台滴滴」「想要的姐妹评论区蹲一下」',
    landing: '置顶评论挂短链或二维码图片；落地到企微活码页（自动通过更佳）。',
  },
  {
    title: '视频号',
    way: '直播间口播、商品栏、短视频结尾',
    copy: '「点下方客服领优惠」「添加顾问锁定名额」',
    landing: '使用企业微信客服或联系我链接；大促时配合限时话术。',
  },
  {
    title: '公众号',
    way: '关注回复、关键词回复、菜单栏',
    copy: '「回复「福利」获取顾问二维码」「菜单栏点击添加专属顾问」',
    landing: '图文内嵌活码；如需统计渠道，不同推文可使用不同活码 state。',
  },
]

type WebhookInfo = {
  tenant_id: number
  header: string
  platform_headers?: { douyin?: string; xiaohongshu?: string }
  platform_hints?: { douyin_secret_configured?: boolean; xhs_token_configured?: boolean }
  url_template: string
  example_douyin: string
  example_xiaohongshu: string
  example_wechat_mp?: string
  example_payloads?: Record<string, Record<string, string>>
  curl_example?: string
  note: string
}

export function GuideTemplatesPage() {
  const [webhook, setWebhook] = useState<WebhookInfo | null>(null)

  useEffect(() => {
    getJson<WebhookInfo>('/inbox/webhook-info')
      .then((data) => setWebhook(data))
      .catch(() => setWebhook(null))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">获客指南 · 公域导流</h1>
        <p className="text-sm text-muted-foreground">
          以下为常用模板，可按行业改写；与「渠道活码」「裂变活动」配合：活码 / 联系我的{' '}
          <code className="rounded bg-muted px-1">state</code> 用于回调归因。
        </p>
      </div>
      {webhook && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">公域私信 Webhook（统一收件箱）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              在抖音/小红书开放平台或自建转发服务中，将消息 POST 到下方地址。验签方式：
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                抖音官方：<code className="rounded bg-muted px-1">{webhook.platform_headers?.douyin || 'X-Douyin-Signature'}</code>{' '}
                {webhook.platform_hints?.douyin_secret_configured ? '（租户已配置 Secret）' : '（请在设置→运维工具配置 client_secret）'}
              </li>
              <li>
                小红书官方：<code className="rounded bg-muted px-1">{webhook.platform_headers?.xiaohongshu || 'X-Red-Signature'}</code>{' '}
                {webhook.platform_hints?.xhs_token_configured ? '（租户已配置 Token）' : '（请在设置→运维工具配置 webhook token）'}
              </li>
              <li>
                Legacy 联调：<code className="rounded bg-muted px-1">{webhook.header}</code> 与服务器{' '}
                <code className="rounded bg-muted px-1">PUBLIC_INBOX_WEBHOOK_SECRET</code> 一致
              </li>
            </ul>
            <p className="break-all rounded-md bg-muted/50 p-2 font-mono text-xs">
              {webhook.example_douyin}
            </p>
            <p className="break-all rounded-md bg-muted/50 p-2 font-mono text-xs">
              {webhook.example_xiaohongshu}
            </p>
            {webhook.example_wechat_mp ? (
              <p className="break-all rounded-md bg-muted/50 p-2 font-mono text-xs">
                {webhook.example_wechat_mp}
              </p>
            ) : null}
            <p className="text-muted-foreground">{webhook.note}</p>
            {webhook.example_payloads ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">JSON 示例（可直接用于联调）</p>
                {Object.entries(webhook.example_payloads).map(([key, payload]) => (
                  <pre
                    key={key}
                    className="overflow-x-auto rounded-md bg-muted/50 p-2 font-mono text-xs leading-relaxed"
                  >
                    {key}: {JSON.stringify(payload, null, 2)}
                  </pre>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                JSON 示例：{' '}
                <code className="rounded bg-muted px-1">{`{"open_id":"u123","text":"你好"}`}</code> 或标准字段{' '}
                <code className="rounded bg-muted px-1">external_thread_key + content</code>
              </p>
            )}
            {webhook.curl_example ? (
              <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {webhook.curl_example}
              </pre>
            ) : null}
            <p className="text-muted-foreground">
              管理员可在「设置 → 运维工具」发送测试消息验证收件箱入站；相同 msg_id 会自动去重。
            </p>
            <p className="text-muted-foreground">
              H5 留资：在「自动化流程」列表页复制表单链接，或访问{' '}
              <code className="rounded bg-muted px-1">/lead-form.html?tenant=租户ID</code>。
            </p>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {blocks.map((b) => (
          <Card key={b.title}>
            <CardHeader>
              <CardTitle className="text-lg">{b.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="font-medium text-muted-foreground">导流方式</div>
                <p>{b.way}</p>
              </div>
              <Separator />
              <div>
                <div className="font-medium text-muted-foreground">话术示例</div>
                <p className="rounded-md bg-muted/50 p-2">{b.copy}</p>
              </div>
              <Separator />
              <div>
                <div className="font-medium text-muted-foreground">落地页建议</div>
                <p>{b.landing}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
