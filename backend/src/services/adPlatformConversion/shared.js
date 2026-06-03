/**
 * @file 广告转化回传 · 公共工具。
 */

/** @typedef {{ status: 'reported'|'failed'|'skipped'; response: string; provider?: string }} ReportResult */

export const DEFAULT_EVENT_MAP = {
  register: '1',
  wework_add: '1',
  lead_submit: '3',
  form: '3',
  purchase: '2',
  pay: '2',
  consult: '5',
  activate: '0',
  default: '3',
};

export const BAIDU_EVENT_MAP = {
  register: 25,
  wework_add: 25,
  lead_submit: 3,
  form: 3,
  purchase: 10,
  default: 3,
};

/**
 * @param {unknown} rawQuery
 * @returns {Record<string, string>}
 */
export function parseRawQuery(rawQuery) {
  if (!rawQuery) return {};
  if (typeof rawQuery === 'object' && !Array.isArray(rawQuery)) {
    return Object.fromEntries(
      Object.entries(rawQuery).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : String(v ?? '')]),
    );
  }
  if (typeof rawQuery === 'string') {
    try {
      const o = JSON.parse(rawQuery);
      return parseRawQuery(o);
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * 巨量/快手等常用：监测链接带回的 callback URL
 * @param {unknown} rawQuery
 */
export function extractCallbackUrl(rawQuery) {
  const q = parseRawQuery(rawQuery);
  const keys = [
    'callback',
    '__CALLBACK__',
    'cb',
    'ks_callback',
    'track_callback',
    'feedback_url',
    'zh_callback',
  ];
  for (const k of keys) {
    const raw = q[k];
    if (!raw) continue;
    try {
      const decoded = decodeURIComponent(String(raw).trim());
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        return decoded;
      }
    } catch {
      if (String(raw).startsWith('http')) return String(raw).trim();
    }
  }
  return null;
}

/**
 * @param {string} eventType
 * @param {Record<string, string>} map
 */
export function mapEventCode(eventType, map = DEFAULT_EVENT_MAP) {
  const key = String(eventType || 'lead_submit').toLowerCase();
  return map[key] ?? map.default ?? '3';
}

/**
 * @param {string} url
 * @param {RequestInit} init
 */
export async function fetchWithLog(url, init = {}) {
  const resp = await fetch(url, { ...init, redirect: 'follow' });
  const text = await resp.text();
  return { ok: resp.ok, status: resp.status, text: text.slice(0, 2000) };
}
