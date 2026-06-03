/**
 * @file 巨量引擎（抖音）· 转化回传：优先 callback，可选 Analytics API。
 */
import { env } from '../../config/env.js';
import { reportCallbackConversion } from './callback.js';
import { fetchWithLog } from './shared.js';

/**
 * @param {{ clickRecord: object; eventType: string; eventValue: number }} ctx
 */
export async function reportOceanConversion(ctx) {
  const cfg = env.adConversion.ocean;

  const viaCallback = await reportCallbackConversion({
    ...ctx,
    provider: 'ocean',
    eventMap: cfg.eventTypeMap,
  });
  if (viaCallback.status === 'reported') {
    return viaCallback;
  }

  if (cfg.enabled && cfg.accessToken && cfg.endpoint) {
    const body = {
      event_type: ctx.eventType,
      click_id: ctx.clickRecord.click_key,
      timestamp: Math.floor(Date.now() / 1000),
      value: ctx.eventValue || 0,
    };
    const resp = await fetchWithLog(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': cfg.accessToken,
      },
      body: JSON.stringify(body),
    });
    if (resp.ok) {
      return { status: 'reported', response: resp.text, provider: 'ocean_api' };
    }
    if (viaCallback.status !== 'skipped') {
      return viaCallback;
    }
    return { status: 'failed', response: `${resp.status}:${resp.text}`, provider: 'ocean_api' };
  }

  return viaCallback.status === 'skipped'
    ? { status: 'skipped', response: 'ocean_no_callback_or_api', provider: 'ocean' }
    : viaCallback;
}
