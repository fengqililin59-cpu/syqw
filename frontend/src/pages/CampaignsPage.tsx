/**
 * @file 裂变活动列表：任务宝卡片、状态与快捷操作。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, Plus, BarChart2 } from 'lucide-react'
import { duplicateCampaign, endCampaign, fetchCampaigns, pauseCampaign, startCampaign } from '@/api/campaigns'
import type { CampaignRow, Paginated } from '@/api/types'
import { hasPermUser } from '@/lib/roles'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const statusLabel: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  paused: '已暂停',
  ended: '已结束',
}

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'active') return 'default'
  if (s === 'ended') return 'secondary'
  return 'outline'
}

export function CampaignsPage() {
  const permissions = useAuthStore((s) => s.permissions)
  const canView = hasPermUser(permissions, 'campaign:view')
  const canManage = hasPermUser(permissions, 'campaign:manage')
  const [filter, setFilter] = useState<string>('all')
  const [data, setData] = useState<Paginated<CampaignRow> | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const q =
        filter === 'all'
          ? undefined
          : {
              status: filter,
            }
      const res = await fetchCampaigns({ page: 1, size: 50, ...q })
      setData(res)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (canView) {
      void load()
    } else {
      setLoading(false)
    }
  }, [canView, load])

  async function onStart(id: number) {
    await startCampaign(id)
    await load()
  }
  async function onPause(id: number) {
    await pauseCampaign(id)
    await load()
  }
  async function onEnd(id: number) {
    if (!window.confirm('确定结束该活动？结束后不可再邀请。')) return
    await endCampaign(id)
    await load()
  }
  async function onDuplicate(id: number) {
    await duplicateCampaign(id)
    await load()
  }

  return (
    <div className="space-y-6">
      {!canView ? <p className="text-sm text-destructive">缺少权限：campaign:view</p> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">裂变活动</h1>
          <p className="text-sm text-muted-foreground">任务宝：邀请达标自动记奖（奖品接口可后续对接）</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground shrink-0">状态</Label>
            <select
              className={cn(
                'h-9 w-[140px] rounded-md border border-input bg-transparent px-2 text-sm shadow-sm',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">全部</option>
              <option value="draft">草稿</option>
              <option value="active">进行中</option>
              <option value="paused">已暂停</option>
              <option value="ended">已结束</option>
            </select>
          </div>
          {canManage ? (
            <Button asChild>
              <Link to="/app/campaigns/new" className="gap-1">
                <Plus className="h-4 w-4" />
                新建活动
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">加载中…</p> : null}

      {!loading && data?.list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Gift className="mb-2 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">暂无活动</p>
            {canManage ? (
              <Button asChild className="mt-4" variant="secondary">
                <Link to="/app/campaigns/new">创建第一个活动</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.list.map((c) => (
          <Card key={c.id} className="flex flex-col">
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg leading-tight">{c.name}</CardTitle>
                <Badge variant={statusVariant(c.status)}>{statusLabel[c.status] ?? c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                目标 {c.target_count} 人 · 奖品 {c.reward_type}
              </p>
            </CardHeader>
            <CardContent className="mt-auto flex flex-wrap gap-2 border-t pt-4">
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/app/campaigns/${c.id}`} className="gap-1">
                  <BarChart2 className="h-3.5 w-3.5" />
                  数据详情
                </Link>
              </Button>
              {canManage ? (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/app/campaigns/${c.id}/edit`}>编辑</Link>
                  </Button>
                  {c.status === 'draft' || c.status === 'paused' ? (
                    <Button size="sm" type="button" onClick={() => void onStart(c.id)}>
                      启动
                    </Button>
                  ) : null}
                  {c.status === 'active' ? (
                    <Button size="sm" variant="outline" type="button" onClick={() => void onPause(c.id)}>
                      暂停
                    </Button>
                  ) : null}
                  {c.status !== 'ended' ? (
                    <Button size="sm" variant="ghost" type="button" onClick={() => void onEnd(c.id)}>
                      结束
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" type="button" onClick={() => void onDuplicate(c.id)}>
                    复制
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
