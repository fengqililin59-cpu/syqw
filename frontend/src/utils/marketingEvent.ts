import { getOrCreateSessionId } from './attribution'

type TrackPayload = {
  event_key: string
  tenant_id?: number
  ad_hit?: number
  properties?: Record<string, string | number | boolean | null>
}

/** 上报统一营销事件（失败静默，不阻塞业务） */
export async function trackMarketingEvent(payload: TrackPayload): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    await fetch('/api/v1/track/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        session_id: getOrCreateSessionId(),
      }),
    })
  } catch {
    /* ignore */
  }
}
