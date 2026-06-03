/**
 * @file 快手磁力 · 转化回传（callback 模式为主）。
 */
import { reportCallbackConversion } from './callback.js';

const KS_EVENT_MAP = {
  register: '1',
  wework_add: '1',
  lead_submit: '9',
  form: '9',
  purchase: '3',
  default: '9',
};

/**
 * @param {{ clickRecord: object; eventType: string; eventValue: number }} ctx
 */
export async function reportKuaishouConversion(ctx) {
  return reportCallbackConversion({
    ...ctx,
    provider: 'kuaishou',
    eventMap: KS_EVENT_MAP,
  });
}
