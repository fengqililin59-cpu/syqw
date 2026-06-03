-- Fix: ai_reply_logs 表未创建（迁移 054 中的表因依赖问题未执行）
-- 独立的创建语句，不依赖外键（inbox_threads 和 inbox_messages 已存在后再补外键）

CREATE TABLE IF NOT EXISTS `ai_reply_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `thread_id` BIGINT UNSIGNED NOT NULL,
  `trigger_message_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `intent` VARCHAR(64) NULL DEFAULT NULL,
  `confidence` DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  `risk_level` VARCHAR(8) NOT NULL DEFAULT 'p1',
  `draft_content` TEXT NOT NULL,
  `final_content` TEXT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'draft' COMMENT 'draft/approved/rejected/auto_sent',
  `model` VARCHAR(64) NULL DEFAULT NULL,
  `approved_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `qa_status` VARCHAR(16) NULL DEFAULT NULL COMMENT 'pending/passed/failed',
  `qa_reviewed_at` DATETIME NULL DEFAULT NULL,
  `qa_reviewed_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `qa_note` VARCHAR(500) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_reply_tenant_status` (`tenant_id`, `status`, `created_at`),
  KEY `idx_ai_reply_thread` (`thread_id`, `created_at`),
  KEY `idx_ai_reply_qa` (`tenant_id`, `qa_status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
