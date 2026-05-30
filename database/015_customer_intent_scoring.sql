-- 客户意向评分：规则分 + AI 分融合 + 历史快照（customer_scores）
-- mysql ... < database/015_customer_intent_scoring.sql

SET NAMES utf8mb4;

ALTER TABLE `customers`
  ADD COLUMN `intent_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '综合意向分 0-100' AFTER `last_automation_followup_at`,
  ADD COLUMN `intent_tier` VARCHAR(20) NULL DEFAULT NULL COMMENT '高意向/中意向/低意向' AFTER `intent_score`,
  ADD COLUMN `intent_stage_label` VARCHAR(40) NULL DEFAULT NULL COMMENT 'AI 判断阶段' AFTER `intent_tier`,
  ADD COLUMN `intent_confidence` VARCHAR(10) NULL DEFAULT NULL COMMENT '高/中/低' AFTER `intent_stage_label`,
  ADD COLUMN `intent_rule_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '规则分 0-100' AFTER `intent_confidence`,
  ADD COLUMN `intent_ai_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'AI 分 0-100' AFTER `intent_rule_score`,
  ADD COLUMN `last_scored_at` DATETIME NULL DEFAULT NULL AFTER `intent_ai_score`,
  ADD KEY `idx_customers_tenant_intent` (`tenant_id`, `intent_score`);

CREATE TABLE IF NOT EXISTS `customer_scores` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `rule_score` SMALLINT UNSIGNED NOT NULL,
  `ai_score` SMALLINT UNSIGNED NOT NULL,
  `final_score` SMALLINT UNSIGNED NOT NULL,
  `intent_stage` VARCHAR(64) NULL DEFAULT NULL,
  `confidence` VARCHAR(10) NULL DEFAULT NULL,
  `reason_snippet` VARCHAR(500) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cs_tenant_time` (`tenant_id`, `created_at`),
  KEY `idx_cs_customer` (`tenant_id`, `customer_id`, `created_at`),
  CONSTRAINT `fk_cs_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cs_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='意向评分历史';
