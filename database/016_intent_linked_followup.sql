-- 意向分层联动：跟进次数、冷却、优先级标记（与意向评分引擎配合）
-- mysql ... < database/016_intent_linked_followup.sql

SET NAMES utf8mb4;

ALTER TABLE `customers`
  ADD COLUMN `followup_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '意向联动引擎触达次数（上限 3）' AFTER `last_scored_at`,
  ADD COLUMN `last_followup_at` DATETIME NULL DEFAULT NULL COMMENT '上次意向联动提醒时间' AFTER `followup_count`,
  ADD COLUMN `priority` VARCHAR(20) NULL DEFAULT NULL COMMENT 'high / medium / low' AFTER `last_followup_at`;
