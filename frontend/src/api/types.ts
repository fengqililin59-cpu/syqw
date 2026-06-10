/**
 * @file 与后端约定的 TypeScript 类型（统一响应、分页、实体精简字段）。
 */

/** 后端统一 JSON：{ code, message, data } */
export type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

export type Paginated<T> = {
  list: T[]
  total: number
  page: number
  size: number
}

export type Role = {
  id: number
  tenant_id: number
  name: string
  perm_codes: string[] | null
  description?: string | null
}

export type UserRow = {
  id: number
  tenant_id: number
  username: string
  real_name?: string | null
  phone?: string | null
  email?: string | null
  department?: string | null
  /** 企微成员 userid，与扫码登录一致 */
  wework_userid?: string | null
  status: number
  role_id?: number | null
  Role?: Role | null
}

export type TagRow = {
  id: number
  tenant_id: number
  name: string
  color?: string | null
  category?: string | null
  created_by?: number | null
}

export type ScriptLibraryItem = {
  id: number
  tenant_id: number
  category: string
  title: string
  body: string
  sort_order: number
  created_by?: number | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type CustomerDiscoveryProfile = {
  budget?: string | null
  decision_timeline?: string | null
  pain_points?: string | null
  product_interest?: string | null
  decision_maker?: string | null
  next_step?: string | null
}

export type CustomerRow = {
  inbox_threads_synced?: number
  id: number
  tenant_id: number
  owner_id: number
  /** 企微外部联系人 userid，与消息回调匹配 */
  external_userid?: string | null
  name?: string | null
  nickname?: string | null
  phone?: string | null
  wechat_id?: string | null
  company?: string | null
  stage: string
  source?: string | null
  remark?: string | null
  /** 需求探索登记（BANT/SPIN 等） */
  discovery_profile?: CustomerDiscoveryProfile | null
  discovery_completeness_percent?: number
  discovery_fields_filled?: number
  discovery_fields_total?: number
  discovery_ready?: boolean
  discovery_missing_labels?: string[]
  intention_level?: number | null
  /** 综合意向分 0-100（规则 70% + AI 30%） */
  intent_score?: number | null
  /** 已付款/完成订单累计金额 */
  order_paid_total?: number
  /** 有效订单笔数 */
  order_count?: number
  intent_tier?: string | null
  intent_stage_label?: string | null
  intent_confidence?: string | null
  intent_rule_score?: number | null
  intent_ai_score?: number | null
  last_scored_at?: string | null
  /** 意向联动引擎已触达次数（上限 3） */
  followup_count?: number | null
  last_followup_at?: string | null
  /** high / medium / low */
  priority?: string | null
  /** 退订流程/自动化直发企微客户消息 */
  opt_out_auto_msg?: boolean
  last_contact_at?: string | null
  created_at?: string | null
  tags?: TagRow[]
  owner?: { id: number; username: string; real_name?: string | null }
  /** 意向分详情（AI 理由、规则分细节等） */
  intent_score_detail?: {
    rule_score: number
    ai_score: number
    final_score: number
    intent_stage: string
    confidence: string
    reason_snippet: string
    scored_at: string
  } | null
  /** 流失风险预警 */
  churn_risk_alert?: {
    days_since_last_contact: number
    risk_level: 'critical' | 'high' | 'medium'
    message: string
  } | null
  /** 成交率预测 */
  conversion_rate_estimate?: {
    estimated_rate: number
    score_range: string
    samples: number
  } | null
}

/** POST /customers/:id/score-intent */
export type CustomerIntentScoreResult = {
  throttled?: boolean
  intent_score: number
  intent_tier?: string | null
  intent_stage_label?: string | null
  intent_confidence?: string | null
  intent_rule_score?: number
  intent_ai_score?: number
  advice?: string
  ai_reason?: string
  last_scored_at?: string | null
  blend?: { rule_weight: number; ai_weight: number; ai_ok?: boolean }
}

/** GET /customers/:id/messages — 企微回调入库的会话记录 */
export type WeworkChatMessage = {
  id: number
  direction: string
  msg_type: string
  content?: string | null
  staff_userid?: string | null
  external_userid?: string | null
  msg_time: string
  created_at: string
}

export type ImportCustomersResult = {
  imported: number
  skipped: number
  duplicate_skipped?: number
}

export type ImportCustomersPreview = {
  summary: {
    total_rows: number
    valid_rows: number
    to_import: number
    skipped_empty: number
    duplicate_in_file: number
    duplicate_in_db: number
  }
  samples: Array<{
    row_no: number
    name?: string | null
    phone?: string | null
    wechat_id?: string | null
    stage?: string | null
    status: string
    reason?: string | null
  }>
}

export type ExportCustomersResult = {
  filename: string
  file_base64: string
}

export type DashboardOverview = {
  active_users: number
  total_customers: number
  customers_by_stage: Record<string, number>
  follow_ups_last_7d: number
}

export type DayCount = { date: string; count: number }

export type DashboardCharts = {
  days: number
  follow_ups_by_day: DayCount[]
  new_customers_by_day: DayCount[]
}

/** GET /dashboard/stats — 今日、近 7 日趋势、阶段分布、成交率（与租户/销售范围一致） */
export type DashboardStats = {
  today_new_count: number
  total_customers: { value: number; rate: number | null }
  high_intent: { value: number; rate: number | null }
  deals_this_month: { value: number; rate: number | null }
  pending_followup: { value: number; rate: number | null }
  deal_rate_percent: number
  active_users: number
  follow_ups_last_7d: number
  /** 存在「下次跟进」日期不晚于今日（上海）的跟进计划的去重客户数 */
  overdue_follow_up_count?: number
  overdue_ticket_count?: number
  last_7_days_new: number[]
  last_7_days_deal: number[]
  last_7_days_labels: string[]
  stage_distribution: { name: string; value: number }[]
  /** 获客→成交漏斗（近 7 日加好友 / 入库 / 推进中 / 成交） */
  funnel?: {
    key: string
    label: string
    count: number
    conversion_from_prev_percent: number | null
  }[]
  /** 本月 AI 与跟进效率（估算 ROI，仅供参考） */
  roi_summary?: {
    ai_calls_used: number
    ai_calls_limit: number
    ai_usage_percent: number | null
    follow_ups_last_7d: number
    pending_followup: number
    estimated_minutes_saved: number
    plan_name: string | null
    plan_code: string | null
    note: string
  }
  revenue?: {
    paid_total: number
    paid_mtd: number
    order_count: number
    customer_count: number
    pipeline_amount: number
    by_stage: Array<{
      stage: string
      stage_label: string
      amount: number
      customer_count: number
      order_count: number
    }>
  }
}

export type WeworkChannelGroupRow = {
  id: number
  tenant_id: number
  name: string
  sort: number
  created_at?: string
  updated_at?: string
}

export type WeworkChannelRow = {
  id: number
  tenant_id: number
  group_id?: number | null
  name: string
  type: string
  state?: string | null
  wework_config_id?: string | null
  config?: {
    qr_code?: string
    errcode?: number
    user?: string[]
    remark?: string
    [key: string]: unknown
  } | null
  group?: { id: number; name: string }
  created_at?: string
  updated_at?: string
}

export type FollowUpListItem = {
  id: number
  customer_id: number
  user_id: number
  type: string
  content: string
  next_follow_at?: string | null
  created_at: string
  Customer?: { id: number; name?: string | null; phone?: string | null; stage?: string }
  author?: { id: number; username: string; real_name?: string | null }
}

export type OverdueFollowUpItem = {
  follow_up_id: number
  customer_id: number
  next_follow_at: string
  content?: string | null
  follow_created_at?: string
  overdue_days: number
  customer: { id: number; name?: string | null; nickname?: string | null; phone?: string | null; stage?: string | null }
  owner?: { id: number; real_name?: string | null; username?: string | null }
}

export type CampaignRow = {
  id: number
  tenant_id: number
  name: string
  type: string
  target_count: number
  reward_type: string
  reward_value: string | Record<string, unknown>
  start_time: string
  end_time: string
  status: string
  created_at?: string
  updated_at?: string
}

export type InboxThreadRow = {
  id: number
  tenant_id: number
  channel_id: number
  customer_id?: number | null
  external_thread_key: string
  assignee_id?: number | null
  sales_stage: string
  status: string
  lead_score: number
  last_message_at?: string | null
  last_customer_message_at?: string | null
  last_direction?: string | null
  needs_reply?: boolean
  sla_overdue?: boolean
  has_ai_auto_sent?: boolean
  ai_auto_sent_count?: number
  ai_auto_sent_at?: string | null
  is_public_channel?: boolean
  channel_delivery_hint?: string | null
  channel?: { code: string; name: string }
  Customer?: {
    id: number
    name?: string | null
    nickname?: string | null
    phone?: string | null
    stage?: string | null
  }
  crm_stage_label?: string
  inbox_stage_label?: string
  stage_sync?: {
    updated: boolean
    crm_stage?: string
    from_inbox_stage?: string
  }
}

export type InboxMessageRow = {
  id: number
  thread_id: number
  direction: string
  sender_role: string
  content?: string | null
  msg_type: string
  risk_level: string
  created_at: string
  ai_auto?: boolean
  ai_auto_kind?: string | null
  wework_delivered?: boolean
  inbox_only?: boolean
}

export type AiReplyLogRow = {
  id: number
  thread_id: number
  intent?: string | null
  confidence: number
  risk_level: string
  draft_content: string
  final_content?: string | null
  status: string
  approved_by?: number | null
  created_at: string
  updated_at?: string
  InboxThread?: {
    id: number
    customer_id?: number | null
    status: string
    Customer?: { id: number; name?: string | null; nickname?: string | null }
  }
}

export type AiOpsStats = {
  days: number
  sla_minutes?: number
  sla_overdue_threads?: number
  open_service_tickets?: number
  open_threads: number
  pending_human_threads: number
  messages_in_period: number
  customer_messages: number
  staff_or_ai_replies: number
  ai_drafts_created: number
  ai_replies_approved: number
  ai_replies_auto_sent?: number
  threads_with_ai_auto_sent?: number
  auto_send_usage_today?: {
    daily_count: number
    daily_cap: number
    thread_cap: number
    wework_only: boolean
  }
  auto_reply_rate_percent: number
  open_followup_tasks: number
}

export type ServiceTicketRow = {
  id: number
  tenant_id: number
  customer_id: number
  order_id?: number | null
  thread_id?: number | null
  type: string
  priority: string
  status: string
  title: string
  description?: string | null
  resolution?: string | null
  owner_id?: number | null
  resolved_at?: string | null
  due_at?: string | null
  first_response_at?: string | null
  sla_escalated_at?: string | null
  sla_status?: 'none' | 'on_track' | 'due_soon' | 'overdue' | 'escalated' | 'closed'
  sla_minutes_remaining?: number | null
  sla_overdue_minutes?: number | null
  sla_minutes?: number
  created_at?: string
  updated_at?: string
  Customer?: { id: number; name?: string | null; nickname?: string | null; phone?: string | null; stage?: string }
  owner?: { id: number; username: string; real_name?: string | null }
  CustomerOrder?: { id: number; order_no?: string | null; amount: number | string; status: string }
  InboxThread?: { id: number; status: string; sales_stage: string }
}

export type CustomerOrderRow = {
  id: number
  customer_id: number
  order_no?: string | null
  amount: number | string
  currency: string
  status: string
  paid_at?: string | null
  remark?: string | null
  created_at?: string
  updated_at?: string
  Customer?: {
    id: number
    name?: string | null
    nickname?: string | null
    phone?: string | null
    stage?: string | null
  }
}

export type KbDocumentRow = {
  id: number
  title: string
  category?: string | null
  status: string
  content_text?: string
  created_at?: string
  updated_at?: string
}

export type CampaignStats = {
  enrollment_count: number
  achieved_count: number
  total_invite_count: number
  avg_invite_per_participant: number
  recent_invites: {
    id: number
    created_at: string
    invitee_external_userid?: string | null
    inviter?: { id: number; name?: string | null; nickname?: string | null; external_userid?: string | null }
    invitee?: { id: number; name?: string | null; nickname?: string | null; external_userid?: string | null }
  }[]
}
