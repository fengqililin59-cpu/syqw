/**
 * @file 租户上线检查清单（管理员仪表盘）。
 */
import { Op } from 'sequelize';
import { Tenant, Flow, AutomationRule, Customer, User } from '../models/index.js';
import { WELCOME_FLOW_NAME } from './flowTemplates.service.js';
import { isAdmin } from '../utils/permissions.js';
import { env } from '../config/env.js';

/**
 * @param {{ tenantId: number; userId: number }} auth
 */
export async function getOnboardingChecklist(auth) {
  const tenantId = auth.tenantId;
  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['id', 'wework_corp_id', 'wework_secret', 'wework_agent_id', 'name'],
  });

  const [staffWithWework, customerCount, welcomeFlow, ruleCount, activeFlows] = await Promise.all([
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
  ];

  const cronHints = [];
  if (!env.enableFlowEngineCron) cronHints.push('ENABLE_FLOW_ENGINE_CRON=1（延迟节点）');
  if (!env.enableAutomationCron) cronHints.push('ENABLE_AUTOMATION_CRON=1（自动跟进扫描）');
  if (!env.enableInboxSlaCron) cronHints.push('ENABLE_INBOX_SLA_CRON=1（收件箱 SLA）');
  if (!env.enableFollowupDueCron) cronHints.push('ENABLE_FOLLOWUP_DUE_CRON=1（跟进到期提醒）');
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
