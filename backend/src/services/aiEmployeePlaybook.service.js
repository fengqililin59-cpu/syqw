/**
 * @file AI 员工启动向导：按「企微 + 公域收件箱 + AI 草稿 + 规则跟进」检查配置进度。
 */
import { Op } from 'sequelize';
import {
  Tenant,
  Flow,
  AutomationRule,
  User,
  WeworkChannel,
  KbDocument,
  ScriptLibraryItem,
  InboxThread,
  UsageStat,
} from '../models/index.js';
import { WELCOME_FLOW_NAME } from './flowTemplates.service.js';
import { env } from '../config/env.js';
import { getPublicWebhookInfo } from './publicInboxIngest.service.js';
import { getOrCreatePublicWebhookSettings } from './publicWebhookAuth.service.js';
import { getInboxAutoDraftStatus } from './inboxAutoDraft.service.js';

/**
 * @param {{ tenantId: number }} auth
 */
export async function getAiEmployeePlaybook(auth) {
  const tenantId = auth.tenantId;
  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['id', 'name', 'wework_corp_id', 'wework_secret', 'allow_auto_send', 'inbox_ai_auto_send', 'inbox_ai_auto_send_pricing'],
  });

  const statMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [
    staffWithWework,
    channelCount,
    adBoundChannels,
    welcomeFlow,
    ruleCount,
    activeFlows,
    kbCount,
    scriptCount,
    inboxThreads,
    usageRow,
    webhookSettings,
    webhookInfo,
  ] = await Promise.all([
    User.count({
      where: { tenant_id: tenantId, status: 1, wework_userid: { [Op.ne]: null } },
    }),
    WeworkChannel.count({ where: { tenant_id: tenantId } }),
    WeworkChannel.count({
      where: {
        tenant_id: tenantId,
        config: { [Op.ne]: null },
      },
    }).then(async (n) => {
      if (n === 0) return 0;
      const rows = await WeworkChannel.findAll({
        where: { tenant_id: tenantId },
        attributes: ['config'],
        limit: 200,
      });
      return rows.filter((r) => {
        const cfg = r.config && typeof r.config === 'object' ? r.config : {};
        return cfg.ad_hit != null || cfg.adHit != null;
      }).length;
    }),
    Flow.findOne({
      where: { tenant_id: tenantId, name: WELCOME_FLOW_NAME },
      attributes: ['id', 'status'],
    }),
    AutomationRule.count({ where: { tenant_id: tenantId, enabled: 1 } }),
    Flow.count({ where: { tenant_id: tenantId, status: 'active' } }),
    KbDocument.count({ where: { tenant_id: tenantId } }),
    ScriptLibraryItem.count({ where: { tenant_id: tenantId } }),
    InboxThread.count({ where: { tenant_id: tenantId } }),
    UsageStat.findOne({ where: { tenant_id: tenantId, stat_month: statMonth }, attributes: ['ai_calls_used'] }),
    getOrCreatePublicWebhookSettings(tenantId).catch(() => null),
    getPublicWebhookInfo(tenantId).catch(() => null),
  ]);

  const weworkOk = Boolean(tenant?.wework_corp_id && tenant?.wework_secret);
  const douyinWebhook = Boolean(webhookSettings?.douyin_client_secret);
  const xhsWebhook = Boolean(webhookSettings?.xhs_webhook_token);
  const publicInboxOk = douyinWebhook || xhsWebhook;
  const aiUsed = Number(usageRow?.ai_calls_used || 0) > 0;
  const aiKeyConfigured = Boolean(env.ai.deepseekApiKey || env.ai.openaiApiKey);

  const phases = [
    {
      id: 'connect',
      title: '1. 接客：企微 + 活码',
      summary: '客户从广告/内容进来，先能加好友、进 CRM',
      items: [
        {
          key: 'wework',
          label: '配置企业微信（CorpID / Secret / 回调）',
          done: weworkOk,
          path: '/app/settings',
          hint: '系统设置 → 企微与云配置',
          required: true,
        },
        {
          key: 'staff_wework',
          label: '至少 1 名员工绑定企微 userid',
          done: staffWithWework > 0,
          path: '/app/users',
          hint: '否则自动跟进无法 @ 到负责人',
          required: true,
        },
        {
          key: 'live_code',
          label: '创建渠道活码（建议投流专用码绑定 ad_hit）',
          done: channelCount > 0,
          path: '/app/channel-live',
          hint: adBoundChannels > 0 ? `已有 ${adBoundChannels} 个活码绑定广告点击` : '投流时在创建活码填 ad_hit，加好友自动回传',
          required: true,
        },
        {
          key: 'acquisition',
          label: '复制监测链 / 留资链（可选投流）',
          done: true,
          path: '/app/acquisition-wizard',
          hint: '营销获客 → 获客向导',
          required: false,
        },
      ],
    },
    {
      id: 'inbox',
      title: '2. 接话：统一收件箱',
      summary: '抖音 / 小红书私信进系统，AI 写草稿，人工点发送',
      items: [
        {
          key: 'douyin_webhook',
          label: '配置抖音私信 Webhook（douyin_client_secret）',
          done: douyinWebhook,
          path: '/app/settings',
          hint: webhookInfo?.example_douyin || '设置 → 公域 Webhook',
          required: false,
        },
        {
          key: 'xhs_webhook',
          label: '配置小红书 Webhook（xhs_webhook_token）',
          done: xhsWebhook,
          path: '/app/settings',
          hint: webhookInfo?.example_xiaohongshu || '设置 → 公域 Webhook',
          required: false,
        },
        {
          key: 'inbox_ready',
          label: '公域或企微至少一路消息已接入',
          done: weworkOk && (publicInboxOk || inboxThreads > 0),
          path: '/app/inbox',
          hint: publicInboxOk ? 'Webhook 已配，可在收件箱用「Webhook 测试」联调' : '企微消息同步或公域 Webhook 任一即可',
          required: true,
        },
        {
          key: 'inbox_auto_draft',
          label: '（运维）开启收件箱自动草稿+延迟发送',
          done: env.inboxAutoDraft,
          path: '/app/inbox',
          hint: env.inboxAutoDraft
            ? `INBOX_AUTO_DRAFT=1，${env.inboxAutoDraftDelaySec}s 内销售未回则 AI 草稿并尝试自动发送`
            : 'backend/.env 设 INBOX_AUTO_DRAFT=1，默认延迟 30 秒',
          required: false,
        },
        {
          key: 'inbox_trial',
          label: '在收件箱处理过至少 1 条会话（或 Webhook 测试）',
          done: inboxThreads > 0,
          path: '/app/inbox',
          hint: '开启 INBOX_AUTO_DRAFT 后，客户消息延迟后自动草稿/发送',
          required: false,
        },
      ],
    },
    {
      id: 'ai_brain',
      title: '3. 会聊：AI 大脑',
      summary: '知识库 + 话术库，让草稿更像你的销售',
      items: [
        {
          key: 'kb',
          label: '上传至少 1 份知识库文档（产品/FAQ）',
          done: kbCount > 0,
          path: '/app/knowledge-base',
          required: true,
        },
        {
          key: 'scripts',
          label: '导入或编写话术库（可选行业包）',
          done: scriptCount > 0,
          path: '/app/script-library',
          required: false,
        },
        {
          key: 'ai_trial',
          label: '试用 AI（助手或收件箱草稿消耗 1 次配额）',
          done: aiUsed,
          path: '/app/ai-assistant',
          required: true,
        },
        {
          key: 'ai_review',
          label: '了解 AI 审核台（投诉/报价类会待人工）',
          done: true,
          path: '/app/ai-review',
          hint: '可选开启「收件箱 FAQ 自动发送」处理资料类咨询',
          required: false,
        },
        {
          key: 'inbox_ai_auto_send',
          label: '（可选）开启收件箱 FAQ 自动发送',
          done: Boolean(tenant?.inbox_ai_auto_send) && env.inboxAiAutoSendEnabled,
          path: '/app/settings',
          hint: 'p0 资料类置信≥75% 自动发',
          required: false,
        },
        {
          key: 'inbox_ai_auto_send_pricing',
          label: '（可选）开启简单询价自动发送',
          done: Boolean(tenant?.inbox_ai_auto_send_pricing) && env.inboxAiAutoSendEnabled,
          path: '/app/settings',
          hint: '须先开 FAQ 自动发送；p1 询价置信≥85%，含合同/底价等仍人工',
          required: false,
        },
      ],
    },
    {
      id: 'automate',
      title: '4. 不漏客：自动化',
      summary: '新客欢迎 + 沉默提醒；默认提醒销售，不骚扰客户',
      items: [
        {
          key: 'starter_pack',
          label: '初始化起步包（欢迎流程 + 自动跟进规则）',
          done: Boolean(welcomeFlow) && ruleCount >= 1,
          path: '/app/flows',
          hint: '自动化流程 → 一键起步包',
          required: true,
        },
        {
          key: 'active_flow',
          label: '至少 1 条流程处于启用',
          done: activeFlows > 0,
          path: '/app/flows',
          required: true,
        },
        {
          key: 'auto_send',
          label: '（可选）开启企微自动发送欢迎语',
          done: Boolean(tenant?.allow_auto_send),
          path: '/app/settings',
          hint: '仅用于新客欢迎等流程；收件箱 AI 仍须人工确认',
          required: false,
        },
        {
          key: 'automation_rules',
          label: '自动跟进规则已启用',
          done: ruleCount >= 1,
          path: '/app/automation-rules',
          hint: '可点「立即扫描一次」试跑',
          required: true,
        },
      ],
    },
    {
      id: 'close',
      title: '5. 成交：电话 / 短信 / 阶段',
      summary: '高意向推阶段，电话短信辅助逼单',
      items: [
        {
          key: 'intent_alerts',
          label: '开启意向预警关注高潜客户',
          done: true,
          path: '/app/intent-alerts',
          required: false,
        },
        {
          key: 'followups',
          label: '使用待跟进 / 客户详情推进阶段',
          done: true,
          path: '/app/follow-ups',
          required: false,
        },
        {
          key: 'calls_sms',
          label: '配置通话与短信（外呼记录 + 短信模板）',
          done: true,
          path: '/app/sms',
          hint: '电话一键外呼在客户详情；短信为活动式群发',
          required: false,
        },
      ],
    },
  ];

  const allItems = phases.flatMap((p) => p.items);
  const requiredItems = allItems.filter((i) => i.required);
  const doneRequired = requiredItems.filter((i) => i.done).length;
  const doneAll = allItems.filter((i) => i.done).length;

  const serverEnv = [];
  if (!aiKeyConfigured) serverEnv.push('DEEPSEEK_API_KEY 或 OPENAI_API_KEY（AI 草稿质量）');
  if (!env.inboxAutoDraft) {
    serverEnv.push('INBOX_AUTO_DRAFT=1（客户新消息延迟后自动草稿+发送）');
  } else {
    serverEnv.push(
      `INBOX_AUTO_DRAFT=1 已开，延迟 ${env.inboxAutoDraftDelaySec}s（INBOX_AUTO_DRAFT_DELAY_SEC 可调 0–120）`,
    );
  }
  if (!env.inboxAiAutoSendEnabled) serverEnv.push('INBOX_AI_AUTO_SEND=0 已禁用全平台 FAQ 自动发送');
  if (!env.enableAutomationCron) serverEnv.push('ENABLE_AUTOMATION_CRON=1（自动跟进定时扫描）');
  if (!env.enableInboxSlaCron) serverEnv.push('ENABLE_INBOX_SLA_CRON=1（收件箱超时提醒）');
  if (!env.enableAiAutoReplyDigestCron) {
    serverEnv.push('ENABLE_AI_AUTO_REPLY_DIGEST_CRON=1（每日 18:00 企微推送 AI 自动回复摘要）');
  }
  if (!env.scoreOnWeworkMessage) serverEnv.push('SCORE_ON_WEWORK_MESSAGE=1（每条企微消息重算意向分，耗 AI）');

  return {
    tenant_id: tenantId,
    progress: {
      required_percent: requiredItems.length
        ? Math.round((doneRequired / requiredItems.length) * 100)
        : 100,
      all_percent: allItems.length ? Math.round((doneAll / allItems.length) * 100) : 100,
      done_required: doneRequired,
      required_total: requiredItems.length,
      done_all: doneAll,
      all_total: allItems.length,
    },
    phases,
    daily_routine: [
      { time: '上午', action: '打开统一收件箱 + AI 审核台，处理昨夜公域/企微消息' },
      { time: '白天', action: '意向预警 → 待跟进 → 客户详情一键外呼/发企微' },
      { time: '投流期', action: '广告 ROI 看回传率；活码 ad_hit 与监测链一致' },
    ],
    limits: [
      'INBOX_AUTO_DRAFT=1：客户消息后延迟（默认 30s）自动草稿；销售先回则取消',
      '可选：开启「收件箱 FAQ 自动发送」后，资料类可自动回复',
      '可选：开启「简单询价自动发送」后，问价类（无合同/底价词）可自动回复',
      '投诉/退款/报价类一律 pending_human，须人工审核',
      '自动跟进规则：企微应用消息提醒负责人，默认不直发客户',
      '个人微信：不支持代聊；电话/短信无 AI 自动拨号',
    ],
    webhook: webhookInfo
      ? {
          douyin_url: webhookInfo.example_douyin,
          xhs_url: webhookInfo.example_xiaohongshu,
          douyin_configured: douyinWebhook,
          xhs_configured: xhsWebhook,
        }
      : null,
    server_env_hints: serverEnv,
    inbox_auto_draft: getInboxAutoDraftStatus(),
  };
}
