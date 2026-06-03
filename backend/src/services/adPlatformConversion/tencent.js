/**
 * @file 腾讯广点通 · 转化回传。
 */
import { env } from '../../config/env.js';
import { fetchWithLog } from './shared.js';

/**
 * @param {{ clickRecord: object; eventType: string; eventValue: number }} ctx
 */
export async function reportTencentConversion(ctx) {
  const cfg = env.adConversion.tencent;
  if (!cfg.enabled) {
    return { status: 'skipped', response: 'tencent_ads_disabled', provider: 'gdt' };
  }
  if (!cfg.accessToken || !cfg.accountId) {
    return { status: 'failed', response: 'missing_tencent_ads_credentials', provider: 'gdt' };
  }

  const body = {
    account_id: cfg.accountId,
    click_id: ctx.clickRecord.click_key,
    conversion_type: ctx.eventType,
    conversion_time: Math.floor(Date.now() / 1000),
    value: Number.isFinite(ctx.eventValue) ? ctx.eventValue : 0,
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
    return { status: 'reported', response: resp.text, provider: 'gdt' };
  }
  return { status: 'failed', response: `${resp.status}:${resp.text}`, provider: 'gdt' };
}
