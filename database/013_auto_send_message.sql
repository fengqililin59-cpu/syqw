-- 租户自动直发客户消息开关、客户退订、审计日志
-- 执行：mysql ... < database/013_auto_send_message.sql

ALTER TABLE `tenants`
  ADD COLUMN `allow_auto_send` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否允许流程/自动化向客户直发企微消息' AFTER `status`;

ALTER TABLE `customers`
  ADD COLUMN `opt_out_auto_msg` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '客户退订自动消息（流程直发）' AFTER `priority`;

CREATE TABLE IF NOT EXISTS `auto_message_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `flow_run_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '关联流程实例（若有）',
  `node_key` VARCHAR(64) NULL DEFAULT NULL COMMENT '流程节点 key',
  `content` TEXT NOT NULL COMMENT '待发或已发送文本快照',
  `wework_errcode` INT NULL DEFAULT NULL,
  `wework_errmsg` VARCHAR(500) NULL DEFAULT NULL,
  `skipped_reason` VARCHAR(64) NULL DEFAULT NULL COMMENT 'tenant_disabled | opt_out | no_external_id | no_sender | rate_limit',
  `via` VARCHAR(32) NULL DEFAULT NULL COMMENT 'message_send | add_msg_template',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_aml_tenant_created` (`tenant_id`, `created_at`),
  KEY `idx_aml_customer` (`customer_id`),
  CONSTRAINT `fk_aml_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aml_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aml_flow_run` FOREIGN KEY (`flow_run_id`) REFERENCES `flow_runs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流程直发客户消息审计';
