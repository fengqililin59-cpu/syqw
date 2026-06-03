/**
 * @file 知乎效果营销 · 转化回传（callback 模式，与快手/巨量监测链一致）。
 * 监测链接须带回平台宏 __CALLBACK__；无官方开放 API 文档时不接服务端 Token 模式。
 */
import { reportCallbackConversion } from './callback.js';

/** 知乎常见转化类型编码（以监测链 GET 回传为准，可按后台文档调整） */
const ZHIHU_EVENT_MAP = {
  register: '1',
  wework_add: '1',
  lead_submit: '9',
  form: '9',
  purchase: '3',
  consult: '5',
  default: '9',
};

/**
 * @param {{ clickRecord: object; eventType: string; eventValue: number }} ctx
 */
export async function reportZhihuConversion(ctx) {
  return reportCallbackConversion({
    ...ctx,
    provider: 'zhihu',
    eventMap: ZHIHU_EVENT_MAP,
  });
}
