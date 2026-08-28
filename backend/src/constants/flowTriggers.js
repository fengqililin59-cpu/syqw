/**
 * @file 流程触发器字典（前后端统一来源）。
 */
export const FLOW_TRIGGER_TYPES = {
  NEW_CUSTOMER: 'new_customer',
  STAGE_CHANGED: 'stage_changed',
  APPOINTMENT_BOOKED: 'appointment_booked',
  APPOINTMENT_ARRIVED: 'appointment_arrived',
  APPOINTMENT_NO_SHOW: 'appointment_no_show',
  SERVICE_COMPLETED: 'service_completed',
  CARD_TIMES_LOW: 'card_times_low',
  CARD_EXPIRING: 'card_expiring',
  CARD_BALANCE_LOW: 'card_balance_low',
  CUSTOMER_SLEEPING: 'customer_sleeping',
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
  {
    value: FLOW_TRIGGER_TYPES.APPOINTMENT_BOOKED,
    label: '预约成功',
    description: '客户预约成功后触发，常用于发送到店提醒与门店位置',
  },
  {
    value: FLOW_TRIGGER_TYPES.APPOINTMENT_ARRIVED,
    label: '客户到店',
    description: '前台标记到店时触发，可用于到店礼、加企微引导',
  },
  {
    value: FLOW_TRIGGER_TYPES.APPOINTMENT_NO_SHOW,
    label: '预约爽约',
    description: '标记爽约时触发，用于二次邀约挽回',
  },
  {
    value: FLOW_TRIGGER_TYPES.SERVICE_COMPLETED,
    label: '服务完成',
    description: '服务完成时触发，常用于效果回访与好评邀请',
  },
  {
    value: FLOW_TRIGGER_TYPES.CARD_TIMES_LOW,
    label: '疗程即将用完',
    description: '次卡剩余次数低于阈值时触发续卡邀约；可在触发器配置 threshold（默认 2 次）',
  },
  {
    value: FLOW_TRIGGER_TYPES.CARD_EXPIRING,
    label: '卡项即将到期',
    description: '卡有效期临近时触发；可在触发器配置 days（默认 30 天）',
  },
  {
    value: FLOW_TRIGGER_TYPES.CARD_BALANCE_LOW,
    label: '储值余额不足',
    description: '储值卡余额低于阈值时触发充值邀约；可在触发器配置 threshold（默认 200 元）',
  },
  {
    value: FLOW_TRIGGER_TYPES.CUSTOMER_SLEEPING,
    label: '客户久未到店',
    description: '距上次到店超过设定天数时触发沉睡唤醒；可在触发器配置 days（默认 60 天）',
  },
];

/** 由每日扫描任务驱动的触发器（非事件即时触发） */
export const SCHEDULED_TRIGGER_TYPES = [
  FLOW_TRIGGER_TYPES.CARD_TIMES_LOW,
  FLOW_TRIGGER_TYPES.CARD_EXPIRING,
  FLOW_TRIGGER_TYPES.CARD_BALANCE_LOW,
  FLOW_TRIGGER_TYPES.CUSTOMER_SLEEPING,
];

export const FLOW_TRIGGER_SET = new Set(FLOW_TRIGGER_OPTIONS.map((x) => x.value));
