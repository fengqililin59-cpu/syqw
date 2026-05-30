-- 群发任务：消息类型、企微 msgid、失败明细、同步标记与定时索引
-- mysql ... < database/018_broadcast_add_wecom_fields.sql

ALTER TABLE `broadcast_tasks`
  ADD COLUMN `msg_type` ENUM('text','image','link','miniprogram') NOT NULL DEFAULT 'text' COMMENT '消息类型' AFTER `content`,
  ADD COLUMN `wecom_msgid` VARCHAR(64) NULL DEFAULT NULL COMMENT '企微返回的首个 msgid（多负责人批次时取首个）' AFTER `stats_json`,
  ADD COLUMN `send_fail_detail` JSON NULL COMMENT '批次与失败 external_userid 明细' AFTER `wecom_msgid`,
  ADD COLUMN `is_sync_completed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已落库最终结果（同步调用完成即为 1）' AFTER `send_fail_detail`,
  ADD INDEX `idx_bt_scheduled_status` (`scheduled_at`, `status`);
