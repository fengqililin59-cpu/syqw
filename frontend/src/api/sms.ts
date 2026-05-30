import { deleteJson, getJson, patchJson, postJson, putJson } from './client'

export interface SmsTemplate {
  id: number
  name: string
  aliyun_template_code: string
  content_preview: string
  variables: string[]
  sign_name: string
  status: 'active' | 'disabled'
}

export interface SmsTask {
  id: number
  name: string
  template: SmsTemplate
  template_params: Record<string, string>
  filter_json: Record<string, unknown>
  total_count: number
  sent_count: number
  success_count: number
  failed_count: number
  status: 'draft' | 'scheduled' | 'sending' | 'done' | 'failed' | 'cancelled'
  scheduled_at: string | null
  started_at: string | null
  finished_at: string | null
  creator: { username: string; real_name?: string | null }
}

export const listSmsTemplates = () => getJson<SmsTemplate[]>('/sms/templates')
export const createSmsTemplate = (data: object) => postJson<SmsTemplate>('/sms/templates', data)
export const listSmsTasks = (params?: object) =>
  getJson<{ list: SmsTask[]; total: number; page: number; size: number }>('/sms/tasks', { params })
export const getSmsTask = (id: number) => getJson<SmsTask>(`/sms/tasks/${id}`)
export const createSmsTask = (data: object) => postJson<SmsTask>('/sms/tasks', data)
export const cancelSmsTask = (id: number) => postJson(`/sms/tasks/${id}/cancel`, {})
export const sendSingleSms = (data: object) => postJson('/sms/send', data)
export const getSmsStats = () =>
  getJson<{
    total_sent: number
    total_success: number
    success_rate: string
    today_sent: number
    by_template: Array<{ template_code: string; total: number; success: number }>
  }>('/sms/stats')
export const getSmsConfig = () =>
  getJson<{ configured: boolean; accessKeyId: string; defaultSign: string }>('/sms/config')
export const saveSmsConfig = (data: object) =>
  putJson<{ configured: boolean; accessKeyId: string; defaultSign: string }>('/sms/config', data)
export const listSmsLogs = (params?: object) =>
  getJson<{ list: Array<Record<string, unknown>>; total: number; page: number; size: number }>('/sms/logs', { params })
export const updateSmsTemplate = (id: number, data: object) => patchJson(`/sms/templates/${id}`, data)
export const deleteSmsTemplate = (id: number) => deleteJson(`/sms/templates/${id}`)
