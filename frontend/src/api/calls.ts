import { getJson, postJson, putJson } from './client'

export interface CallRecord {
  id: number
  customer_id: number
  caller_user_id: number
  customer: { id: number; name: string; phone: string | null }
  caller: { id: number; username: string; real_name?: string | null }
  dial_mode: 'phone' | 'webrtc'
  status: 'initiating' | 'calling' | 'connected' | 'completed' | 'failed' | 'cancelled'
  duration_seconds: number
  recording_url: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export interface UserCallSetting {
  dial_mode: 'phone' | 'webrtc'
  phone_number: string | null
  is_available: boolean
}

export interface CallStats {
  total: number
  connected: number
  connect_rate: string
  avg_duration: number
  today_total: number
  by_user: Array<{ user_id: number; username: string; total: number; connected: number }>
}

export const initiateCall = (customerId: number) => postJson<CallRecord>('/calls', { customer_id: customerId })

export const hangupCall = (callId: number) => postJson(`/calls/${callId}/hangup`, {})

export const listCalls = (params?: object) =>
  getJson<{ list: CallRecord[]; total: number; page: number; size: number }>('/calls', { params })

export const getCallStats = (params?: object) => getJson<CallStats>('/calls/stats', { params })

export const getMyCallSetting = () => getJson<UserCallSetting>('/calls/settings/me')

export const updateMyCallSetting = (data: object) => putJson<UserCallSetting>('/calls/settings/me', data)

export const saveTcccConfig = (data: object) =>
  putJson<{
    sdkAppId: string
    secretId: string
    secretKey: string
    serverNumber: string
    configured: boolean
  }>('/calls/tccc-config', data)

export const getTcccConfig = () =>
  getJson<{
    sdkAppId: string
    secretId: string
    secretKey: string
    serverNumber: string
    configured: boolean
  }>('/calls/tccc-config')
