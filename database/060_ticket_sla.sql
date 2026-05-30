-- 工单 SLA：截止时间、首次响应、升级标记
SET NAMES utf8mb4;

ALTER TABLE `service_tickets`
  ADD COLUMN `due_at` DATETIME NULL DEFAULT NULL COMMENT 'SLA 截止时间' AFTER `resolved_at`,
  ADD COLUMN `first_response_at` DATETIME NULL DEFAULT NULL COMMENT '首次响应时间' AFTER `due_at`,
  ADD COLUMN `sla_escalated_at` DATETIME NULL DEFAULT NULL COMMENT '已升级通知管理员时间' AFTER `first_response_at`;

ALTER TABLE `service_tickets`
  ADD KEY `idx_st_due` (`tenant_id`, `status`, `due_at`);
