/**
 * @file 自动化流程列表：查看、编辑、一键初始化起步包。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getJson, postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'
import { hasPermUser, isAdminUser } from '@/lib/roles'

type FlowRow = {
  id: number
  name: string
  status: string
  created_at?: string
  updated_at?: string
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  active: '启用',
  paused: '暂停',
}

export function FlowsListPage() {
  const navigate = useNavigate()
  const permissions = useAuthStore((s) => s.permissions)
  const user = useAuthStore((s) => s.user)
  const tenantId = useAuthStore((s) => s.tenantId)
  const canManage = hasPermUser(permissions, 'automation:manage')
  const isAdmin = isAdminUser(user)

  const [flows, setFlows] = useState<FlowRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [packLoading, setPackLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getJson<{ list: FlowRow[] }>('/flows')
      setFlows(data.list ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onStarterPack() {
    if (!isAdmin) return
    setPackLoading(true)
    setMsg(null)
    try {
      const res = await postJson<{ message: string }>('/flows/bootstrap/starter-pack', {})
      setMsg(res.message)
      await load()
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '初始化失败')
    } finally {
      setPackLoading(false)
    }
  }

  const leadFormUrl =
    tenantId != null
      ? `${window.location.origin}/lead-form.html?tenant=${tenantId}`
      : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">自动化流程</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            新客户入库、延迟节点、AI 提醒、打标签等 SOP。延迟执行需服务器开启 ENABLE_FLOW_ENGINE_CRON=1。
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Button type="button" variant="secondary" disabled={packLoading} onClick={() => void onStarterPack()}>
                {packLoading ? '初始化中…' : '一键起步包'}
              </Button>
            ) : null}
            <Button type="button" onClick={() => navigate('/app/flow-builder')}>
              新建流程
            </Button>
          </div>
        ) : null}
      </div>

      {msg ? <p className="text-sm text-green-600 dark:text-green-500">{msg}</p> : null}

      {tenantId && leadFormUrl ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">H5 留资表单</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>将下方链接嵌入官网、落地页或广告落地页，提交后自动创建客户并触发「新客户入库」流程。</p>
            <p className="break-all rounded-md bg-muted/50 p-2 font-mono text-xs text-foreground">{leadFormUrl}</p>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={leadFormUrl} target="_blank" rel="noreferrer">
                预览表单
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : flows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            暂无流程。管理员可点「一键起步包」，或「新建流程」/ 在流程编排页「一键创建欢迎流程」。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {flows.map((f) => (
            <Card key={f.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{f.name}</CardTitle>
                <Badge variant={f.status === 'active' ? 'default' : 'secondary'}>
                  {statusLabels[f.status] ?? f.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">ID {f.id}</span>
                {canManage ? (
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link to={`/app/flow-builder?id=${f.id}`}>编辑</Link>
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <Link to={`/app/flow-builder?id=${f.id}`}>查看</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
