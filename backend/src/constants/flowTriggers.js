/**
 * @file 流程触发器字典（前后端统一来源）。
 */
export const FLOW_TRIGGER_TYPES = {
  NEW_CUSTOMER: 'new_customer',
  STAGE_CHANGED: 'stage_changed',
};

export const FLOW_TRIGGER_OPTIONS = [
  {
    value: FLOW_TRIGGER_TYPES.NEW_CUSTOMER,
    label: '新客户入库',
    description: '当客户被创建后自动触发流程',
  },
  {
    value: FLOW_TRIGGER_TYPES.STAGE_CHANGED,
    label: '客户阶段变更',
    description: 'CRM 销售阶段变化时触发；可在触发器配置 to_stage 限定目标阶段',
  },
];

export const FLOW_TRIGGER_SET = new Set(FLOW_TRIGGER_OPTIONS.map((x) => x.value));
