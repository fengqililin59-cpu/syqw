/**
 * @file 多平台广告转化回传统一入口。
 */
import { reportTencentConversion } from './tencent.js';
import { reportOceanConversion } from './ocean.js';
import { reportBaiduConversion } from './baidu.js';
import { reportKuaishouConversion } from './kuaishou.js';
import { reportXhsConversion } from './xhs.js';
import { reportZhihuConversion } from './zhihu.js';
import { reportCallbackConversion } from './callback.js';

const HANDLERS = {
  gdt: reportTencentConversion,
  tencent: reportTencentConversion,
  ocean: reportOceanConversion,
  douyin: reportOceanConversion,
  byte: reportOceanConversion,
  baidu: reportBaiduConversion,
  bd: reportBaiduConversion,
  kuaishou: reportKuaishouConversion,
  ks: reportKuaishouConversion,
  xhs: reportXhsConversion,
  xiaohongshu: reportXhsConversion,
  redbook: reportXhsConversion,
  zhihu: reportZhihuConversion,
  zh: reportZhihuConversion,
};

/**
 * @param {{ clickRecord: { platform?: string; click_key?: string; raw_query?: unknown }; eventType: string; eventValue?: number }} ctx
 */
export async function reportToAdPlatform(ctx) {
  const platform = String(ctx.clickRecord.platform || 'unknown').toLowerCase();
  const handler = HANDLERS[platform];
  if (handler) {
    return handler({
      clickRecord: ctx.clickRecord,
      eventType: ctx.eventType,
      eventValue: Number(ctx.eventValue) || 0,
    });
  }

  const fallback = await reportCallbackConversion({
    clickRecord: ctx.clickRecord,
    eventType: ctx.eventType,
    eventValue: Number(ctx.eventValue) || 0,
    provider: platform,
  });
  if (fallback.status !== 'skipped') {
    return fallback;
  }

  return { status: 'skipped', response: `platform_not_supported:${platform}`, provider: platform };
}

export function listSupportedConversionPlatforms() {
  return [
    { id: 'gdt', name: '腾讯广告', modes: ['api'], env: ['TENCENT_ADS_ENABLED', 'TENCENT_ADS_ACCESS_TOKEN'] },
    {
      id: 'ocean',
      name: '抖音/巨量引擎',
      modes: ['callback', 'api'],
      env: ['监测链接带 callback', '或 OCEAN_ADS_ENABLED + OCEAN_ADS_ACCESS_TOKEN'],
    },
    { id: 'baidu', name: '百度营销', modes: ['api'], env: ['BAIDU_ADS_ENABLED', 'BAIDU_ADS_TOKEN'] },
    { id: 'kuaishou', name: '快手磁力', modes: ['callback'], env: ['监测链接带 callback'] },
    { id: 'xhs', name: '小红书聚光', modes: ['callback', 'api'], env: ['XHS_ADS_ENABLED', 'XHS_ADS_ENDPOINT'] },
    { id: 'zhihu', name: '知乎效果营销', modes: ['callback'], env: ['监测链接带 callback 宏 __CALLBACK__'] },
  ];
}
