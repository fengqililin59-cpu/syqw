import { useEffect, useMemo, useState } from 'react'
import { getCallStats, listCalls, type CallRecord } from '@/api/calls'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function statusMeta(status: CallRecord['status']) {
  if (status === 'completed') return { text: '已接通', cls: 'bg-green-100 text-green-700 border-green-200' }
  if (status === 'failed') return { text: '未接通', cls: 'bg-red-100 text-red-700 border-red-200' }
  if (status === 'calling') return { text: '通话中', cls: 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' }
  if (status === 'cancelled') return { text: '已取消', cls: 'bg-gray-100 text-gray-700 border-gray-200' }
  if (status === 'initiating') return { text: '拨号中', cls: 'bg-gray-100 text-gray-700 border-gray-200' }
  return { text: status, cls: 'bg-gray-100 text-gray-700 border-gray-200' }
}

function fmt(dt?: string | null) {
  if (!dt) return '—'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
}

export function CallRecordsPage() {
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<CallRecord[]>([])
  const [stats, setStats] = useState({ total: 0, connected: 0, connect_rate: '0.0%', avg_duration: 0 })
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('')

  const params = useMemo(
    () => ({
      page: 1,
      size: 100,
      status: status || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }),
    [endDate, startDate, status],
  )

  useEffect(() => {
    setLoading(true)
    Promise.all([listCalls(params), getCallStats(params)])
      .then(([listRes, statRes]) => {
        setRecords(listRes.list || [])
        setStats({
          total: statRes.total || 0,
          connected: statRes.connected || 0,
          connect_rate: statRes.connect_rate || '0.0%',
          avg_duration: statRes.avg_duration || 0,
        })
      })
      .finally(() => setLoading(false))
  }, [params])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">通话记录</h1>
        <p className="text-sm text-muted-foreground">查看外呼状态、时长和录音。</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-muted-foreground">总拨打</p>
          <p className="mt-1 text-xl font-semibold">{stats.total}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-muted-foreground">已接通</p>
          <p className="mt-1 text-xl font-semibold">{stats.connected}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-muted-foreground">接通率</p>
          <p className="mt-1 text-xl font-semibold">{stats.connect_rate}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-muted-foreground">平均时长</p>
          <p className="mt-1 text-xl font-semibold">{stats.avg_duration}s</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label>开始日期</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>结束日期</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label>状态</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">全部</option>
              <option value="completed">已接通</option>
              <option value="failed">未接通</option>
              <option value="calling">通话中</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => setStatus('')}>
              重置状态
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden rounded-xl border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>客户</TableHead>
              <TableHead>销售</TableHead>
              <TableHead>方式</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>时长</TableHead>
              <TableHead>录音</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => {
              const s = statusMeta(r.status)
              return (
                <TableRow key={r.id}>
                  <TableCell>{fmt(r.created_at)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.customer?.name || `客户#${r.customer_id}`}</div>
                    <div className="text-xs text-muted-foreground">{r.customer?.phone || '—'}</div>
                  </TableCell>
                  <TableCell>{r.caller?.real_name || r.caller?.username || '—'}</TableCell>
                  <TableCell>{r.dial_mode === 'webrtc' ? '网页软电话' : '手机接听'}</TableCell>
                  <TableCell>
                    <Badge className={s.cls}>{s.text}</Badge>
                  </TableCell>
                  <TableCell>{r.status === 'completed' ? `${r.duration_seconds}s` : '—'}</TableCell>
                  <TableCell>
                    {r.recording_url ? <audio controls src={r.recording_url} className="h-8 w-full max-w-[200px]" preload="none" /> : '—'}
                  </TableCell>
                </TableRow>
              )
            })}
            {!records.length && !loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  暂无通话记录
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {records.map((r) => {
          const s = statusMeta(r.status)
          return (
            <div key={r.id} className="rounded-xl border bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{r.customer?.name || `客户#${r.customer_id}`}</p>
                  <p className="text-xs text-muted-foreground">{r.customer?.phone || '—'}</p>
                </div>
                <Badge className={s.cls}>{s.text}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                销售：{r.caller?.real_name || r.caller?.username || '—'} · {fmt(r.created_at)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.dial_mode === 'webrtc' ? '网页软电话' : '手机接听'} {r.duration_seconds > 0 ? `· ${r.duration_seconds}s` : ''}
              </p>
              {r.recording_url ? <audio controls src={r.recording_url} className="mt-2 h-8 w-full" preload="none" /> : null}
            </div>
          )
        })}
        {!records.length && !loading ? <p className="text-sm text-muted-foreground">暂无通话记录</p> : null}
      </div>
    </div>
  )
}
