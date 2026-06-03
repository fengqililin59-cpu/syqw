/**
 * @file 转介绍管理：一览所有裂变活动的转介绍进度。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, BarChart2 } from 'lucide-react'
import { fetchCampaigns } from '@/api/campaigns'
import { fetchCampaignStats } from '@/api/campaigns'
import type { CampaignRow, CampaignStats } from '@/api/types'
import { hasPermUser } from '@/lib/roles'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

type CampaignWithStats = CampaignRow & { stats?: CampaignStats | null; loading?: boolean }

export function ReferralManagementPage() {
  const permissions = useAuthStore((s) => s.permissions)
  const canView = hasPermUser(permissions, 'campaign:view')
  const [filter, setFilter] = useState<string>('active')
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    setErr(null)
    try {
      const q =
        filter === 'all' ? undefined : { status: filter }
      const res = await fetchCampaigns({ page: 1, size: 50, ...q })
      const list = res.list.map((c) => ({ ...c, stats: null, loading: true }))
      setCampaigns(list)

      // 并行拉取每个活动的统计
      const withStats = await Promise.all(
        list.map(async (c) => {
          try {
            const s = await fetchCampaignStats(c.id)
            return { ...c, stats: s, loading: false }
          } catch {
            return { ...c, stats: null, loading: false }
          }
        }),
      )
      setCampaigns(withStats)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filter, canView])

  useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  // 汇总统计
  const totalParticipants = campaigns.reduce((sum, c) => sum + (c.stats?.enrollment_count ?? 0), 0)
  const totalAchieved = campaigns.reduce((sum, c) => sum + (c.stats?.achieved_count ?? 0), 0)
  const totalInvites = campaigns.reduce((sum, c) => sum + (c.stats?.total_invite_count ?? 0), 0)

  return (
    <div className="space-y-6">
      {!canView ? <p className="text-sm text-destructive">缺少权限：campaign:view</p> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">转介绍管理</h1>
          <p className="text-sm text-muted-foreground">查看所有裂变活动的客户转介绍进度与达标情况</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={cn(
              'h-9 w-[140px] rounded-md border border-input bg-transparent px-2 text-sm shadow-sm',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">全部</option>
            <option value="active">进行中</option>
            <option value="paused">已暂停</option>
            <option value="ended">已结束</option>
          </select>
          <Button variant="outline" asChild>
            <Link to="/app/campaigns">活动配置</Link>
          </Button>
        </div>
      </div>

      {/* 汇总卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">参与人数</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalParticipants}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已达标</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-green-600">{totalAchieved}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总邀请次数</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalInvites}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">活动数</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{campaigns.length}</CardContent>
        </Card>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">加载中…</p> : null}

      {/* 活动转介绍明细列表 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">活动转介绍明细</h2>
        {campaigns.length === 0 && !loading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Gift className="mb-2 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">暂无活动</p>
              <Button asChild className="mt-4" variant="secondary">
                <Link to="/app/campaigns/new">创建裂变活动</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
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
              <CardContent className="mt-auto space-y-3 border-t pt-4">
                {c.loading ? (
                  <p className="text-xs text-muted-foreground">统计加载中…</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-semibold">{c.stats?.enrollment_count ?? 0}</p>
                      <p className="text-xs text-muted-foreground">参与</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-green-600">{c.stats?.achieved_count ?? 0}</p>
                      <p className="text-xs text-muted-foreground">达标</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{c.stats?.total_invite_count ?? 0}</p>
                      <p className="text-xs text-muted-foreground">邀请</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" asChild className="flex-1">
                    <Link to={`/app/campaigns/${c.id}`} className="gap-1">
                      <BarChart2 className="h-3.5 w-3.5" />
                      详情
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
