import { deleteJson, getJson, patchJson, postJson } from './client'

export interface CustomerGroup {
  id: number
  name: string
  chat_id: string
  member_count: number
  status: number
  last_synced_at: string | null
  webhook_url: string | null
  owner: { id: number; username: string; real_name?: string | null } | null
}

export interface GroupMemberRow {
  id: number
  member_type: number
  external_userid: string | null
  wework_userid: string | null
  customer: {
    id: number
    name: string | null
    intent_score: number
    stage: string
  } | null
}

export interface GroupSopTask {
  id: number
  name: string
  msg_type: string
  trigger_type: 'scheduled' | 'recurring'
  scheduled_at: string | null
  recurring_cron: string | null
  recurring_desc: string | null
  status: 'draft' | 'active' | 'paused' | 'done'
  target_count?: number
}

export const listGroups = (params?: { page?: number; size?: number; name?: string; status?: number }) =>
  getJson<{ list: CustomerGroup[]; total: number; page: number; size: number }>('/groups', { params })

export const syncGroups = () => postJson<{ synced_groups: number; synced_members: number }>('/groups/sync', {})

export const getGroupDetail = (id: number, params?: { page?: number; size?: number }) =>
  getJson<{
    group: CustomerGroup
    members: GroupMemberRow[]
    members_total: number
    page: number
    size: number
  }>(`/groups/${id}`, { params })

export const sendToGroup = (id: number, body: { msg_type: string; text: string }) =>
  postJson<{ status: string }>(`/groups/${id}/send`, body)

export const updateGroupWebhook = (id: number, webhook_url: string) =>
  patchJson<{ id: number; webhook_masked: string }>(`/groups/${id}/webhook`, { webhook_url })

export const listSopTasks = (params?: { page?: number; size?: number; status?: string }) =>
  getJson<{ list: GroupSopTask[]; total: number; page: number; size: number }>('/groups/sop', { params })

export const createSopTask = (body: object) => postJson('/groups/sop', body)

export const updateSopStatus = (id: number, status: string) =>
  patchJson(`/groups/sop/${id}/status`, { status })

export const deleteSopTask = (id: number) => deleteJson(`/groups/sop/${id}`)

