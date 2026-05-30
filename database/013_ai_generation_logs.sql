-- AI 生成记录（回复建议、文案等），租户隔离
-- mysql ... < database/013_ai_generation_logs.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_generation_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `kind` VARCHAR(32) NOT NULL DEFAULT 'reply_suggestions' COMMENT 'reply_suggestions / copywriting / other',
  `input_message` TEXT NOT NULL COMMENT '用户输入（客户最新一句话）',
  `output_json` JSON NOT NULL COMMENT '生成结果，如三条话术数组',
  `model` VARCHAR(64) NULL DEFAULT NULL,
  `meta_json` JSON NULL COMMENT '耗时、token等',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_aigl_tenant_time` (`tenant_id`, `created_at`),
  KEY `idx_aigl_customer` (`tenant_id`, `customer_id`),
  CONSTRAINT `fk_aigl_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aigl_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aigl_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 生成审计与复盘';
