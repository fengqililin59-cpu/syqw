/**
 * @file 平台运营概览：首发上线检查清单（可关闭，localStorage 持久化）。
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, ExternalLink, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const LAUNCH_CHECKLIST_DISMISS_KEY = 'zhiflow_launch_checklist_dismissed'

function isDismissed(): boolean {
  try {
    return localStorage.getItem(LAUNCH_CHECKLIST_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function isLaunchChecklistDismissed(): boolean {
  return isDismissed()
}

const ITEMS = [
  {
    id: 'env',
    label: '生产 env：INBOX_AI_AUTO_SEND=0（阶段 A，仅 AI 草稿、不自动外发）',
  },
  {
    id: 'migrations',
    label: '数据库迁移 072–076 已在生产执行（inbox_ai / qa 字段就绪）',
  },
  {
    id: 'wework',
    label: '企微回调与 PLATFORM_ADMIN_USER_IDS 已配置',
  },
  {
    id: 'legal',
    label: 'privacy / terms 占位已替换正式文案',
    links: [
      { href: '/privacy.html', text: '隐私政策' },
      { href: '/terms.html', text: '服务条款' },
    ],
  },
  {
    id: 'ci',
    label: '仓库 ./scripts/deploy-check.sh 与 GitHub Actions CI 均为绿',
  },
  {
    id: 'acceptance',
    label: '完成 30 分钟手工验收（AI 草稿、平台审计、审核台等）',
    appLinks: [
      { to: '/app/help', text: '帮助 · 管理员上线' },
      { to: '/app/ai-review', text: 'AI 审核台' },
    ],
  },
] as const

type PlatformLaunchChecklistCardProps = {
  visible?: boolean
  onDismiss?: () => void
}

export function PlatformLaunchChecklistCard({ visible, onDismiss }: PlatformLaunchChecklistCardProps) {
  const [hiddenInternal, setHiddenInternal] = useState(isDismissed)
  const hidden = visible !== undefined ? !visible : hiddenInternal

  function dismiss() {
    try {
      localStorage.setItem(LAUNCH_CHECKLIST_DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    onDismiss?.()
    if (visible === undefined) setHiddenInternal(true)
  }

  if (hidden) return null

  return (
    <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-sky-50/40 shadow-sm ring-1 ring-sky-200/40">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2 pt-4">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base text-amber-950">
              首发上线检查
              <Badge variant="secondary" className="border-sky-200 bg-sky-50 text-sky-800">
                Go / No-Go
              </Badge>
            </CardTitle>
            <p className="mt-0.5 text-xs text-amber-900/75">对外推广前逐项确认；任一项未满足则 No-Go。</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="关闭上线检查"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1.5 pb-4 pt-0">
        <ul className="space-y-1 text-sm text-amber-950/90">
          {ITEMS.map((item, i) => (
            <li key={item.id} className="flex gap-2 leading-snug">
              <span className="mt-0.5 shrink-0 text-xs font-medium text-sky-700">{i + 1}.</span>
              <span>
                {item.label}
                {'links' in item && item.links ? (
                  <span className="ml-1 inline-flex flex-wrap gap-x-2 gap-y-0.5">
                    {item.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-sky-700 underline-offset-2 hover:underline"
                      >
                        {link.text}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </span>
                ) : null}
                {'appLinks' in item && item.appLinks ? (
                  <span className="ml-1 inline-flex flex-wrap gap-x-2 gap-y-0.5">
                    {item.appLinks.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        className="text-sky-700 underline-offset-2 hover:underline"
                      >
                        {link.text}
                      </Link>
                    ))}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="pt-1 text-xs text-muted-foreground">
          完整清单见仓库 docs/deploy/launch-go-no-go.md
        </p>
      </CardContent>
    </Card>
  )
}
