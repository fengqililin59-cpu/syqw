-- 将「早期 customers 表」补齐到与 Sequelize Customer 模型一致。
-- 若某列已存在会报 Duplicate column，可忽略该行后继续执行后续语句。
SET NAMES utf8mb4;

ALTER TABLE `customers` ADD COLUMN `automation_paused` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=暂停自动跟进' AFTER `added_at`;
ALTER TABLE `customers` ADD COLUMN `automation_followup_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `automation_paused`;
ALTER TABLE `customers` ADD COLUMN `last_automation_followup_at` DATETIME NULL DEFAULT NULL AFTER `automation_followup_count`;

ALTER TABLE `customers` ADD COLUMN `intent_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `last_automation_followup_at`;
ALTER TABLE `customers` ADD COLUMN `intent_tier` VARCHAR(20) NULL DEFAULT NULL AFTER `intent_score`;
ALTER TABLE `customers` ADD COLUMN `intent_stage_label` VARCHAR(40) NULL DEFAULT NULL AFTER `intent_tier`;
ALTER TABLE `customers` ADD COLUMN `intent_confidence` VARCHAR(10) NULL DEFAULT NULL AFTER `intent_stage_label`;
ALTER TABLE `customers` ADD COLUMN `intent_rule_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `intent_confidence`;
ALTER TABLE `customers` ADD COLUMN `intent_ai_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `intent_rule_score`;
ALTER TABLE `customers` ADD COLUMN `last_scored_at` DATETIME NULL DEFAULT NULL AFTER `intent_ai_score`;

ALTER TABLE `customers` ADD COLUMN `followup_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `last_scored_at`;
ALTER TABLE `customers` ADD COLUMN `last_followup_at` DATETIME NULL DEFAULT NULL AFTER `followup_count`;
ALTER TABLE `customers` ADD COLUMN `priority` VARCHAR(20) NULL DEFAULT NULL AFTER `last_followup_at`;
ALTER TABLE `customers` ADD COLUMN `opt_out_auto_msg` TINYINT(1) NOT NULL DEFAULT 0 AFTER `priority`;
