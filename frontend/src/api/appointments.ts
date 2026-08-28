/**
 * @file 预约到店 API。
 */
import { getJson, postJson, putJson } from './client'

export type AppointmentStatus = 'booked' | 'arrived' | 'completed' | 'no_show' | 'cancelled'

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  booked: '已预约',
  arrived: '已到店',
  completed: '已完成',
  no_show: '已爽约',
  cancelled: '已取消',
}

export const APPOINTMENT_STATUS_COLOR: Record<AppointmentStatus, string> = {
  booked: '#3b82f6',
  arrived: '#10b981',
  completed: '#6366f1',
  no_show: '#ef4444',
  cancelled: '#9ca3af',
}

export type AppointmentStaff = {
  id: number
  real_name?: string | null
  username?: string | null
}

export type Appointment = {
  id: number
  tenant_id: number
  customer_id: number
  staff_id: number | null
  product_id: number | null
  title: string
  start_at: string
  duration_min: number
  status: AppointmentStatus
  source: string | null
  arrived_at: string | null
  completed_at: string | null
  cancel_reason: string | null
  remark: string | null
  customer?: { id: number; name: string | null; phone: string | null; stage: string | null } | null
  staff?: AppointmentStaff | null
  product?: { id: number; name: string } | null
}

export type AppointmentListQuery = {
  page?: number
  page_size?: number
  start_date?: string
  end_date?: string
  staff_id?: number
  customer_id?: number
  status?: string
}

export type TodayBoard = {
  date: string
  stats: {
    total: number
    booked: number
    arrived: number
    completed: number
    no_show: number
    cancelled: number
    arrival_rate: number | null
  }
  list: Appointment[]
}

export type CalendarData = {
  start_date: string
  end_date: string
  staff: AppointmentStaff[]
  appointments: Appointment[]
}

export function staffName(staff?: AppointmentStaff | null): string {
  if (!staff) return '未指定'
  return staff.real_name || staff.username || `#${staff.id}`
}

function toQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  return q.toString()
}

export function fetchAppointments(query: AppointmentListQuery = {}) {
  return getJson<{ list: Appointment[]; total: number; page: number; size: number }>(
    `/appointments?${toQuery(query)}`,
  )
}

export function fetchCalendar(params: { start_date: string; end_date: string; staff_id?: number }) {
  return getJson<CalendarData>(`/appointments/calendar?${toQuery(params)}`)
}

export function fetchTodayBoard(date?: string) {
  return getJson<TodayBoard>(`/appointments/today?${toQuery({ date })}`)
}

export type CreateAppointmentBody = {
  customer_id: number
  start_at: string
  staff_id?: number | null
  product_id?: number | null
  title?: string
  duration_min?: number
  remark?: string
}

export function createAppointment(body: CreateAppointmentBody) {
  return postJson<Appointment, CreateAppointmentBody>('/appointments', body)
}

export function updateAppointment(id: number, body: Partial<CreateAppointmentBody>) {
  return putJson<Appointment>(`/appointments/${id}`, body)
}

export function markArrived(id: number) {
  return postJson<Appointment>(`/appointments/${id}/arrive`)
}

export function markCompleted(id: number) {
  return postJson<Appointment>(`/appointments/${id}/complete`)
}

export function markNoShow(id: number) {
  return postJson<Appointment>(`/appointments/${id}/no-show`)
}

export function cancelAppointment(id: number, reason?: string) {
  return postJson<Appointment>(`/appointments/${id}/cancel`, { reason })
}
