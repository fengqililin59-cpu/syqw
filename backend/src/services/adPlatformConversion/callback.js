/**
 * @file 监测 callback URL 回传（巨量/快手/部分小红书等通用模式）。
 */
import { env } from '../../config/env.js';
import { extractCallbackUrl, fetchWithLog, mapEventCode } from './shared.js';

/**
 * @param {{ clickRecord: object; eventType: string; eventValue: number; provider: string; eventMap?: Record<string, string> }} ctx
 */
export async function reportCallbackConversion(ctx) {
  const callbackUrl = extractCallbackUrl(ctx.clickRecord.raw_query);
  if (!callbackUrl) {
    return { status: 'skipped', response: 'no_callback_in_click', provider: ctx.provider };
  }

  let url;
  try {
    url = new URL(callbackUrl);
  } catch {
    return { status: 'failed', response: 'invalid_callback_url', provider: ctx.provider };
  }

  const eventMap = ctx.eventMap || env.adConversion.ocean.eventTypeMap;
  const eventCode = mapEventCode(ctx.eventType, eventMap);
  url.searchParams.set('event_type', String(eventCode));
  url.searchParams.set('conv_time', String(Math.floor(Date.now() / 1000)));
  if (ctx.eventValue > 0) {
    url.searchParams.set('value', String(ctx.eventValue));
  }

  const resp = await fetchWithLog(url.toString(), { method: 'GET' });
  if (resp.ok) {
    return { status: 'reported', response: resp.text, provider: ctx.provider };
  }
  return { status: 'failed', response: `${resp.status}:${resp.text}`, provider: ctx.provider };
}
