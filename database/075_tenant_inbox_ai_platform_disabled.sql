-- 平台方一键关停租户收件箱 AI 自动发送
ALTER TABLE `tenants`
  ADD COLUMN `inbox_ai_platform_disabled` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '平台强制关闭收件箱AI自动发送'
    AFTER `inbox_ai_notify_assignee_on_auto_send`;
