/**
 * @file 落地页 / H5 留资共用埋点（静态页引入，无构建依赖）。
 */
(function (global) {
  const ATTR_KEY = 'attribution_token'
  const UTM_KEY = 'zf_utm_bundle'
  const LANDING_KEY = 'zf_landing_attribution'

  function randomHex(bytes) {
    const arr = new Uint8Array(bytes)
    crypto.getRandomValues(arr)
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  function apiBase() {
    const params = new URLSearchParams(global.location.search)
    const fromQuery = (params.get('api') || '').trim().replace(/\/$/, '')
    if (fromQuery) return fromQuery
    return global.location.origin + '/api/v1'
  }

  function getOrCreateSessionId() {
    let v = global.localStorage.getItem(ATTR_KEY)
    if (!v || !/^[a-f0-9]{16,64}$/i.test(v)) {
      v = randomHex(16)
      global.localStorage.setItem(ATTR_KEY, v)
    }
    return v
  }

  function persistUtmFromQuery() {
    const q = new URLSearchParams(global.location.search)
    const utm = {}
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const v = q.get(k)?.trim()
      if (v) utm[k] = v.slice(0, 100)
    }
    if (Object.keys(utm).length) {
      try {
        global.sessionStorage.setItem(UTM_KEY, JSON.stringify(utm))
      } catch (_) {
        /* ignore */
      }
    }
    return utm
  }

  function getStoredUtm() {
    try {
      const raw = global.sessionStorage.getItem(UTM_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  function saveLandingAttribution(extra) {
    const q = new URLSearchParams(global.location.search)
    const payload = {
      from: (q.get('from') || extra?.from || 'landing').slice(0, 32),
      variant: (q.get('variant') || extra?.variant || '').slice(0, 8),
      cta: (extra?.cta || '').slice(0, 64),
    }
    try {
      global.sessionStorage.setItem(LANDING_KEY, JSON.stringify(payload))
    } catch (_) {
      /* ignore */
    }
    return payload
  }

  function getLandingAttribution() {
    try {
      const raw = global.sessionStorage.getItem(LANDING_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  async function postJson(path, body) {
    const res = await fetch(apiBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.message || res.statusText)
    }
    return res.json().catch(() => ({}))
  }

  async function trackEvent(eventKey, properties) {
    const utm = getStoredUtm()
    const props = { ...utm, ...(properties || {}) }
    try {
      await postJson('/track/event', {
        event_key: eventKey,
        session_id: getOrCreateSessionId(),
        properties: props,
      })
    } catch (_) {
      /* 不阻断主流程 */
    }
  }

  async function trackVisitIfUtm() {
    const utm = { ...getStoredUtm(), ...persistUtmFromQuery() }
    const has = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].some(
      (k) => utm[k],
    )
    if (!has) return null
    try {
      const data = await postJson('/track/visit', {
        session_id: getOrCreateSessionId(),
        referrer: global.document.referrer || undefined,
        landing_path: `${global.location.pathname}${global.location.search}`.slice(0, 255),
        ...utm,
      })
      return data?.data?.session_id || getOrCreateSessionId()
    } catch (_) {
      return null
    }
  }

  function buildLeadFormUrl(tenantId, extra) {
    const to = new URL('/lead-form.html', global.location.origin)
    to.searchParams.set('tenant', String(tenantId))
    const utm = getStoredUtm()
    for (const [k, v] of Object.entries(utm)) {
      if (v) to.searchParams.set(k, v)
    }
    const land = getLandingAttribution()
    if (land.from) to.searchParams.set('from', land.from)
    if (land.variant) to.searchParams.set('variant', land.variant)
    if (extra?.cta) to.searchParams.set('cta', extra.cta)
    return to.toString()
  }

  global.ZhiFlowTrack = {
    ATTR_KEY,
    apiBase,
    getOrCreateSessionId,
    persistUtmFromQuery,
    getStoredUtm,
    saveLandingAttribution,
    getLandingAttribution,
    trackEvent,
    trackVisitIfUtm,
    buildLeadFormUrl,
  }
})(window)
