/**
 * @file 获客向导：按渠道生成链接与接入说明（不含自动投流）。
 */
import { env } from '../config/env.js';
import { getOnboardingChecklist } from './onboardingChecklist.service.js';

function publicApiBase() {
  const explicit = (process.env.API_PUBLIC_URL || process.env.BACKEND_PUBLIC_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const front = String(env.appUrl || env.frontendUrl || '').replace(/\/$/, '');
  if (front) return `${front}/api/v1`;
  return 'https://你的域名/api/v1';
}

function encodeNext(url) {
  return encodeURIComponent(url);
}

/**
 * @param {{ tenantId: number }} auth
 */
export async function getAcquisitionWizard(auth) {
  const tenantId = Number(auth.tenantId);
  const api = publicApiBase();
  const front = String(env.appUrl || env.frontendUrl || 'http://localhost:5173').replace(/\/$/, '');
  const landing = `${front}/landing.html?tenant=${tenantId}&utm_source=douyin&utm_medium=cpc`;
  const leadForm = `${front}/lead-form.html?tenant=${tenantId}&utm_source=douyin`;

  const oceanMonitor = `${api}/ads/redirect?platform=ocean&clickid=__CLICKID__&callback=__CALLBACK__&tenant_id=${tenantId}&next=${encodeNext(leadForm)}`;
  const gdtMonitor = `${api}/ads/redirect?platform=gdt&click_id=__CLICK_ID__&tenant_id=${tenantId}&next=${encodeNext(leadForm)}`;
  const baiduMonitor = `${api}/ads/redirect?platform=baidu&bd_vid=__BD_VID__&tenant_id=${tenantId}&next=${encodeNext(leadForm)}`;
  const ksMonitor = `${api}/ads/redirect?platform=kuaishou&callback=__CALLBACK__&tenant_id=${tenantId}&next=${encodeNext(leadForm)}`;
  const xhsMonitor = `${api}/ads/redirect?platform=xhs&click_id=__CLICK_ID__&callback=__CALLBACK__&tenant_id=${tenantId}&next=${encodeNext(leadForm)}`;
  const zhihuMonitor = `${api}/ads/redirect?platform=zhihu&track_id=__TRACK_ID__&callback=__CALLBACK__&tenant_id=${tenantId}&next=${encodeNext(leadForm)}`;

  const checklist = await getOnboardingChecklist(auth);

  const channels = [
    {
      id: 'wework_live',
      title: '企微渠道活码（推荐主路径）',
      summary: '广告/线下/直播口播 → 扫码加好友 → 自动建档 + 欢迎流程',
      steps: [
        '系统设置中完成企微配置',
        '渠道活码 → 按渠道各建一个码；投流专用码创建时填 ad_hit，或监测落地后 GET /ads/wework-state?tenant_id=&ad_hit= 取 state',
        '投流路径：监测链 → 留资/落地页带 ad_hit → 活码 state=zfah{ad_hit}，加好友自动回传 wework_add',
        '自动化流程 → 一键起步包（新客欢迎）',
        '把活码投到素材里',
      ],
      links: [
        { label: '渠道活码', path: '/app/channel-live' },
        { label: '自动化流程', path: '/app/flows' },
        { label: '系统设置', path: '/app/settings' },
      ],
      api_status: 'ready',
    },
    {
      id: 'douyin_ads',
      title: '抖音 / 巨量引擎投流（广告 API）',
      summary: '监测 + 转化回传已支持（监测链带回 callback 时自动 GET 回传；也可配 OCEAN_ADS_* API）',
      steps: [
        '在巨量广告后台创建落地页/橙子建站，或投放「销售线索」类计划',
        '监测链接填写下方「巨量监测 URL」（宏：clickid、callback）',
        '落地页 next 指向留资页；URL 会带上 ad_hit / clickid，留资成功自动回传 lead_submit',
        '也可手动 POST /api/v1/ads/conversion；在「广告 ROI」查看回传状态',
        '消耗可手动 JSON 导入，或待 Ocean 消耗同步开发完成',
      ],
      links: [
        { label: '广告 ROI', path: '/app/ads-roi' },
        { label: '渠道分析', path: '/app/channel-report' },
        { label: '获客指南（抖音话术）', path: '/app/guide-templates' },
      ],
      templates: {
        monitor_url: oceanMonitor,
        landing_url: landing,
        landing_url_note: '监测链 next 指向 landing 或 lead-form；URL 会附加 ad_hit，留资/加企微自动回传',
        wework_state_api: `GET ${api}/ads/wework-state?tenant_id=${tenantId}&ad_hit={点击记录id}`,
        lead_form_url: leadForm,
        conversion_api: 'POST /api/v1/ads/conversion',
        conversion_body_example: {
          clickKey: '来自点击记录的 clickid',
          eventType: 'lead_submit',
          eventValue: 0,
        },
      },
      api_integration: {
        click_tracking: {
          status: 'ready',
          entry: 'backend/src/services/adTracking.service.js → handleAdRedirect / storeClickRecord',
          route: 'GET /api/v1/ads/redirect',
          platform_key: 'ocean（platform=ocean 或 URL 带 clickid）',
        },
        conversion_report: {
          status: 'ready',
          entry: 'adPlatformConversion/ocean.js（callback 优先，可选 OCEAN_ADS_* API）',
          route: 'POST /api/v1/ads/conversion',
          auto_on_lead: 'AD_CONVERSION_AUTO_ON_LEAD=1（默认）',
          env_vars_suggested: ['监测链 macro callback', 'OCEAN_ADS_ENABLED', 'OCEAN_ADS_ACCESS_TOKEN'],
        },
        spend_sync: {
          status: 'planned',
          entry: '可参考 backend/src/services/tencentAdsSpendSync.service.js 新建 oceanAdsSpendSync.service.js',
          route: 'POST /api/v1/ads/spend/sync/ocean（待开发）',
          note: '腾讯已支持 POST /ads/spend/sync/tencent；抖音需单独接 Marketing API 日报',
        },
      },
      api_status: 'ready',
    },
    {
      id: 'baidu_ads',
      title: '百度营销投流',
      summary: '监测 + OCPC 转化回传（需 BAIDU_ADS_TOKEN）',
      steps: [
        '监测链接使用下方百度监测 URL（宏 bd_vid）',
        'backend/.env 配置 BAIDU_ADS_ENABLED=1、BAIDU_ADS_TOKEN',
        '留资页带 bd_vid 或 ad_hit 时自动回传；也可 POST /api/v1/ads/conversion',
      ],
      links: [{ label: '广告 ROI', path: '/app/ads-roi' }],
      templates: { monitor_url: baiduMonitor, lead_form_url: leadForm },
      api_integration: {
        conversion_report: {
          status: 'ready',
          entry: 'adPlatformConversion/baidu.js',
          env_vars: ['BAIDU_ADS_ENABLED', 'BAIDU_ADS_TOKEN', 'BAIDU_ADS_LOGID_URL_BASE'],
        },
      },
      api_status: 'ready',
    },
    {
      id: 'kuaishou_ads',
      title: '快手磁力投流',
      summary: '监测 + callback 转化回传（监测链须带回 __CALLBACK__ 宏）',
      steps: [
        '监测链接使用下方快手监测 URL',
        '留资成功自动回传；在广告 ROI 查看 reported 比例',
      ],
      links: [{ label: '广告 ROI', path: '/app/ads-roi' }],
      templates: { monitor_url: ksMonitor, lead_form_url: leadForm },
      api_integration: {
        conversion_report: { status: 'ready', entry: 'adPlatformConversion/kuaishou.js' },
      },
      api_status: 'ready',
    },
    {
      id: 'xhs_ads',
      title: '小红书聚光投流',
      summary: '监测 + callback / 自定义 API 回传',
      steps: [
        '监测链接使用下方聚光监测 URL',
        '可选配置 XHS_ADS_ENABLED、XHS_ADS_ENDPOINT、XHS_ADS_ACCESS_TOKEN',
      ],
      links: [{ label: '广告 ROI', path: '/app/ads-roi' }],
      templates: { monitor_url: xhsMonitor, lead_form_url: leadForm },
      api_integration: {
        conversion_report: {
          status: 'ready',
          entry: 'adPlatformConversion/xhs.js',
          env_vars: ['XHS_ADS_ENABLED', 'XHS_ADS_ENDPOINT', 'XHS_ADS_ACCESS_TOKEN'],
        },
      },
      api_status: 'ready',
    },
    {
      id: 'zhihu_ads',
      title: '知乎效果营销投流',
      summary: '监测 + callback 转化回传（监测链须带回 __CALLBACK__ 宏）',
      steps: [
        '在知乎广告后台创建计划，监测链接使用下方「知乎监测 URL」',
        '宏 track_id、callback 与后台一致；落地页 next 指向留资页',
        '留资成功默认自动回传 lead_submit；在「广告 ROI」查看回传状态',
      ],
      links: [{ label: '广告 ROI', path: '/app/ads-roi' }],
      templates: { monitor_url: zhihuMonitor, lead_form_url: leadForm },
      api_integration: {
        conversion_report: {
          status: 'ready',
          entry: 'adPlatformConversion/zhihu.js',
          note: 'callback GET 回传，无服务端 Token；事件码可按知乎后台文档调整 ZHIHU_EVENT_MAP',
        },
      },
      api_status: 'ready',
    },
    {
      id: 'tencent_ads',
      title: '腾讯广告（广点通）',
      summary: '监测 + 转化回传 + 消耗同步（需服务器配置 TENCENT_ADS_*）',
      steps: [
        '监测链接使用下方腾讯监测 URL',
        'backend/.env 配置 TENCENT_ADS_ACCESS_TOKEN、TENCENT_ADS_ACCOUNT_ID 等',
        '转化走 POST /api/v1/ads/conversion；消耗可在广告 ROI 页同步腾讯日报',
      ],
      links: [{ label: '广告 ROI', path: '/app/ads-roi' }],
      templates: {
        monitor_url: gdtMonitor,
      },
      api_integration: {
        conversion_report: {
          status: 'ready',
          entry: 'adPlatformConversion/tencent.js',
          env_vars: ['TENCENT_ADS_ENABLED', 'TENCENT_ADS_ACCESS_TOKEN', 'TENCENT_ADS_ACCOUNT_ID'],
        },
        spend_sync: {
          status: 'ready',
          route: 'POST /api/v1/ads/spend/sync/tencent',
        },
      },
      api_status: 'ready',
    },
    {
      id: 'h5_lead',
      title: 'H5 留资（不先加企微）',
      summary: '信息流落地页表单 → 直接进客户库并触发流程',
      steps: [
        '复制留资链接投放到广告落地页（建议经 /ads/redirect 监测链，落地页会带 ad_hit）',
        '配置线索分配（设置 → 线索设置）',
        '留资成功默认自动向广告平台回传（AD_CONVERSION_AUTO_ON_LEAD）',
        '用渠道分析看 lead_submit 漏斗',
      ],
      links: [
        { label: '渠道分析', path: '/app/channel-report' },
        { label: '客户列表', path: '/app/customers' },
      ],
      templates: {
        lead_form_url: leadForm,
      },
      api_status: 'ready',
    },
    {
      id: 'douyin_dm',
      title: '抖音私信 / 自然流（非投放 API）',
      summary: '把私信转到统一收件箱；与「投流监测」是两套接口',
      steps: [
        '设置 → 运维工具 → 配置 douyin_client_secret',
        '在抖音开放平台配置消息 Webhook 到 ZhiFlow 公域收件箱地址',
        '销售在收件箱回复；不会自动全网获客',
      ],
      links: [
        { label: '获客指南', path: '/app/guide-templates' },
        { label: '收件箱', path: '/app/inbox' },
        { label: '系统设置', path: '/app/settings' },
      ],
      api_integration: {
        webhook: {
          status: 'ready',
          entry: '公域 Webhook 收件（非 ads 路由）',
          settings: '租户设置 douyin_client_key / douyin_client_secret',
        },
      },
      api_status: 'ready',
    },
  ];

  return {
    tenant_id: tenantId,
    public_api_base: api,
    frontend_base: front,
    checklist,
    channels,
    disclaimer:
      'ZhiFlow 不负责替您创建/投放广告计划；请在各平台广告后台投放，用本系统做监测、线索承接与私域跟进。',
  };
}
