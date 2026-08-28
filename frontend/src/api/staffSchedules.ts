/**
 * @file 服务人员排班 API。
 */
import { deleteJson, getJson, postJson, putJson } from './client'
import type { AppointmentStaff } from './appointments'

export const WEEKDAY_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export type StaffSchedule = {
  id: number
  tenant_id: number
  staff_id: number
  /** 周期排班：0=周日 … 6=周六；与 work_date 二选一 */
  weekday: number | null
  /** 指定日期覆盖，优先级高于 weekday */
  work_date: string | null
  start_time: string
  end_time: string
  is_off: boolean
  staff?: AppointmentStaff | null
}

export type ScheduleListResult = {
  list: StaffSchedule[]
  staff: AppointmentStaff[]
}

export function fetchSchedules(params: { staff_id?: number } = {}) {
  const q = new URLSearchParams()
  if (params.staff_id) q.set('staff_id', String(params.staff_id))
  return getJson<ScheduleListResult>(`/staff-schedules?${q.toString()}`)
}

export type WeeklyDay = {
  weekday: number
  start_time: string
  end_time: string
  is_off?: boolean
}

/** 整体替换某员工的周期排班（不影响日期覆盖记录） */
export function saveWeeklySchedule(staffId: number, days: WeeklyDay[]) {
  return postJson<ScheduleListResult>('/staff-schedules/weekly', { staff_id: staffId, days })
}

export type DateOverrideBody = {
  staff_id: number
  work_date: string
  start_time: string
  end_time: string
  is_off?: boolean
}

export function createDateOverride(body: DateOverrideBody) {
  return postJson<StaffSchedule, DateOverrideBody>('/staff-schedules', body)
}

export function updateSchedule(id: number, body: Partial<Omit<DateOverrideBody, 'staff_id'>>) {
  return putJson<StaffSchedule>(`/staff-schedules/${id}`, body)
}

export function deleteSchedule(id: number) {
  return deleteJson<{ deleted: boolean }>(`/staff-schedules/${id}`)
}

export function hhmm(time: string) {
  return time.slice(0, 5)
}
