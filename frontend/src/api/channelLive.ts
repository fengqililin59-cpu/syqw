/**
 * @file 渠道活码 API（分组 + 员工活码）。
 */
import { deleteJson, getJson, postJson, putJson } from '@/api/client'
import type { WeworkChannelGroupRow, WeworkChannelRow } from '@/api/types'

export function fetchChannelGroups() {
  return getJson<WeworkChannelGroupRow[]>('/channel-live/groups')
}

export function createChannelGroup(body: { name: string; sort?: number }) {
  return postJson<WeworkChannelGroupRow>('/channel-live/groups', body)
}

export function updateChannelGroup(id: number, body: { name?: string; sort?: number }) {
  return putJson<WeworkChannelGroupRow>(`/channel-live/groups/${id}`, body)
}

export function deleteChannelGroup(id: number) {
  return deleteJson<{ id: number }>(`/channel-live/groups/${id}`)
}

export function fetchChannels() {
  return getJson<WeworkChannelRow[]>('/channel-live/channels')
}

export function createEmployeeChannel(body: {
  name: string
  group_id?: number | null
  user: string[]
  remark?: string | null
  skip_verify?: boolean
  style?: number
  /** 绑定广告点击记录 id，活码 state 为 zfah{id}，加好友后自动回传 */
  ad_hit?: number
  click_key?: string
}) {
  return postJson<WeworkChannelRow>('/channel-live/channels/employee', body)
}

export function updateChannel(
  id: number,
  body: {
    name?: string
    group_id?: number | null
    user?: string[]
    remark?: string | null
    skip_verify?: boolean
    style?: number
  },
) {
  return putJson<WeworkChannelRow>(`/channel-live/channels/${id}`, body)
}

export function deleteChannel(id: number) {
  return deleteJson<{ id: number }>(`/channel-live/channels/${id}`)
}
