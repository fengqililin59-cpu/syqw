-- AI 自动发送抽检队列
ALTER TABLE `ai_reply_logs`
  ADD COLUMN `qa_status` VARCHAR(16) NULL DEFAULT NULL
    COMMENT 'pending/passed/failed；NULL=未入抽检'
    AFTER `approved_by`,
  ADD COLUMN `qa_reviewed_at` DATETIME NULL DEFAULT NULL AFTER `qa_status`,
  ADD COLUMN `qa_reviewed_by` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `qa_reviewed_at`,
  ADD COLUMN `qa_note` VARCHAR(500) NULL DEFAULT NULL AFTER `qa_reviewed_by`,
  ADD KEY `idx_ai_reply_qa` (`tenant_id`, `qa_status`, `created_at`);
