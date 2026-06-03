/**
 * @file 平台方 · 全站租户列表。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot } from 'lucide-react'
import { getJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type TenantRow = {
  id: number
  name: string
  contact_phone: string | null
  created_at: string
  admin: { username: string; real_name: string | null } | null
  customers_count: number
  subscription: {
    status: string
    plan_code: string | null
    plan_name: string | null
    days_remaining: number | null
  } | null
  inbox_ai?: {
    platform_disabled: boolean
    auto_send_faq: boolean
    auto_send_pricing: boolean
    anomaly_level: 'warn' | 'critical' | null
  }
}

export function PlatformTenantsPage() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [anomalyOnly, setAnomalyOnly] = useState(false)
  const [list, setList] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', size: '50' })
      if (search) params.set('q', search)
      if (anomalyOnly) params.set('inbox_ai_anomaly', '1')
      const data = await getJson<{ list: TenantRow[] }>(`/platform/tenants?${params}`)
      setList(data.list || [])
    } finally {
      setLoading(false)
    }
  }, [search, anomalyOnly])

  useEffect(() => {
    void load()
  }, [load])

  function statusLabel(row: TenantRow) {
    const sub = row.subscription
    if (!sub) return '—'
    if (sub.status === 'trialing') return '试用中'
    if (sub.status === 'active' && sub.plan_code === 'free') return '体验版'
    if (sub.status === 'active') return '付费中'
    return sub.status
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">租户管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看全站企业、订阅状态，进入详情可开通套餐或延长试用。</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="搜索企业名 / 手机号"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setSearch(q.trim())}
        />
        <Button type="button" onClick={() => setSearch(q.trim())}>
          搜索
        </Button>
        <Button
          type="button"
          variant={anomalyOnly ? 'default' : 'outline'}
          className={!anomalyOnly ? 'border-violet-300 text-violet-900' : ''}
          onClick={() => setAnomalyOnly((v) => !v)}
        >
          <Bot className="mr-1 h-4 w-4" />
          仅 AI 异常
        </Button>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/app/platform/inbox-ai-anomalies">异常名单</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>企业</TableHead>
                <TableHead>管理员</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>AI 自动发</TableHead>
                <TableHead>客户数</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.admin?.real_name || row.admin?.username || '—'}</TableCell>
                  <TableCell>
                    {row.subscription?.plan_code === 'free' ? '体验版' : row.subscription?.plan_name || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{statusLabel(row)}</Badge>
                    {row.subscription?.days_remaining != null && row.subscription.days_remaining >= 0 ? (
                      <span className="ml-1 text-xs text-muted-foreground">{row.subscription.days_remaining} 天</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.inbox_ai?.platform_disabled ? (
                      <Badge variant="destructive">平台关停</Badge>
                    ) : row.inbox_ai?.anomaly_level ? (
                      <Badge
                        variant={row.inbox_ai.anomaly_level === 'critical' ? 'destructive' : 'secondary'}
                        className={
                          row.inbox_ai.anomaly_level === 'warn'
                            ? 'border-amber-300 bg-amber-50 text-amber-900'
                            : ''
                        }
                      >
                        异常·{row.inbox_ai.anomaly_level === 'critical' ? '严重' : '关注'}
                      </Badge>
                    ) : row.inbox_ai?.auto_send_faq || row.inbox_ai?.auto_send_pricing ? (
                      <Badge variant="outline" className="border-violet-300 text-violet-900">
                        已开启
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">未开启</span>
                    )}
                  </TableCell>
                  <TableCell>{row.customers_count}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/app/platform/tenants/${row.id}`}>详情</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    无匹配租户
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
