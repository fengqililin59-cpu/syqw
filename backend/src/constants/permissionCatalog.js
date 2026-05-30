/**
 * @file 权限点字典（系统预定义）。
 */
export const PERMISSION_CATALOG = [
  { code: 'customer:view', name: '查看客户', module: 'customer' },
  { code: 'customer:edit', name: '编辑客户', module: 'customer' },
  { code: 'customer:delete', name: '删除客户', module: 'customer' },
  { code: 'customer:export', name: '导出客户', module: 'customer' },
  { code: 'customer:import', name: '导入客户', module: 'customer' },
  { code: 'broadcast:view', name: '查看群发任务', module: 'broadcast' },
  { code: 'broadcast:send', name: '发送群发任务', module: 'broadcast' },
  { code: 'campaign:view', name: '查看裂变活动', module: 'campaign' },
  { code: 'campaign:manage', name: '管理裂变活动', module: 'campaign' },
  { code: 'automation:view', name: '查看自动化', module: 'automation' },
  { code: 'automation:manage', name: '管理自动化', module: 'automation' },
  { code: 'ai:use', name: '使用 AI 能力', module: 'ai' },
  { code: 'ai:approve', name: '审核 AI 回复', module: 'ai' },
  { code: 'inbox:view', name: '查看统一收件箱', module: 'inbox' },
  { code: 'inbox:reply', name: '回复收件箱消息', module: 'inbox' },
  { code: 'inbox:manage', name: '管理收件箱与知识库', module: 'inbox' },
  { code: 'ticket:view', name: '查看服务工单', module: 'ticket' },
  { code: 'ticket:manage', name: '管理服务工单', module: 'ticket' },
  { code: 'order:view', name: '查看客户订单', module: 'order' },
  { code: 'order:manage', name: '管理客户订单', module: 'order' },
  { code: 'channel:view', name: '查看渠道追踪', module: 'channel' },
  { code: 'channel:manage', name: '管理渠道活码', module: 'channel' },
  { code: 'dashboard:view', name: '查看仪表盘', module: 'dashboard' },
  { code: 'ads:view', name: '查看广告 ROI', module: 'ads' },
  { code: 'settings:manage', name: '管理系统设置', module: 'settings' },
  { code: 'audit:view', name: '查看审计日志', module: 'settings' },
  { code: 'user:manage', name: '管理员工账号', module: 'settings' },
];

export const ALL_PERMISSION_CODES = PERMISSION_CATALOG.map((x) => x.code);

/** 兼容旧权限命名 */
export const LEGACY_PERMISSION_ALIAS = {
  'dashboard:read': 'dashboard:view',
  'customer:read': 'customer:view',
  'customer:write': 'customer:edit',
};
