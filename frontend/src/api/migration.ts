import { getJson, patchJson, postFormData, postJson, putJson } from '@/api/client'

export type MigrationCampaignRow = {
  id: number
  tenant_id: number
  name: string
  description?: string | null
  channel_live_code_id?: number | null
  welcome_msg?: string | null
  script_template?: string | null
  target_count: number
  migrated_count: number
  status: string
  starts_at?: string | null
  ends_at?: string | null
  created_by: number
  created_at?: string
  updated_at?: string
  suggested_contact_state?: string
}

export type MigrationFunnel = {
  total: number
  pending: number
  contacted: number
  migrated: number
  lost: number
  rate: number
}

export type MigrationCampaignDetail = {
  campaign: MigrationCampaignRow & { live_channel?: { id: number; name: string; state: string | null } | null }
  funnel: MigrationFunnel
}

export type MigrationRecordRow = {
  id: number
  wx_nickname: string | null
  wx_phone: string | null
  wx_remark: string | null
  status: string
  contacted_at: string | null
  migrated_at: string | null
  external_userid: string | null
  customer_id: number | null
  note: string | null
  created_at: string
  owner: { id: number; username: string; real_name?: string | null; wework_userid?: string | null } | null
}

export async function listMigrationCampaigns(params: { page?: number; size?: number; status?: string }) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.size) q.set('size', String(params.size))
  if (params.status) q.set('status', params.status)
  return getJson<{ list: MigrationCampaignRow[]; total: number; page: number; size: number }>(
    `/migration/campaigns?${q.toString()}`,
  )
}

export async function createMigrationCampaign(body: {
  name: string
  description?: string | null
  channel_live_code_id?: number | null
  welcome_msg?: string | null
  script_template?: string | null
  target_count?: number
  status?: string
  starts_at?: string | null
  ends_at?: string | null
}) {
  return postJson<MigrationCampaignRow>('/migration/campaigns', body)
}

export async function getMigrationCampaignDetail(id: number) {
  return getJson<MigrationCampaignDetail>(`/migration/campaigns/${id}`)
}

export async function updateMigrationCampaign(
  id: number,
  body: Partial<{
    name: string
    description: string | null
    channel_live_code_id: number | null
    welcome_msg: string | null
    script_template: string | null
    target_count: number
    status: string
    starts_at: string | null
    ends_at: string | null
  }>,
) {
  return putJson<MigrationCampaignRow>(`/migration/campaigns/${id}`, body)
}

export async function importMigrationContacts(campaignId: number, formData: FormData) {
  return postFormData<{ imported: number; skipped: number; errors: { row: number; reason: string }[] }>(
    `/migration/campaigns/${campaignId}/import`,
    formData,
  )
}

export async function listMigrationRecords(
  campaignId: number,
  params: { page?: number; size?: number; status?: string },
) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.size) q.set('size', String(params.size))
  if (params.status) q.set('status', params.status)
  return getJson<{ list: MigrationRecordRow[]; total: number; page: number; size: number }>(
    `/migration/campaigns/${campaignId}/records?${q.toString()}`,
  )
}

export async function patchMigrationRecordStatus(recordId: number, body: { status: string; note?: string | null }) {
  return patchJson<MigrationRecordRow>(`/migration/records/${recordId}/status`, body)
}

export async function generateMigrationScript(recordId: number) {
  return getJson<{ text: string }>(`/migration/records/${recordId}/script`)
}
