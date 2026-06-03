/**
 * @file 仪表盘配置服务
 *
 * Widget 注册表 + 行业模板 + CRUD。
 * 每个 Widget 通过唯一 key 映射到前端组件。
 * 默认全部可见，租户可隐藏/排序。
 */

// ── Widget 注册表（key → 前端渲染元数据）──
const WIDGET_REGISTRY = [
  { key: 'ai_feature_banner',     label: 'AI 功能横幅',       desc: '展示最新 AI 功能介绍入口' },
  { key: 'churn_risk_banner',     label: '流失风险预警',       desc: '高流失风险客户预警横幅' },
  { key: 'smart_alert_card',      label: 'AI 智能跟进提醒',    desc: '自动识别待跟进客户并生成建议' },
  { key: 'inbox_sla_card',        label: '收件箱 SLA',        desc: '企微消息超时未回复提醒' },
  { key: 'ai_auto_reply',         label: 'AI 自动回复统计',     desc: 'AI 自动回复昨日运营数据' },
  { key: 'ai_employee',           label: 'AI 员工看板',        desc: 'AI 员工任务与执行状态' },
  { key: 'ai_onboarding',         label: 'AI 入门指引',        desc: '新用户 AI 功能开通引导' },
  { key: 'ai_quota',              label: 'AI 用量配额',        desc: '当前 AI 调用额度使用情况' },
  { key: 'today_actions',         label: '今日待办',          desc: '今日需跟进的客户和任务' },
  { key: 'onboarding_checklist',  label: '上线检查清单',       desc: '管理员系统初始化步骤' },
  { key: 'deal_celebrate',        label: '本周成交庆祝',       desc: '成交捷报展示' },
  { key: 'weekly_wins',           label: '本周战果',          desc: '本周数据汇总与团队分享' },
  { key: 'roi_card',              label: 'AI ROI 分析',       desc: 'AI 投入产出比统计' },
  { key: 'kpi_cards',             label: 'KPI 核心指标',      desc: '总客户/高意向/成交/待跟进' },
  { key: 'sales_steps',           label: '销售每日三步',       desc: '非管理员销售每日操作指引' },
  { key: 'funnel_chart',          label: '获客成交漏斗',       desc: '加好友→入库→推进→成交' },
  { key: 'revenue_chart',         label: '成交与 Pipeline 金额', desc: '累计收入与管道金额' },
  { key: 'trend_chart',           label: '近 7 日趋势图',      desc: '新增客户与成交趋势面积图' },
  { key: 'stage_pie',             label: '客户阶段分布',       desc: '各阶段客户饼图' },
];

// ── Widget key → 序号映射（供排序用）──
const KEY_ORDER = Object.fromEntries(WIDGET_REGISTRY.map((w, i) => [w.key, i]));

// ── 行业模板：key → 可见 widget 列表 ──
const INDUSTRY_TEMPLATES = {
  education: {
    label: '教培行业',
    desc: '聚焦试听转化，隐藏 SLA 和企微相关模块',
    widgets: WIDGET_REGISTRY.filter((w) =>
      !['inbox_sla_card', 'ai_auto_reply', 'ai_employee', 'ai_quota', 'revenue_chart'].includes(w.key),
    ),
  },
  beauty: {
    label: '医美行业',
    desc: '聚焦到店转化与术后回访，强调成交庆祝',
    widgets: WIDGET_REGISTRY.filter((w) =>
      !['inbox_sla_card', 'ai_auto_reply', 'ai_employee', 'funnel_chart'].includes(w.key),
    ),
  },
  b2b: {
    label: 'B2B 行业',
    desc: '聚焦漏斗和收入，展示全部数据模块',
    widgets: WIDGET_REGISTRY.filter((w) =>
      !['ai_onboarding', 'sales_steps'].includes(w.key),
    ),
  },
  realestate: {
    label: '房产行业',
    desc: '聚焦 KPI 和周报，简化 AI 模块',
    widgets: WIDGET_REGISTRY.filter((w) =>
      !['ai_auto_reply', 'ai_employee', 'ai_onboarding', 'ai_quota', 'roi_card', 'inbox_sla_card'].includes(w.key),
    ),
  },
  loan: {
    label: '助贷行业',
    desc: '展示全部模块（功能最全）',
    widgets: [...WIDGET_REGISTRY],
  },
};

