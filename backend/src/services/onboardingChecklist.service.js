/**
 * @file 租户上线检查清单（管理员仪表盘）。
 */
import { Op } from 'sequelize';
import { Tenant, Flow, AutomationRule, Customer, User, UsageStat } from '../models/index.js';
import { WELCOME_FLOW_NAME } from './flowTemplates.service.js';
import { isAdmin } from '../utils/permissions.js';
import { env } from '../config/env.js';
import { getOrCreatePublicWebhookSettings } from './publicWebhookAuth.service.js';

/**
 * @param {{ tenantId: number; userId: number }} auth
 */
export async function getOnboardingChecklist(auth) {
  const tenantId = auth.tenantId;
  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['id', 'wework_corp_id', 'wework_secret', 'wework_agent_id', 'name'],
  });

  const statMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [staffWithWework, customerCount, welcomeFlow, ruleCount, activeFlows, usageRow, webhookSettings, oceanLeadCount] = await Promise.all([
    User.count({
      where: { tenant_id: tenantId, status: 1, wework_userid: { [Op.ne]: null } },
    }),
    Customer.count({ where: { tenant_id: tenantId } }),
    Flow.findOne({
      where: { tenant_id: tenantId, name: WELCOME_FLOW_NAME },
      attributes: ['id', 'status'],
    }),
    AutomationRule.count({ where: { tenant_id: tenantId, enabled: 1 } }),
    Flow.count({ where: { tenant_id: tenantId, status: 'active' } }),
    UsageStat.findOne({ where: { tenant_id: tenantId, stat_month: statMonth }, attributes: ['ai_calls_used'] }),
    getOrCreatePublicWebhookSettings(tenantId).catch(() => null),
    Customer.count({ where: { tenant_id: tenantId, source: { [Op.like]: '%巨量%' } } }),
  ]);

  const weworkOk = Boolean(tenant?.wework_corp_id && tenant?.wework_secret);
  const items = [
    {
      key: 'wework',
      label: '配置企微应用（CorpID / Secret / 回调）',
      done: weworkOk,
      link: '/app/settings',
      hint: '设置 → 企微与云配置',
    },
    {
      key: 'staff_wework',
      label: '员工绑定企微 UserID',
      done: staffWithWework > 0,
      link: '/app/users',
      hint: '用户管理 → 填写 wework_userid',
    },
    {
      key: 'starter_pack',
      label: '初始化起步包（欢迎流程 + 自动跟进）',
      done: Boolean(welcomeFlow) && ruleCount >= 1,
      link: '/app/flows',
      hint: '自动化流程 → 一键起步包',
    },
    {
      key: 'active_flow',
      label: '至少 1 条流程处于启用状态',
      done: activeFlows > 0,
      link: '/app/flows',
    },
    {
      key: 'landing_track',
      label: '落地页埋点与渠道分析',
      done: true,
      link: '/app/channel-report',
      hint: `/landing.html?utm_source=demo&tenant=${tenantId}`,
    },
    {
      key: 'lead_form',
      label: 'H5 留资表单已就绪',
      done: true,
      link: '/app/flows',
      hint: `链接：/lead-form.html?tenant=${tenantId}`,
    },
    {
      key: 'customers',
      label: '已有客户数据（同步 / 留资 / 导入）',
      done: customerCount > 0,
      link: '/app/customers',
    },
    {
      key: 'ai_assistant',
      label: '试用站内 AI 助手（生成一条销售话术）',
      done: Number(usageRow?.ai_calls_used || 0) > 0,
      link: '/app/ai-assistant',
      hint: '侧栏「AI 智能」→ 智能助手，可复制到企微发送',
    },
    {
      key: 'ocean_lead_webhook',
      label: '接入巨量引擎表单广告（投流线索自动入库）',
      done: Boolean(webhookSettings?.douyin_client_key || webhookSettings?.douyin_client_secret || oceanLeadCount > 0),
      link: '/app/settings',
      hint: '设置 → 公域 Webhook → 复制「巨量引擎表单广告 Webhook 地址」填到广告后台',
    },
    {
      key: 'billing',
      label: '查看套餐、试用剩余天数与升级方式',
      done: true,
      link: '/app/billing',
      hint: '新注册 14 天专业版试用；支持微信支付 / 兑换码 / 线下转账',
    },
  ];

  const cronHints = [];
  if (!env.enableFlowEngineCron) cronHints.push('ENABLE_FLOW_ENGINE_CRON=1（延迟节点）');
  if (!env.enableAutomationCron) cronHints.push('ENABLE_AUTOMATION_CRON=1（自动跟进扫描）');
  if (!env.enableInboxSlaCron) cronHints.push('ENABLE_INBOX_SLA_CRON=1（收件箱 SLA）');
  if (!env.enableFollowupDueCron) cronHints.push('ENABLE_FOLLOWUP_DUE_CRON=1（跟进到期提醒）');
  if (!env.enableWeeklyDigestCron) cronHints.push('ENABLE_WEEKLY_DIGEST_CRON=1（每周价值战报）');
  if (!env.enableTodayActionsCron) cronHints.push('ENABLE_TODAY_ACTIONS_CRON=1（每日今日必做企微推送）');
  if (!env.enableAiAutoReplyDigestCron) cronHints.push('ENABLE_AI_AUTO_REPLY_DIGEST_CRON=1（每日 AI 自动回复摘要 18:00）');
  if (!env.enableChurnAlertCron) cronHints.push('ENABLE_CHURN_ALERT_CRON=1（活跃流失预警）');
  if (env.autoCreateCustomerOnWeworkAdd === false) {
    cronHints.push('AUTO_CREATE_CUSTOMER_ON_WEWORK_ADD 已关闭');
  }

  const doneCount = items.filter((i) => i.done).length;
  return {
    progress_percent: Math.round((doneCount / items.length) * 100),
    done_count: doneCount,
    total: items.length,
    items,
    cron_hints: cronHints,
    admin_only_note: isAdmin(auth)
      ? null
      : '完整清单与服务器 Cron 提示仅管理员可见部分项',
  };
}
