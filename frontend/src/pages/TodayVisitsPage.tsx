/**
 * @file 今日到店：门店前台高频页。大按钮、少跳转，优先适配移动端与平板。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Check, Phone, UserCheck, UserX } from 'lucide-react'
import {
  fetchTodayBoard,
  markArrived,
  markCompleted,
  markNoShow,
  staffName,
  APPOINTMENT_STATUS_COLOR,
  APPOINTMENT_STATUS_LABEL,
  type Appointment,
  type TodayBoard,
} from '@/api/appointments'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function timeOf(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function StatBlock({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 text-center">
      <div className="text-2xl font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

export function TodayVisitsPage() {
  const [date, setDate] = useState(todayStr())
  const [board, setBoard] = useState<TodayBoard | null>(null)
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState<number | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setBoard(await fetchTodayBoard(date))
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      setBoard(null)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    void load()
  }, [load])

  async function act(id: number, fn: (id: number) => Promise<Appointment>) {
    setActing(id)
    setError('')
    try {
      await fn(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setActing(null)
    }
  }

  const stats = board?.stats

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">今日到店</h1>
          <p className="mt-1 text-sm text-muted-foreground">签到、完成服务、标记爽约，都在这一页完成。</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          />
          <Button variant="outline" asChild>
            <Link to="/app/appointments">
              <CalendarClock className="mr-1.5 h-4 w-4" />
              档期表
            </Link>
          </Button>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          <StatBlock label="预约总数" value={stats.total} />
          <StatBlock label="待到店" value={stats.booked} accent={APPOINTMENT_STATUS_COLOR.booked} />
          <StatBlock label="已到店" value={stats.arrived} accent={APPOINTMENT_STATUS_COLOR.arrived} />
          <StatBlock label="已完成" value={stats.completed} accent={APPOINTMENT_STATUS_COLOR.completed} />
          <StatBlock label="爽约" value={stats.no_show} accent={APPOINTMENT_STATUS_COLOR.no_show} />
          <StatBlock label="到店率" value={stats.arrival_rate == null ? '—' : `${stats.arrival_rate}%`} />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !board ? <p className="text-sm text-muted-foreground">加载中…</p> : null}

      {board && board.list.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            这一天还没有预约。去「档期表」为客户约一个吧。
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {board?.list.map((a) => {
          const busy = acting === a.id
          return (
            <Card key={a.id}>
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="min-w-[64px] text-2xl font-semibold tabular-nums">{timeOf(a.start_at)}</div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.customer ? (
                        <Link
                          to={`/app/customers/${a.customer_id}`}
                          className="text-base font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {a.customer.name || '未命名客户'}
                        </Link>
                      ) : (
                        <span className="text-base font-medium">客户 #{a.customer_id}</span>
                      )}
                      <span
                        className="rounded-full px-2 py-0.5 text-xs text-white"
                        style={{ background: APPOINTMENT_STATUS_COLOR[a.status] }}
                      >
                        {APPOINTMENT_STATUS_LABEL[a.status]}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {a.title} · {a.duration_min} 分钟 · 服务人员 {staffName(a.staff)}
                    </div>
                    {a.customer?.phone ? (
                      <a
                        href={`tel:${a.customer.phone}`}
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {a.customer.phone}
                      </a>
                    ) : null}
                    {a.remark ? <div className="text-sm text-muted-foreground">备注：{a.remark}</div> : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {a.status === 'booked' ? (
                    <>
                      <Button size="lg" disabled={busy} onClick={() => act(a.id, markArrived)}>
                        <UserCheck className="mr-1.5 h-4 w-4" />
                        到店签到
                      </Button>
                      <Button size="lg" variant="outline" disabled={busy} onClick={() => act(a.id, markNoShow)}>
                        <UserX className="mr-1.5 h-4 w-4" />
                        爽约
                      </Button>
                    </>
                  ) : null}
                  {a.status === 'arrived' ? (
                    <Button size="lg" disabled={busy} onClick={() => act(a.id, markCompleted)}>
                      <Check className="mr-1.5 h-4 w-4" />
                      完成服务
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default TodayVisitsPage