/**
 * 获取默认配置（所有 widget 可见，按定义顺序排列）
 */
function getDefaultConfig() {
  // 默认管理员看到的顺序
  const order = [
    'ai_feature_banner', 'churn_risk_banner', 'smart_alert_card', 'inbox_sla_card',
    'ai_auto_reply', 'ai_employee', 'ai_onboarding', 'ai_quota',
    'today_actions', 'onboarding_checklist', 'deal_celebrate', 'weekly_wins',
    'roi_card', 'kpi_cards', 'sales_steps', 'funnel_chart', 'revenue_chart',
    'trend_chart', 'stage_pie',
  ];
  return { widgets: order.map((key, i) => ({
    key, label: WIDGET_REGISTRY.find((w) => w.key === key)?.label ?? key,
    visible: true, order: i,
  })) };
}

/**
 * GET /dashboard/widget-config
 * 返回当前租户的 Widget 配置（含默认回退）
 */
export async function getWidgetConfig(tenantId) {
  const { DashboardConfig } = await import('../models/index.js');
  const row = await DashboardConfig.model.findOne({ where: { tenant_id: Number(tenantId) } });
  if (!row) return { widgets: getDefaultConfig().widgets, hasCustom: false };

  const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  // 合并：如果注册表中有新的 widget，自动追加到配置
  const existingKeys = new Set((config.widgets ?? []).map((w) => w.key));
  const mergedWidgets = [...(config.widgets ?? [])];
  let maxOrder = mergedWidgets.reduce((m, w) => Math.max(m, w.order ?? 0), -1);
  for (const w of WIDGET_REGISTRY) {
    if (!existingKeys.has(w.key)) {
      maxOrder++;
      mergedWidgets.push({ key: w.key, label: w.label, visible: true, order: maxOrder });
    }
  }
  return { widgets: mergedWidgets, hasCustom: true };
}

/**
 * PUT /dashboard/widget-config
 * 保存租户 Widget 配置
 */
export async function saveWidgetConfig(tenantId, payload) {
  const { DashboardConfig } = await import('../models/index.js');
  const widgets = payload.widgets ?? [];
  const config = { widgets };

  await DashboardConfig.model.upsert(
    { tenant_id: Number(tenantId), config },
    { conflictFields: ['tenant_id'] },
  );

  return { widgets };
}

/**
 * GET /dashboard/widget-config/templates
 * 返回行业模板列表
 */
export function listTemplates() {
  return Object.fromEntries(
    Object.entries(INDUSTRY_TEMPLATES).map(([key, t]) => [
      key,
      {
        label: t.label,
        desc: t.desc,
        widgetCount: t.widgets.length,
        widgets: t.widgets.map((w, i) => ({ ...w, visible: true, order: i })),
      },
    ]),
  );
}

/**
 * POST /dashboard/widget-config/templates/:key/apply
 * 应用行业模板到当前租户
 */
export async function applyTemplate(tenantId, templateKey) {
  const template = INDUSTRY_TEMPLATES[templateKey];
  if (!template) throw Object.assign(new Error('模板不存在'), { statusCode: 404 });

  const config = {
    widgets: template.widgets.map((w, i) => ({
      key: w.key, label: w.label, visible: true, order: i,
    })),
  };

  const { DashboardConfig } = await import('../models/index.js');
  await DashboardConfig.model.upsert(
    { tenant_id: Number(tenantId), config },
    { conflictFields: ['tenant_id'] },
  );

  return { widgets: config.widgets };
}

export { WIDGET_REGISTRY, INDUSTRY_TEMPLATES, getDefaultConfig };
