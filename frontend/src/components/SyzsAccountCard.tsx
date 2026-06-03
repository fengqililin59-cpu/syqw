/**
 * @file 智学 AI（www.syzs.top）账号联通入口。
 */
import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Link2 } from 'lucide-react'
import { getJson } from '@/api/client'
import { openSyzsPlatform } from '@/lib/openSyzsPlatform'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Status = {
  enabled?: boolean
  linked: boolean
  syzs_user_id: string | null
  syzs_email: string | null
  wework_email: string | null
  platform_url: string
}

export function SyzsAccountCard() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const cfg = await getJson<{ enabled: boolean }>('/integrations/syzs/config')
      if (!cfg.enabled) {
        setStatus({ linked: false, syzs_user_id: null, syzs_email: null, wework_email: null, platform_url: 'https://www.syzs.top', enabled: false })
        return
      }
      const s = await getJson<Status>('/integrations/syzs/status')
      setStatus({ ...s, enabled: true })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function openSyzs() {
    setBusy(true)
    try {
      await openSyzsPlatform()
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null
  if (status && status.enabled === false) return null

  return (
    <Card className="border-sky-200/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4 text-sky-600" />
          智学 AI 助手（统一账号）
        </CardTitle>
        <CardDescription>
          与主站使用<strong className="font-medium text-foreground">相同邮箱或手机号</strong>即可自动联通。
          已有主站账号直接登录；没有则注册一次（预填邮箱），无需另开新身份。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status?.linked ? (
          <p className="text-sm text-green-700">已绑定智学 AI 账号（ID: {status.syzs_user_id}）</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            未绑定。请确保私域账号邮箱/手机与智学 AI 一致，从下方进入后将自动关联。
            {status?.wework_email ? ` 当前识别：${status.wework_email}` : null}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => void openSyzs()}>
            <ExternalLink className="mr-1 h-4 w-4" />
            打开智学 AI 助手
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <a href={status?.platform_url || 'https://www.syzs.top'} target="_blank" rel="noreferrer">
              访问主站
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
