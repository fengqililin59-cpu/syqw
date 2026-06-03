/**
 * @file 广告监测与转化回传 API。
 */
import { getJson, postJson } from '@/api/client'

export type AdConversionPlatform = {
  id: string
  name: string
  modes: string[]
  env?: string[]
}

export function fetchConversionPlatforms() {
  return getJson<AdConversionPlatform[]>('/ads/conversion/platforms')
}

export function reportAdConversion(body: {
  clickKey?: string
  adHit?: number
  eventType?: string
  eventValue?: number
}) {
  return postJson<{
    conversion_id: number
    platform: string
    report_status: string
    report_response: string
  }>('/ads/conversion', {
    clickKey: body.clickKey,
    adHit: body.adHit,
    eventType: body.eventType ?? 'lead_submit',
    eventValue: body.eventValue ?? 0,
  })
}

/** 公开接口：根据 ad_hit 生成企微活码 state（投流绑定） */
export async function fetchWeworkStateForAdHit(tenantId: number, adHit: number) {
  const q = new URLSearchParams({
    tenant_id: String(tenantId),
    ad_hit: String(adHit),
  })
  const res = await fetch(`/api/v1/ads/wework-state?${q}`)
  const json = (await res.json()) as { code?: number; data?: { state: string; ad_hit: number; platform: string } }
  if (!res.ok || json.code !== 0 || !json.data) {
    throw new Error((json as { message?: string }).message || '获取企微 state 失败')
  }
  return json.data
}
