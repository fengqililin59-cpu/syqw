/**
 * @file 百度营销 · OCPC 转化回传。
 */
import { env } from '../../config/env.js';
import { BAIDU_EVENT_MAP, fetchWithLog } from './shared.js';

/**
 * @param {{ clickRecord: object; eventType: string; eventValue: number }} ctx
 */
export async function reportBaiduConversion(ctx) {
  const cfg = env.adConversion.baidu;
  if (!cfg.enabled) {
    return { status: 'skipped', response: 'baidu_ads_disabled', provider: 'baidu' };
  }
  if (!cfg.token) {
    return { status: 'failed', response: 'missing_baidu_ads_token', provider: 'baidu' };
  }

  const bdVid = ctx.clickRecord.click_key;
  const base = (cfg.logidUrlBase || env.frontendUrl || 'https://example.com').replace(/\/$/, '');
  const logidUrl = `${base}/?bd_vid=${encodeURIComponent(bdVid)}`;

  const newType = BAIDU_EVENT_MAP[ctx.eventType] ?? BAIDU_EVENT_MAP.default;

  const body = {
    token: cfg.token,
    conversionTypes: [
      {
        logidUrl,
        newType,
      },
    ],
  };

  const endpoint =
    cfg.endpoint || 'https://ocpc.baidu.com/ocpcapi/api/uploadConvertData';

  const resp = await fetchWithLog(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (resp.ok) {
    return { status: 'reported', response: resp.text, provider: 'baidu' };
  }
  return { status: 'failed', response: `${resp.status}:${resp.text}`, provider: 'baidu' };
}
