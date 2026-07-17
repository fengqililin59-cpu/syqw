/**
 * @file 本周销售战力榜 — 团队竞争与老板可见排行。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Medal, Trophy } from 'lucide-react'
import {
  fetchLeaderboard,
  type LeaderboardDimension,
  type LeaderboardMemberStats,
  type LeaderboardResponse,
} from '@/api/analytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function medalFor(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return null
}

function LeaderboardTable({
  dimension,
  showAll,
}: {
  dimension: LeaderboardDimension
  showAll: boolean
}) {
  const items = showAll ? dimension.items : dimension.items.slice(0, 5)
  const maxVal = items[0]?.value || 1

  if (!items.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        本周暂无数据，完成跟进或成交后将出现在榜单
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const medal = medalFor(item.rank)
        const pct =
          dimension.key === 'response_speed'
            ? Math.max(20, 100 - item.rank * 8)
            : Math.max((item.value / maxVal) * 100, 6)
        return (
          <div key={item.user_id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
            <span className="w-8 text-center text-sm font-semibold tabular-nums text-muted-foreground">
              {medal || item.rank}
            </span>
            <span className="min-w-[72px] truncate text-sm font-medium">{item.real_name}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  item.rank === 1 ? 'bg-amber-400' : item.rank === 2 ? 'bg-slate-400' : item.rank === 3 ? 'bg-amber-600' : 'bg-primary/70',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-semibold tabular-nums text-foreground">{item.display}</span>
          </div>
        )
      })}
    </div>
  )
}

function SelfRankCards({
  data,
}: {
  data: LeaderboardResponse & { scope: 'self' }
}) {
  const stats = data.my_stats
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">我的本周数据</CardTitle>
          <CardDescription>周期 {data.week_label}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">成交</p>
            <p className="text-2xl font-bold">{stats?.deals ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">跟进</p>
            <p className="text-2xl font-bold">{stats?.followups ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">AI 采纳率</p>
            <p className="text-2xl font-bold">
              {stats?.ai_adoption_rate != null ? `${stats.ai_adoption_rate}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">平均响应</p>
            <p className="text-2xl font-bold">
              {stats?.avg_response_minutes != null ? `${stats.avg_response_minutes} 分` : '—'}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">我的排名</CardTitle>
          <CardDescription>仅展示个人名次，完整榜单需管理员权限</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.dimensions.map((d) => (
            <div key={d.key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{d.label}</span>
              {d.my_rank ? (
                <Badge variant="secondary">第 {d.my_rank.rank} 名 · {d.my_rank.display}</Badge>
              ) : (
                <span className="text-muted-foreground">未上榜</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchLeaderboard()
      setData(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dimensions =
    data?.scope === 'team'
      ? data.dimensions
      : data?.scope === 'self'
        ? (data.dimensions.map((d) => ({
            key: d.key,
            label: d.label,
            items: d.top_items ?? [],
          })) as LeaderboardDimension[])
        : []

  const activeDim = dimensions[activeTab]

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-amber-600">
            <Trophy className="h-6 w-6" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">销售战力榜</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            本周排行（成交、跟进、AI 话术采纳、响应速度）。周一晨报会推送上周冠军。
          </p>
        </div>
        {data?.week_label ? (
          <Badge variant="outline" className="text-sm">周期 {data.week_label}</Badge>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中…
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data?.scope === 'self' ? <SelfRankCards data={data} /> : null}

      {data && dimensions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Medal className="h-5 w-5 text-amber-500" />
              {data.scope === 'team' ? '团队排行榜' : '本周 TOP3 预览'}
            </CardTitle>
            <CardDescription>
              {data.scope === 'team'
                ? '管理员可见全员；数据每小时随业务更新'
                : '升级管理员账号可查看完整团队榜单'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {dimensions.map((dim, i) => (
                <Button
                  key={dim.key}
                  type="button"
                  size="sm"
                  variant={activeTab === i ? 'default' : 'outline'}
                  onClick={() => setActiveTab(i)}
                >
                  {dim.label}
                </Button>
              ))}
            </div>
            {activeDim ? <LeaderboardTable dimension={activeDim} showAll={data.scope === 'team'} /> : null}
          </CardContent>
        </Card>
      ) : null}

      {data?.scope === 'team' && data.members.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">全员明细</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">销售</th>
                  <th className="pb-2 pr-4">成交</th>
                  <th className="pb-2 pr-4">跟进</th>
                  <th className="pb-2 pr-4">AI 采纳率</th>
                  <th className="pb-2">响应(分)</th>
                </tr>
              </thead>
              <tbody>
                {(data.members as LeaderboardMemberStats[])
                  .sort((a, b) => b.deals + b.followups - a.deals - a.followups)
                  .map((m) => (
                    <tr key={m.user_id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{m.real_name}</td>
                      <td className="py-2 pr-4 tabular-nums">{m.deals}</td>
                      <td className="py-2 pr-4 tabular-nums">{m.followups}</td>
                      <td className="py-2 pr-4 tabular-nums">
                        {m.ai_adoption_rate != null ? `${m.ai_adoption_rate}%` : '—'}
                      </td>
                      <td className="py-2 tabular-nums">
                        {m.avg_response_minutes != null ? m.avg_response_minutes : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        更多团队监控见{' '}
        <Link to="/app/employee-activity" className="text-primary underline-offset-2 hover:underline">
          员工活动看板
        </Link>
      </p>
    </div>
  )
}
