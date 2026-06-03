-- 收件箱 AI 自动发送后，企微提醒会话负责人/客户归属销售
ALTER TABLE `tenants`
  ADD COLUMN `inbox_ai_notify_assignee_on_auto_send` TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'AI自动回复后企微提醒负责人'
    AFTER `inbox_ai_auto_send_pricing`;
