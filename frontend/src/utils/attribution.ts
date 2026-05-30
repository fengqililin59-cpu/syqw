const ATTR_KEY = 'attribution_token'
const LANDING_ATTR_KEY = 'landing_ab_attribution'

type VisitPayload = {
  session_id: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  referrer?: string
  landing_path?: string
}

export function getAttributionToken(): string | null {
  const v = localStorage.getItem(ATTR_KEY)
  if (!v) return null
  return /^[a-f0-9]{32}$/i.test(v) ? v : null
}

type LandingAttribution = {
  from?: string
  variant?: string
  cta?: string
}

function sanitizeField(v: string | null, max = 64): string | undefined {
  if (!v) return undefined
  const s = v.trim()
  if (!s) return undefined
  return s.slice(0, max)
}

export function saveLandingAttributionFromUrl(search?: string): LandingAttribution {
  if (typeof window === 'undefined') return {}
  const q = new URLSearchParams(search ?? window.location.search)
  const from = sanitizeField(q.get('from'), 32)
  const variant = sanitizeField(q.get('variant'), 8)?.toLowerCase()
  const cta = sanitizeField(q.get('cta'), 64)
  const next: LandingAttribution = {
    from,
    variant: variant === 'a' || variant === 'b' ? variant : undefined,
    cta,
  }
  const hasAny = Boolean(next.from || next.variant || next.cta)
  if (!hasAny) return {}
  try {
    sessionStorage.setItem(LANDING_ATTR_KEY, JSON.stringify(next))
  } catch {
    // ignore storage errors
  }
  return next
}

export function getLandingAttribution(): LandingAttribution {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(LANDING_ATTR_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as LandingAttribution
    return {
      from: sanitizeField(data.from ?? null, 32),
      variant: sanitizeField(data.variant ?? null, 8),
      cta: sanitizeField(data.cta ?? null, 64),
    }
  } catch {
    return {}
  }
}

/** 与落地页 / 营销事件共用的匿名会话 ID（32 hex） */
export function getOrCreateSessionId(): string {
  const existing = getAttributionToken()
  if (existing) return existing
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  localStorage.setItem(ATTR_KEY, token)
  return token
}

export async function trackUtmOnLanding(): Promise<void> {
  if (typeof window === 'undefined') return
  const q = new URLSearchParams(window.location.search)
  const payload: VisitPayload = {
    session_id: getOrCreateSessionId(),
    referrer: document.referrer || undefined,
    landing_path: `${window.location.pathname}${window.location.search}`.slice(0, 255),
  }
  const map: Array<[keyof VisitPayload, string]> = [
    ['utm_source', 'utm_source'],
    ['utm_medium', 'utm_medium'],
    ['utm_campaign', 'utm_campaign'],
    ['utm_content', 'utm_content'],
    ['utm_term', 'utm_term'],
  ]
  let has = false
  for (const [k, qk] of map) {
    const v = q.get(qk)?.trim()
    if (v) {
      payload[k] = v.slice(0, 100)
      has = true
    }
  }
  if (!has) return

  try {
    await fetch('/api/v1/track/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // 忽略追踪失败，不能影响用户主流程
  }
}

/** 监测链接落地携带 ad_hit 时写入统一事件（与 ROI / 漏斗对齐） */
export async function trackAdLandingIfPresent(): Promise<void> {
  if (typeof window === 'undefined') return
  const q = new URLSearchParams(window.location.search)
  const raw = q.get('ad_hit')?.trim()
  if (!raw || !/^\d+$/.test(raw)) return
  try {
    await fetch('/api/v1/track/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_key: 'ad_landing',
        ad_hit: Number(raw),
        session_id: getOrCreateSessionId(),
      }),
    })
  } catch {
    /* ignore */
  }
}
