/**
 * @file 预约档期：按日/周查看，按服务人员分列，支持新建与改期。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Plus, Users } from 'lucide-react'
import {
  cancelAppointment,
  createAppointment,
  fetchCalendar,
  staffName,
  APPOINTMENT_STATUS_COLOR,
  APPOINTMENT_STATUS_LABEL,
  type Appointment,
  type AppointmentStaff,
  type CalendarData,
} from '@/api/appointments'
import { CustomerPicker } from '@/components/CustomerPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ViewMode = 'day' | 'week'

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return fmtDate(d)
}

/** 周视图以周一为起点 */
function startOfWeek(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return fmtDate(d)
}

function timeOf(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function dayKey(iso: string) {
  return fmtDate(new Date(iso))
}

function AppointmentChip({ a, onCancel }: { a: Appointment; onCancel: (a: Appointment) => void }) {
  return (
    <div
      className="rounded-md border-l-4 bg-muted/40 px-2 py-1.5 text-xs"
      style={{ borderLeftColor: APPOINTMENT_STATUS_COLOR[a.status] }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium tabular-nums">{timeOf(a.start_at)}</span>
        <span style={{ color: APPOINTMENT_STATUS_COLOR[a.status] }}>{APPOINTMENT_STATUS_LABEL[a.status]}</span>
      </div>
      <Link to={`/app/customers/${a.customer_id}`} className="mt-0.5 block truncate text-primary hover:underline">
        {a.customer?.name || `客户 #${a.customer_id}`}
      </Link>
      <div className="truncate text-muted-foreground">{a.title}</div>
      {a.status === 'booked' ? (
        <button
          type="button"
          onClick={() => onCancel(a)}
          className="mt-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
        >
          取消预约
        </button>
      ) : null}
    </div>
  )
}

export function AppointmentsPage() {
  const [view, setView] = useState<ViewMode>('day')
  const [anchor, setAnchor] = useState(fmtDate(new Date()))
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [formStaffId, setFormStaffId] = useState<string>('')
  const [formTitle, setFormTitle] = useState('')
  const [formStartAt, setFormStartAt] = useState('')
  const [formDuration, setFormDuration] = useState('60')
  const [formRemark, setFormRemark] = useState('')

  const range = useMemo(() => {
    if (view === 'day') return { start: anchor, end: anchor }
    const start = startOfWeek(anchor)
    return { start, end: addDays(start, 6) }
  }, [view, anchor])

  const days = useMemo(() => {
    const out: string[] = []
    let cur = range.start
    while (cur <= range.end) {
      out.push(cur)
      cur = addDays(cur, 1)
    }
    return out
  }, [range])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchCalendar({ start_date: range.start, end_date: range.end }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  /** 未指定服务人员的预约归入 unassigned 列 */
  const columns = useMemo<Array<AppointmentStaff | null>>(() => {
    const staff = data?.staff ?? []
    const hasUnassigned = (data?.appointments ?? []).some((a) => !a.staff_id)
    return hasUnassigned ? [...staff, null] : staff
  }, [data])

  function cellItems(staffId: number | null, day: string) {
    return (data?.appointments ?? []).filter(
      (a) => (a.staff_id ?? null) === staffId && dayKey(a.start_at) === day,
    )
  }

  function openCreate() {
    setCustomerId(null)
    setFormStaffId('')
    setFormTitle('')
    setFormStartAt(`${anchor}T10:00`)
    setFormDuration('60')
    setFormRemark('')
    setFormError('')
    setCreateOpen(true)
  }

  async function submitCreate() {
    if (!customerId) {
      setFormError('请先选择客户')
      return
    }
    if (!formStartAt) {
      setFormError('请选择预约时间')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await createAppointment({
        customer_id: customerId,
        start_at: new Date(formStartAt).toISOString(),
        staff_id: formStaffId ? Number(formStaffId) : null,
        title: formTitle.trim() || undefined,
        duration_min: Number(formDuration) || 60,
        remark: formRemark.trim() || undefined,
      })
      setCreateOpen(false)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(a: Appointment) {
    if (!window.confirm(`确认取消 ${a.customer?.name || '该客户'} 的预约？`)) return
    try {
      await cancelAppointment(a.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '取消失败')
    }
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">预约档期</h1>
          <p className="mt-1 text-sm text-muted-foreground">按服务人员查看档期，避免撞单；点右上角为客户约到店。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/appointments/today">
              <CalendarDays className="mr-1.5 h-4 w-4" />
              今日到店
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/appointments/schedules">
              <Users className="mr-1.5 h-4 w-4" />
              排班设置
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            新建预约
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5">
          {(['day', 'week'] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setView(m)}
              className={`rounded px-3 py-1 text-sm ${
                view === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'day' ? '日视图' : '周视图'}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, view === 'day' ? -1 : -7))}>
          上一{view === 'day' ? '天' : '周'}
        </Button>
        <input
          type="date"
          value={anchor}
          onChange={(e) => setAnchor(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        />
        <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, view === 'day' ? 1 : 7))}>
          下一{view === 'day' ? '天' : '周'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setAnchor(fmtDate(new Date()))}>
          回到今天
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !data ? <p className="text-sm text-muted-foreground">加载中…</p> : null}

      {data && columns.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            还没有可排班的员工。请先在「用户管理」中添加员工账号。
          </CardContent>
        </Card>
      ) : null}

      {data && columns.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="w-32 border-b border-r p-2 text-left font-medium">服务人员</th>
                {days.map((d) => (
                  <th key={d} className="border-b border-r p-2 text-left font-medium last:border-r-0">
                    {d.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map((s) => (
                <tr key={s ? s.id : 'unassigned'}>
                  <td className="border-b border-r p-2 align-top font-medium">
                    {s ? staffName(s) : '未指定'}
                  </td>
                  {days.map((d) => {
                    const items = cellItems(s ? s.id : null, d)
                    return (
                      <td key={d} className="min-w-[160px] border-b border-r p-2 align-top last:border-r-0">
                        {items.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="space-y-1.5">
                            {items.map((a) => (
                              <AppointmentChip key={a.id} a={a} onCancel={handleCancel} />
                            ))}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建预约</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <CustomerPicker value={customerId} onChange={(id) => setCustomerId(id)} />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="appt-start">到店时间</Label>
                <Input
                  id="appt-start"
                  type="datetime-local"
                  value={formStartAt}
                  onChange={(e) => setFormStartAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appt-duration">时长（分钟）</Label>
                <Input
                  id="appt-duration"
                  type="number"
                  min={5}
                  step={5}
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appt-staff">服务人员</Label>
              <select
                id="appt-staff"
                value={formStaffId}
                onChange={(e) => setFormStaffId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">不指定</option>
                {(data?.staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {staffName(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appt-title">服务项目</Label>
              <Input
                id="appt-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="如：小气泡清洁"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appt-remark">备注</Label>
              <Input
                id="appt-remark"
                value={formRemark}
                onChange={(e) => setFormRemark(e.target.value)}
                placeholder="选填"
              />
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={submitCreate} disabled={saving}>
              {saving ? '保存中…' : '创建预约'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AppointmentsPage
