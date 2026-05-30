/**
 * @file 活动数据看板：统计 + 最近邀请 + 客户报名领码 + 管理员模拟邀请。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Copy } from 'lucide-react'
import { getJson } from '@/api/client'
import {
  enrollCampaign,
  fetchCampaign,
  fetchCampaignStats,
  simulateInvite,
} from '@/api/campaigns'
import type { CampaignRow, CampaignStats, CustomerRow, Paginated } from '@/api/types'
import { hasPermUser } from '@/lib/roles'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export function CampaignDetailPage() {
  const { id: idParam } = useParams<{ id: string }>()
  const id = Number(idParam)
  const permissions = useAuthStore((s) => s.permissions)
  const canView = hasPermUser(permissions, 'campaign:view')
  const canManage = hasPermUser(permissions, 'campaign:manage')

  const [campaign, setCampaign] = useState<CampaignRow | null>(null)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [customerId, setCustomerId] = useState('')
  const [enrollResult, setEnrollResult] = useState<string | null>(null)
  const [simInviteCode, setSimInviteCode] = useState('')
  const [simInviteeId, setSimInviteeId] = useState('')
  const [simMsg, setSimMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) return
    setLoading(true)
    setErr(null)
    try {
      const [c, s] = await Promise.all([fetchCampaign(id), fetchCampaignStats(id)])
      setCampaign(c)
      setStats(s)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
      setCampaign(null)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (canView) {
      void load()
    } else {
      setLoading(false)
    }
  }, [canView, load])

  async function onEnroll() {
    const cid = Number(customerId)
    if (!Number.isFinite(cid) || cid <= 0) {
      setEnrollResult('请输入有效客户 ID')
      return
    }
    setEnrollResult(null)
    try {
      const r = await enrollCampaign(id, { customer_id: cid })
      setEnrollResult(`邀请码：${r.invite_code}（在企业微信「联系我」创建渠道时将此字符串填入 state，≤30 字符）`)
    } catch (e) {
      setEnrollResult(e instanceof Error ? e.message : '领取失败')
    }
  }

  async function onSimulate() {
    setSimMsg(null)
    try {
      const r = await simulateInvite(id, {
        invite_code: simInviteCode.trim(),
        invitee_customer_id: Number(simInviteeId),
      })
      setSimMsg(
        r.recorded
          ? '已记一笔邀请'
          : `未计入：${r.reason ?? 'unknown'}`,
      )
      await load()
    } catch (e) {
      setSimMsg(e instanceof Error ? e.message : '失败')
    }
  }

  function copyHint() {
    if (!enrollResult?.includes('邀请码：')) return
    const m = enrollResult.match(/邀请码：(\S+)/)
    if (m?.[1]) {
      void navigator.clipboard.writeText(m[1])
    }
  }

  async function loadCustomersHint() {
    try {
      const p = await getJson<Paginated<CustomerRow>>('/customers', { params: { page: 1, size: 5 } })
      const ids = p.list.map((c) => c.id).join(', ')
      setSimMsg(ids ? `示例客户 ID（前 5 条）：${ids}` : null)
    } catch {
      setSimMsg(null)
    }
  }

  if (!Number.isFinite(id)) {
    return <p className="text-sm text-destructive">无效活动 ID</p>
  }
  if (!canView) {
    return <p className="text-sm text-destructive">缺少权限：campaign:view</p>
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">加载中…</p>
  }

  if (err || !campaign) {
    return <p className="text-sm text-destructive">{err ?? '未找到活动'}</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link to="/app/campaigns">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
        </Button>
        {canManage ? (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/app/campaigns/${id}/edit`}>编辑</Link>
          </Button>
        ) : null}
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
        <p className="text-sm text-muted-foreground">
          目标 {campaign.target_count} 人 · 奖品 {campaign.reward_type} ·{' '}
          <Badge variant="outline">{campaign.status}</Badge>
        </p>
      </div>

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">参与人数</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats.enrollment_count}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已达标</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats.achieved_count}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">总邀请次数</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats.total_invite_count}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">人均邀请</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats.avg_invite_per_participant}</CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">客户报名 / 邀请码</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            为参与客户生成唯一邀请码。公域落地页与「联系我」渠道中，将企微
            <code className="mx-1 rounded bg-muted px-1">state</code>
            设为该码，客户通过此码添加员工时，系统会归因到邀请人（需先确保获客回调会调用
            <code className="mx-1 rounded bg-muted px-1">recordCustomerAdd</code>）。
          </p>
          <div className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="cid">客户 ID</Label>
              <Input
                id="cid"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="从客户管理复制"
                disabled={!canManage}
              />
            </div>
            <Button type="button" onClick={() => void onEnroll()} disabled={!canManage}>
              领取邀请码
            </Button>
          </div>
          {enrollResult ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3 text-sm">
              <span className="break-all">{enrollResult}</span>
              <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={copyHint}>
                <Copy className="h-3.5 w-3.5" />
                复制码
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">模拟邀请（联调）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              将某客户记为被邀请人，不经过企微。适合无回调环境下验证计数与达标。
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>邀请码</Label>
                <Input value={simInviteCode} onChange={(e) => setSimInviteCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>受邀客户 ID</Label>
                <Input value={simInviteeId} onChange={(e) => setSimInviteeId(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => void onSimulate()}>
                提交模拟
              </Button>
              <Button type="button" variant="ghost" onClick={() => void loadCustomersHint()}>
                查看客户 ID 示例
              </Button>
            </div>
            {simMsg ? <p className="text-sm text-muted-foreground">{simMsg}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近邀请</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>邀请人</TableHead>
                <TableHead>受邀人</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stats?.recent_invites?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    暂无记录
                  </TableCell>
                </TableRow>
              ) : (
                stats?.recent_invites.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell>
                      {r.inviter?.name || r.inviter?.nickname || `#${r.inviter?.id ?? ''}`}
                    </TableCell>
                    <TableCell>
                      {r.invitee?.name || r.invitee?.nickname || `#${r.invitee?.id ?? ''}`}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
