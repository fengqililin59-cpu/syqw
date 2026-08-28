/**
 * @file 服务人员排班：设置每周固定班次，并按日期临时调休/加班。
 * 排班决定了客户自助预约页能看到哪些可约时段。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, Trash2 } from 'lucide-react'
import { staffName, type AppointmentStaff } from '@/api/appointments'
import {
  createDateOverride,
  deleteSchedule,
  fetchSchedules,
  hhmm,
  saveWeeklySchedule,
  WEEKDAY_LABEL,
  type StaffSchedule,
  type WeeklyDay,
} from '@/api/staffSchedules'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type WeekRow = {
  weekday: number
  enabled: boolean
  start_time: string
  end_time: string
}

const DEFAULT_WEEK: WeekRow[] = Array.from({ length: 7 }, (_, i) => ({
  weekday: i,
  // 默认周一至周六上班，周日休息
  enabled: i !== 0,
  start_time: '10:00',
  end_time: '20:00',
}))

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function StaffSchedulePage() {
  const [staff, setStaff] = useState<AppointmentStaff[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null)
  const [schedules, setSchedules] = useState<StaffSchedule[]>([])
  const [week, setWeek] = useState<WeekRow[]>(DEFAULT_WEEK)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [ovDate, setOvDate] = useState(todayStr())
  const [ovStart, setOvStart] = useState('10:00')
  const [ovEnd, setOvEnd] = useState('20:00')
  const [ovIsOff, setOvIsOff] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchSchedules(selectedStaffId ? { staff_id: selectedStaffId } : {})
      setStaff(res.staff)
      setSchedules(res.list)
      if (selectedStaffId == null && res.staff.length > 0) {
        setSelectedStaffId(res.staff[0].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [selectedStaffId])

  useEffect(() => {
    void load()
  }, [load])

  // 用已保存的周期排班回填表单；没有记录的星期几视为休息
  useEffect(() => {
    if (selectedStaffId == null) return
    const weekly = schedules.filter((s) => s.staff_id === selectedStaffId && s.work_date == null)
    if (weekly.length === 0) {
      setWeek(DEFAULT_WEEK)
      return
    }
    setWeek(
      Array.from({ length: 7 }, (_, i) => {
        const found = weekly.find((s) => s.weekday === i)
        if (!found || found.is_off) {
          return { weekday: i, enabled: false, start_time: '10:00', end_time: '20:00' }
        }
        return {
          weekday: i,
          enabled: true,
          start_time: hhmm(found.start_time),
          end_time: hhmm(found.end_time),
        }
      }),
    )
  }, [schedules, selectedStaffId])

  const overrides = useMemo(
    () =>
      schedules
        .filter((s) => s.work_date != null && (selectedStaffId == null || s.staff_id === selectedStaffId))
        .sort((a, b) => (a.work_date || '').localeCompare(b.work_date || '')),
    [schedules, selectedStaffId],
  )

  function patchWeek(weekday: number, patch: Partial<WeekRow>) {
    setWeek((prev) => prev.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)))
  }

  async function submitWeekly() {
    if (selectedStaffId == null) return
    const days: WeeklyDay[] = week
      .filter((r) => r.enabled)
      .map((r) => ({ weekday: r.weekday, start_time: r.start_time, end_time: r.end_time }))
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await saveWeeklySchedule(selectedStaffId, days)
      setMessage('每周排班已保存')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function submitOverride() {
    if (selectedStaffId == null) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await createDateOverride({
        staff_id: selectedStaffId,
        work_date: ovDate,
        // 休息日仍需提交合法时间区间，后端会因 is_off 跳过时间校验
        start_time: ovIsOff ? '00:00' : ovStart,
        end_time: ovIsOff ? '23:59' : ovEnd,
        is_off: ovIsOff,
      })
      setMessage('已添加日期调整')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败')
    } finally {
      setSaving(false)
    }
  }

  async function removeRow(id: number) {
    try {
      await deleteSchedule(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">服务人员排班</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            排班决定客户自助预约页能看到哪些可约时段，也用于避免代约时撞单。
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/app/appointments">
            <CalendarRange className="mr-1.5 h-4 w-4" />
            返回档期表
          </Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {!loading && staff.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            还没有可排班的员工，请先在「用户管理」中添加员工账号。
          </CardContent>
        </Card>
      ) : null}

      {staff.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-sm">选择员工</Label>
            <select
              value={selectedStaffId ?? ''}
              onChange={(e) => setSelectedStaffId(Number(e.target.value))}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {staffName(s)}
                </option>
              ))}
            </select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">每周固定班次</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {week.map((row) => (
                <div key={row.weekday} className="flex flex-wrap items-center gap-3">
                  <label className="flex w-24 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => patchWeek(row.weekday, { enabled: e.target.checked })}
                      className="h-4 w-4"
                    />
                    {WEEKDAY_LABEL[row.weekday]}
                  </label>
                  <Input
                    type="time"
                    value={row.start_time}
                    disabled={!row.enabled}
                    onChange={(e) => patchWeek(row.weekday, { start_time: e.target.value })}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">至</span>
                  <Input
                    type="time"
                    value={row.end_time}
                    disabled={!row.enabled}
                    onChange={(e) => patchWeek(row.weekday, { end_time: e.target.value })}
                    className="w-32"
                  />
                  {!row.enabled ? <span className="text-sm text-muted-foreground">休息</span> : null}
                </div>
              ))}
              <div className="pt-2">
                <Button onClick={submitWeekly} disabled={saving}>
                  {saving ? '保存中…' : '保存每周排班'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">按日期调整</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                临时调休或加班。同一天有日期调整时，以此处为准，覆盖每周固定班次。
              </p>

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ov-date">日期</Label>
                  <Input
                    id="ov-date"
                    type="date"
                    value={ovDate}
                    onChange={(e) => setOvDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ovIsOff}
                    onChange={(e) => setOvIsOff(e.target.checked)}
                    className="h-4 w-4"
                  />
                  这天休息
                </label>
                {!ovIsOff ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="ov-start">上班</Label>
                      <Input
                        id="ov-start"
                        type="time"
                        value={ovStart}
                        onChange={(e) => setOvStart(e.target.value)}
                        className="w-32"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ov-end">下班</Label>
                      <Input
                        id="ov-end"
                        type="time"
                        value={ovEnd}
                        onChange={(e) => setOvEnd(e.target.value)}
                        className="w-32"
                      />
                    </div>
                  </>
                ) : null}
                <Button onClick={submitOverride} disabled={saving} variant="outline">
                  添加
                </Button>
              </div>

              {overrides.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无日期调整。</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {overrides.map((row) => (
                    <div key={row.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>
                        {row.work_date} ·{' '}
                        {row.is_off ? (
                          <span className="text-destructive">休息</span>
                        ) : (
                          `${hhmm(row.start_time)} - ${hhmm(row.end_time)}`
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

export default StaffSchedulePage
