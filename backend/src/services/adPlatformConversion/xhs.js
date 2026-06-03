/**
 * @file 小红书聚光 · 转化回传（callback 或自定义 endpoint）。
 */
import { env } from '../../config/env.js';
import { reportCallbackConversion } from './callback.js';
import { fetchWithLog } from './shared.js';

/**
 * @param {{ clickRecord: object; eventType: string; eventValue: number }} ctx
 */
export async function reportXhsConversion(ctx) {
  const cfg = env.adConversion.xhs;

  const viaCallback = await reportCallbackConversion({
    ...ctx,
    provider: 'xhs',
    eventMap: cfg.eventTypeMap,
  });
  if (viaCallback.status === 'reported') {
    return viaCallback;
  }

  if (cfg.enabled && cfg.endpoint && cfg.accessToken) {
    const body = {
      event_type: ctx.eventType,
      click_id: ctx.clickRecord.click_key,
      conv_time: Math.floor(Date.now() / 1000),
      value: ctx.eventValue || 0,
    };
    const resp = await fetchWithLog(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (resp.ok) {
      return { status: 'reported', response: resp.text, provider: 'xhs_api' };
    }
    return { status: 'failed', response: `${resp.status}:${resp.text}`, provider: 'xhs_api' };
  }

  return viaCallback;
}
