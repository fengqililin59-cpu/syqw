/**
 * @file 裂变活动 API。
 */
import { getJson, postJson, putJson } from '@/api/client'
import type { CampaignRow, CampaignStats, Paginated } from '@/api/types'

export function fetchCampaigns(params?: { page?: number; size?: number; status?: string }) {
  return getJson<Paginated<CampaignRow>>('/campaigns', { params })
}

export function fetchCampaign(id: number) {
  return getJson<CampaignRow>(`/campaigns/${id}`)
}

export function createCampaign(body: {
  name: string
  type?: string
  target_count: number
  reward_type: string
  reward_value: string | Record<string, unknown>
  start_time: string
  end_time: string
}) {
  return postJson<CampaignRow>('/campaigns', body)
}

export function updateCampaign(
  id: number,
  body: Partial<{
    name: string
    type: string
    target_count: number
    reward_type: string
    reward_value: string | Record<string, unknown>
    start_time: string
    end_time: string
    status: string
  }>,
) {
  return putJson<CampaignRow>(`/campaigns/${id}`, body)
}

export function startCampaign(id: number) {
  return postJson<CampaignRow>(`/campaigns/${id}/start`)
}

export function pauseCampaign(id: number) {
  return postJson<CampaignRow>(`/campaigns/${id}/pause`)
}

export function endCampaign(id: number) {
  return postJson<CampaignRow>(`/campaigns/${id}/end`)
}

export function duplicateCampaign(id: number) {
  return postJson<CampaignRow>(`/campaigns/${id}/duplicate`)
}

export function fetchCampaignStats(id: number) {
  return getJson<CampaignStats>(`/campaigns/${id}/stats`)
}

export function enrollCampaign(id: number, body: { customer_id: number }) {
  return postJson<{
    id: number
    campaign_id: number
    customer_id: number
    invite_code: string
    invited_count: number
    is_achieved: boolean
    reward_sent_at: string | null
    poster_url: string | null
    contact_way_state_hint: string
  }>(`/campaigns/${id}/enroll`, body)
}

export function simulateInvite(
  id: number,
  body: { invite_code: string; invitee_customer_id: number },
) {
  return postJson<{ recorded: boolean; reason?: string }>(`/campaigns/${id}/simulate-invite`, body)
}

/** 文档对齐：查询指定客户在活动下的报名信息（需 query customer_id）。 */
export function fetchCampaignMyEnroll(id: number, params: { customer_id: number }) {
  return getJson<Record<string, unknown> | null>(`/campaigns/${id}/my-enroll`, { params })
}

/** 文档对齐：等价于 enroll，生成邀请码。 */
export function generateCampaignInviteCode(id: number, body: { customer_id: number }) {
  return postJson<Record<string, unknown>>(`/campaigns/${id}/generate-invite-code`, body)
}
