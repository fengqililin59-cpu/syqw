/**
 * @file 平台运营：待回访列表（按运营备注 next_follow_at）。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { ArrowLeft, CalendarClock, Check } from 'lucide-react'
import { getJson, postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type DueItem = {
  id: number
  tenant_id: number
  tenant_name: string
  contact_phone: string | null
  note_type: string
  content: string
  next_follow_at: string
  due_status: 'overdue' | 'today' | 'upcoming'
}

type Res = {
  list: DueItem[]
  counts: { overdue: number; today: number; upcoming: number; due: number }
}

const TYPE_LABEL: Record<string, string> = {
  call: '电话',
  wechat: '企微',
  email: '邮件',
  other: '其他',
}

export function PlatformOpsFollowupsPage() {
  const [scope, setScope] = useState<'due' | 'overdue' | 'today' | 'upcoming'>('due')
  const [data, setData] = useState<Res | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getJson<Res>(`/platform/ops-followups/due?scope=${scope}&limit=100`)
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    void load()
  }, [load])

  async function markDone(noteId: number) {
    await postJson(`/platform/ops-followups/${noteId}/complete`, {})
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" asChild>
          <Link to="/app/platform">
            <ArrowLeft className="mr-1 h-4 w-4" />
            运营概览
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarClock className="h-6 w-6 text-violet-600" />
            待平台回访
          </h1>
          <p className="text-sm text-muted-foreground">来自租户详情中的运营备注「下次跟进」时间。</p>
        </div>
      </div>

      {data?.counts ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="destructive">已逾期 {data.counts.overdue}</Badge>
          <Badge className="bg-amber-500 hover:bg-amber-500">今日 {data.counts.today}</Badge>
          <Badge variant="secondary">7 日内 {data.counts.upcoming}</Badge>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(['due', 'overdue', 'today', 'upcoming'] as const).map((s) => (
          <Button key={s} size="sm" variant={scope === s ? 'default' : 'outline'} onClick={() => setScope(s)}>
            {s === 'due' ? '待处理' : s === 'overdue' ? '已逾期' : s === 'today' ? '今日' : '将到期'}
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => void load()}>
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">回访任务</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>跟进时间</TableHead>
                <TableHead>企业</TableHead>
                <TableHead>上次备注</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4}>加载中…</TableCell>
                </TableRow>
              ) : !data?.list.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    暂无待回访任务
                  </TableCell>
                </TableRow>
              ) : (
                data.list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {dayjs(row.next_follow_at).format('MM-DD HH:mm')}
                      <br />
                      {row.due_status === 'overdue' ? (
                        <Badge variant="destructive" className="mt-1">
                          逾期
                        </Badge>
                      ) : row.due_status === 'today' ? (
                        <Badge className="mt-1 bg-amber-500 hover:bg-amber-500">今日</Badge>
                      ) : (
                        <Badge variant="secondary" className="mt-1">
                          将到期
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/app/platform/tenants/${row.tenant_id}`}
                        className="font-medium text-violet-700 hover:underline"
                      >
                        {row.tenant_name}
                      </Link>
                      {row.contact_phone ? (
                        <p className="text-xs text-muted-foreground">{row.contact_phone}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-md text-xs">
                      <Badge variant="outline" className="mb-1">
                        {TYPE_LABEL[row.note_type] || row.note_type}
                      </Badge>
                      <p className="line-clamp-2 text-muted-foreground">{row.content}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/app/platform/tenants/${row.tenant_id}`}>详情</Link>
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => void markDone(row.id)}>
                          <Check className="mr-1 h-3.5 w-3.5" />
                          完成
                        </Button>
                      </div>
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
