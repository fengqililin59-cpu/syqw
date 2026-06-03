-- ===========================================================
-- 088: 智能通知规则 + 浏览器推送订阅
-- notification_rules: 自定义通知规则（触发条件 + 渠道 + 模板）
-- browser_push_subscriptions: 浏览器 Web Push 订阅信息
-- ===========================================================

CREATE TABLE IF NOT EXISTS notification_rules (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id        INT           NOT NULL,
  name             VARCHAR(100)  NOT NULL COMMENT '规则名称',
  description      VARCHAR(500)  COMMENT '规则描述',
  enabled          TINYINT(1)   DEFAULT 1 COMMENT '是否启用',
  trigger_type     VARCHAR(32)   NOT NULL COMMENT '触发类型: schedule/time|event|cron',
  trigger_config   JSON          NOT NULL COMMENT '触发条件配置',
  -- trigger_config 结构:
  --   schedule: { "type": "daily"|"weekly"|"monthly"|"interval",
  --               "time": "09:00", "days_of_week": [1,3,5],
  --               "interval_minutes": 30 }
  --   event:     { "event": "stage_changed"|"customer_created"|"followup_overdue"|"deal_won"|"task_due"|"intent_high"|"customer_inactive",
  --               "filters": { "stage": "negotiation", "days_overdue": 7, "min_score": 80 } }
  --   cron:      { "expression": "0 9 * * 1-5" }
  --
  channels         JSON          NOT NULL COMMENT '通知渠道: ["in_app","wecom","browser"]',
  -- in_app:  写入 notifications 表（站内通知中心）
  -- wecom:   通过企微应用消息发送
  -- browser: 通过 Web Push API 推送浏览器通知
  --
  recipient_type   VARCHAR(32)   NOT NULL DEFAULT 'specific' COMMENT '接收人类型: specific|role|owner|all',
  recipient_config JSON          COMMENT '接收人配置',
  -- specific:  { "user_ids": [1,2,3] }
  -- role:     { "role_id": 5 }
  -- owner:    {} 自动发给客户负责人
  -- all:      {} 发给租户下所有人
  --
  template         JSON          NOT NULL COMMENT '通知模板',
  -- { "title": "客户 {{customer_name}} 超过 {{days}} 天未跟进",
  --   "body":  "该客户当前处于 {{stage}} 阶段，上次跟进时间 {{last_followup}}，请及时跟进。",
  --   "link":  "/app/customers/{{customer_id}}" }
  --
  priority         ENUM('low','normal','high','urgent') DEFAULT 'normal',
  cooldown_minutes INT           DEFAULT 60 COMMENT '冷却时间（分钟），避免重复通知',
  max_per_run      INT           DEFAULT 50 COMMENT '单次评估最大触发数',
  last_triggered_at DATETIME,
  trigger_count    INT           DEFAULT 0 COMMENT '累计触发次数',
  created_by       INT,
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_enabled (enabled),
  INDEX idx_trigger (trigger_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 通知规则执行日志
CREATE TABLE IF NOT EXISTS notification_rule_logs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id        INT           NOT NULL,
  rule_id          INT           NOT NULL,
  triggered_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
  recipients_count INT           DEFAULT 0 COMMENT '实际接收人数',
  channels_used    JSON          COMMENT '实际使用的渠道',
  status           ENUM('success','partial','failed') DEFAULT 'success',
  error_message    TEXT,
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (rule_id)   REFERENCES notification_rules(id) ON DELETE CASCADE,
  INDEX idx_rule (rule_id),
  INDEX idx_tenant_triggered (tenant_id, triggered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 浏览器 Web Push 订阅
CREATE TABLE IF NOT EXISTS browser_push_subscriptions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id        INT           NOT NULL,
  user_id          INT           NOT NULL,
  endpoint         TEXT          NOT NULL COMMENT 'Push 订阅 endpoint URL',
  p256dh           TEXT          NOT NULL COMMENT '加密公钥 p256dh',
  auth             TEXT          NOT NULL COMMENT '加密认证密钥 auth',
  user_agent       VARCHAR(500)  COMMENT '浏览器 UA',
  device_name      VARCHAR(100)  COMMENT '设备名称',
  is_active        TINYINT(1)   DEFAULT 1,
  last_used_at     DATETIME,
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id)   REFERENCES users(id),
  UNIQUE KEY uk_user_endpoint (user_id, endpoint(255)),
  INDEX idx_user (user_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
