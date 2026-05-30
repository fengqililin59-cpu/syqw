-- 供 Docker MySQL 首次初始化（在 MYSQL_DATABASE 对应库中执行，勿含 CREATE DATABASE）
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `customer_tags`;
DROP TABLE IF EXISTS `customer_follow_ups`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `tags`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `tenants`;

CREATE TABLE `tenants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '企业名称',
  `corp_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '企微 CorpID',
  `corp_secret` VARCHAR(255) NULL DEFAULT NULL COMMENT '企微 secret（加密）',
  `wework_corp_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '扫码登录 CorpID',
  `wework_agent_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '扫码登录 AgentId',
  `wework_secret` VARCHAR(255) NULL DEFAULT NULL COMMENT '扫码登录应用 Secret',
  `wework_token` VARCHAR(64) NULL DEFAULT NULL COMMENT '回调 Token',
  `wework_encoding_aes_key` VARCHAR(86) NULL DEFAULT NULL COMMENT '回调 EncodingAESKey',
  `contact_name` VARCHAR(50) NULL DEFAULT NULL,
  `contact_phone` VARCHAR(20) NULL DEFAULT NULL,
  `plan` ENUM('free','basic','pro') NOT NULL DEFAULT 'free',
  `max_users` INT NOT NULL DEFAULT 5,
  `expired_at` DATETIME NULL DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0禁用',
  `allow_auto_send` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否允许流程向客户直发企微消息',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `roles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `permissions` JSON NULL COMMENT '权限码数组',
  `description` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_roles_tenant` (`tenant_id`),
  CONSTRAINT `fk_roles_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `real_name` VARCHAR(50) NULL DEFAULT NULL,
  `phone` VARCHAR(20) NULL DEFAULT NULL,
  `email` VARCHAR(100) NULL DEFAULT NULL,
  `avatar_url` VARCHAR(255) NULL DEFAULT NULL,
  `wework_userid` VARCHAR(64) NULL DEFAULT NULL,
  `wework_corp_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '扫码登录 CorpID',
  `role_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `department` VARCHAR(50) NULL DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1正常 0离职',
  `last_login_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_tenant_username` (`tenant_id`, `username`),
  KEY `idx_users_tenant` (`tenant_id`),
  KEY `fk_users_role` (`role_id`),
  CONSTRAINT `fk_users_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `owner_id` BIGINT UNSIGNED NOT NULL COMMENT '归属员工',
  `external_userid` VARCHAR(64) NULL DEFAULT NULL,
  `name` VARCHAR(50) NULL DEFAULT NULL,
  `nickname` VARCHAR(50) NULL DEFAULT NULL,
  `avatar_url` VARCHAR(255) NULL DEFAULT NULL,
  `gender` TINYINT NULL DEFAULT 0 COMMENT '0未知 1男 2女',
  `phone` VARCHAR(20) NULL DEFAULT NULL,
  `wechat_id` VARCHAR(50) NULL DEFAULT NULL,
  `company` VARCHAR(100) NULL DEFAULT NULL,
  `position` VARCHAR(50) NULL DEFAULT NULL,
  `source` VARCHAR(50) NULL DEFAULT NULL,
  `stage` VARCHAR(32) NOT NULL DEFAULT 'new' COMMENT '销售阶段',
  `intention_level` TINYINT NULL DEFAULT NULL COMMENT '1-5',
  `remark` TEXT NULL,
  `last_contact_at` DATETIME NULL DEFAULT NULL,
  `added_at` DATETIME NULL DEFAULT NULL,
  `automation_paused` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=暂停自动跟进（人工接管）',
  `automation_followup_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '系统触发跟进次数',
  `last_automation_followup_at` DATETIME NULL DEFAULT NULL COMMENT '上次自动跟进时间（冷却）',
  `intent_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '综合意向分 0-100',
  `intent_tier` VARCHAR(20) NULL DEFAULT NULL COMMENT '高意向/中意向/低意向',
  `intent_stage_label` VARCHAR(40) NULL DEFAULT NULL COMMENT 'AI 判断阶段',
  `intent_confidence` VARCHAR(10) NULL DEFAULT NULL COMMENT '高/中/低',
  `intent_rule_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '规则分 0-100',
  `intent_ai_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'AI 分 0-100',
  `last_scored_at` DATETIME NULL DEFAULT NULL,
  `followup_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '意向联动引擎触达次数（上限 3）',
  `last_followup_at` DATETIME NULL DEFAULT NULL COMMENT '上次意向联动提醒时间',
  `priority` VARCHAR(20) NULL DEFAULT NULL COMMENT 'high / medium / low',
  `opt_out_auto_msg` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '退订流程自动直发消息',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL COMMENT '软删除',
  PRIMARY KEY (`id`),
  KEY `idx_customers_tenant` (`tenant_id`),
  KEY `idx_customers_owner` (`owner_id`),
  KEY `idx_customers_stage` (`tenant_id`, `stage`),
  KEY `idx_customers_tenant_intent` (`tenant_id`, `intent_score`),
  KEY `idx_customers_deleted` (`tenant_id`,`deleted_at`),
  CONSTRAINT `fk_customers_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_customers_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tags` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `color` VARCHAR(20) NULL DEFAULT NULL,
  `category` VARCHAR(50) NULL DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tags_tenant` (`tenant_id`),
  CONSTRAINT `fk_tags_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customer_tags` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `tag_id` BIGINT UNSIGNED NOT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_tag` (`customer_id`, `tag_id`),
  KEY `fk_ct_tag` (`tag_id`),
  CONSTRAINT `fk_ct_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ct_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customer_follow_ups` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM('call','wechat','meeting','other') NOT NULL DEFAULT 'other',
  `content` TEXT NOT NULL,
  `next_follow_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fu_customer` (`customer_id`),
  KEY `idx_fu_user` (`user_id`),
  CONSTRAINT `fk_fu_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fu_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS `wework_customer_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '匹配到的 customers.id',
  `msg_id` VARCHAR(64) NOT NULL COMMENT '企微 MsgId 或生成的 evt: 键',
  `external_userid` VARCHAR(64) NULL DEFAULT NULL COMMENT '外部联系人 userid',
  `staff_userid` VARCHAR(64) NULL DEFAULT NULL COMMENT '成员 userid',
  `direction` VARCHAR(16) NOT NULL COMMENT 'customer | staff',
  `msg_type` VARCHAR(32) NOT NULL,
  `content` TEXT NULL COMMENT '文本内容或简述',
  `raw_plain_xml` MEDIUMTEXT NULL COMMENT '解密后的原始 XML',
  `msg_time` DATETIME NOT NULL COMMENT '消息创建时间（企微 CreateTime）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wcm_tenant_msg` (`tenant_id`, `msg_id`),
  KEY `idx_wcm_customer_time` (`tenant_id`, `customer_id`, `msg_time`),
  CONSTRAINT `fk_wcm_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wcm_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='企微会话消息存档';

-- ---------- PRD 骨架（与 database/012_private_domain_pr_scaffold.sql 同步） ----------
CREATE TABLE IF NOT EXISTS `customer_profile_extensions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL COMMENT 'customers.id',
  `industry` VARCHAR(100) NULL DEFAULT NULL COMMENT '行业',
  `company_scale` VARCHAR(50) NULL DEFAULT NULL COMMENT '规模等枚举文案',
  `intent_ai_score` TINYINT UNSIGNED NULL DEFAULT NULL COMMENT 'AI 意向分 1-100，可选',
  `profile_extra` JSON NULL COMMENT '资产区间、偏好等多余字段',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cpe_customer` (`customer_id`),
  KEY `idx_cpe_tenant` (`tenant_id`),
  CONSTRAINT `fk_cpe_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cpe_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户画像扩展';

CREATE TABLE IF NOT EXISTS `script_library_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'general' COMMENT 'opening / quote / follow / close / scene_*',
  `title` VARCHAR(200) NOT NULL,
  `body` TEXT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL COMMENT '软删除',
  PRIMARY KEY (`id`),
  KEY `idx_sli_tenant_cat` (`tenant_id`, `category`),
  KEY `idx_sli_created_by` (`created_by`),
  CONSTRAINT `fk_sli_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sli_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='话术模板库';

CREATE TABLE IF NOT EXISTS `broadcast_tasks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `channel` VARCHAR(32) NOT NULL DEFAULT 'wecom_mass' COMMENT 'wecom_mass / mock / future',
  `content` TEXT NOT NULL COMMENT '文本或结构化 JSON 字符串',
  `msg_type` ENUM('text','image','link','miniprogram') NOT NULL DEFAULT 'text' COMMENT '消息类型',
  `filter_json` JSON NULL COMMENT '标签/阶段/负责人筛选',
  `status` VARCHAR(24) NOT NULL DEFAULT 'draft' COMMENT 'draft / scheduled / sending / done / failed / cancelled',
  `scheduled_at` DATETIME NULL DEFAULT NULL,
  `started_at` DATETIME NULL DEFAULT NULL,
  `finished_at` DATETIME NULL DEFAULT NULL,
  `stats_json` JSON NULL COMMENT '目标/成功/失败数',
  `wecom_msgid` VARCHAR(64) NULL DEFAULT NULL COMMENT '企微首个 msgid',
  `send_fail_detail` JSON NULL COMMENT '批次与失败明细',
  `is_sync_completed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '同步阶段是否已写入',
  `error_message` VARCHAR(500) NULL DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bt_tenant_status` (`tenant_id`, `status`),
  KEY `idx_bt_scheduled` (`tenant_id`, `scheduled_at`),
  KEY `idx_bt_scheduled_status` (`scheduled_at`, `status`),
  CONSTRAINT `fk_bt_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bt_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='群发任务';

CREATE TABLE IF NOT EXISTS `broadcast_task_recipients` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `broadcast_task_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `send_status` VARCHAR(24) NOT NULL DEFAULT 'pending' COMMENT 'pending / sent / failed / skipped',
  `error_message` VARCHAR(255) NULL DEFAULT NULL,
  `sent_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_btr_task_customer` (`broadcast_task_id`, `customer_id`),
  KEY `idx_btr_customer` (`customer_id`),
  CONSTRAINT `fk_btr_task` FOREIGN KEY (`broadcast_task_id`) REFERENCES `broadcast_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_btr_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='群发任务受众明细';

CREATE TABLE IF NOT EXISTS `automation_rules` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `trigger_type` VARCHAR(32) NOT NULL COMMENT 'customer_created / stage_changed / tag_added / no_reply_days / time_cron',
  `trigger_config` JSON NOT NULL,
  `action_type` VARCHAR(32) NOT NULL COMMENT 'notify_owner / create_follow_up / add_tag / webhook',
  `action_config` JSON NOT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ar_tenant_en` (`tenant_id`, `enabled`),
  CONSTRAINT `fk_ar_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ar_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='营销自动化规则';

CREATE TABLE IF NOT EXISTS `automation_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `rule_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `trigger_type` VARCHAR(32) NULL DEFAULT NULL,
  `action_taken` VARCHAR(32) NOT NULL COMMENT 'ai_notify_owner / ai_log / skipped / fail',
  `status` VARCHAR(20) NOT NULL COMMENT 'success / fail / skipped',
  `message_preview` VARCHAR(500) NULL DEFAULT NULL,
  `detail_json` JSON NULL,
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_al_tenant_time` (`tenant_id`, `executed_at`),
  KEY `idx_al_customer_rule` (`tenant_id`, `customer_id`, `rule_id`),
  CONSTRAINT `fk_al_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_al_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_al_rule` FOREIGN KEY (`rule_id`) REFERENCES `automation_rules` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='自动化执行日志';

CREATE TABLE IF NOT EXISTS `publish_tasks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `target_platform` VARCHAR(32) NOT NULL COMMENT 'douyin / xiaohongshu / shipinhao / zhihu / other',
  `content_type` VARCHAR(20) NOT NULL DEFAULT 'video' COMMENT 'video / image / article',
  `title` VARCHAR(200) NULL DEFAULT NULL,
  `description` TEXT NULL,
  `topics` JSON NULL,
  `media_urls` JSON NULL COMMENT '视频/图片 CDN 地址列表',
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending' COMMENT 'pending / processing / success / failed / cancelled / retry',
  `scheduled_at` DATETIME NULL DEFAULT NULL,
  `started_at` DATETIME NULL DEFAULT NULL,
  `finished_at` DATETIME NULL DEFAULT NULL,
  `attempts` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `max_attempts` SMALLINT UNSIGNED NOT NULL DEFAULT 3,
  `result_json` JSON NULL COMMENT '平台返回链接、post_id 等',
  `error_message` TEXT NULL,
  `worker_hint` VARCHAR(64) NULL DEFAULT NULL COMMENT '队列分区或 worker 类型',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pt_tenant_status_sched` (`tenant_id`, `status`, `scheduled_at`),
  KEY `idx_pt_platform` (`tenant_id`, `target_platform`),
  CONSTRAINT `fk_pt_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pt_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='多平台发布任务（RPA/API）';

CREATE TABLE IF NOT EXISTS `operation_audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `actor_user_id` BIGINT UNSIGNED NOT NULL,
  `action` VARCHAR(64) NOT NULL COMMENT 'customer.transfer / customer.update / broadcast.create',
  `target_type` VARCHAR(32) NULL DEFAULT NULL COMMENT 'customer / user / broadcast_task / publish_task',
  `target_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `payload_json` JSON NULL,
  `ip` VARCHAR(45) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_oal_tenant_time` (`tenant_id`, `created_at`),
  KEY `idx_oal_actor` (`tenant_id`, `actor_user_id`),
  KEY `idx_oal_target` (`tenant_id`, `target_type`, `target_id`),
  CONSTRAINT `fk_oal_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_oal_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作审计日志';

CREATE TABLE IF NOT EXISTS `ai_generation_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `kind` VARCHAR(32) NOT NULL DEFAULT 'reply_suggestions',
  `input_message` TEXT NOT NULL,
  `output_json` JSON NOT NULL,
  `model` VARCHAR(64) NULL DEFAULT NULL,
  `meta_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_aigl_tenant_time` (`tenant_id`, `created_at`),
  KEY `idx_aigl_customer` (`tenant_id`, `customer_id`),
  CONSTRAINT `fk_aigl_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aigl_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aigl_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 生成记录';

CREATE TABLE IF NOT EXISTS `flows` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT 'draft / active / paused',
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_flows_tenant_status` (`tenant_id`, `status`),
  CONSTRAINT `fk_flows_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_flows_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='自动化流程';

CREATE TABLE IF NOT EXISTS `flow_nodes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `flow_id` BIGINT UNSIGNED NOT NULL,
  `node_key` VARCHAR(64) NOT NULL,
  `type` VARCHAR(32) NOT NULL,
  `config` JSON NOT NULL,
  `position_x` INT NOT NULL DEFAULT 0,
  `position_y` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fn_flow_nodekey` (`flow_id`, `node_key`),
  KEY `idx_fn_flow` (`flow_id`),
  CONSTRAINT `fk_fn_flow` FOREIGN KEY (`flow_id`) REFERENCES `flows` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流程节点';

CREATE TABLE IF NOT EXISTS `flow_edges` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `flow_id` BIGINT UNSIGNED NOT NULL,
  `source_key` VARCHAR(64) NOT NULL,
  `target_key` VARCHAR(64) NOT NULL,
  `branch` VARCHAR(20) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fe_flow_src` (`flow_id`, `source_key`),
  CONSTRAINT `fk_fe_flow` FOREIGN KEY (`flow_id`) REFERENCES `flows` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流程连线';

CREATE TABLE IF NOT EXISTS `flow_runs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `flow_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'running',
  `current_node_key` VARCHAR(64) NULL DEFAULT NULL,
  `context_json` JSON NULL,
  `next_run_at` DATETIME NULL DEFAULT NULL,
  `error_message` VARCHAR(500) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fr_tenant_wait` (`tenant_id`, `status`, `next_run_at`),
  KEY `idx_fr_customer` (`tenant_id`, `customer_id`),
  CONSTRAINT `fk_fr_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fr_flow` FOREIGN KEY (`flow_id`) REFERENCES `flows` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fr_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流程运行实例';

CREATE TABLE IF NOT EXISTS `auto_message_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `flow_run_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `node_key` VARCHAR(64) NULL DEFAULT NULL,
  `content` TEXT NOT NULL,
  `wework_errcode` INT NULL DEFAULT NULL,
  `wework_errmsg` VARCHAR(500) NULL DEFAULT NULL,
  `skipped_reason` VARCHAR(64) NULL DEFAULT NULL,
  `via` VARCHAR(32) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_aml_tenant_created` (`tenant_id`, `created_at`),
  KEY `idx_aml_customer` (`customer_id`),
  CONSTRAINT `fk_aml_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aml_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aml_flow_run` FOREIGN KEY (`flow_run_id`) REFERENCES `flow_runs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流程直发客户消息审计';

-- ---------- 裂变活动（与 010_phase3 / 023_ensure 一致）----------
CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `type` VARCHAR(32) NOT NULL DEFAULT 'task_treasure' COMMENT 'task_treasure / group_share / red_packet',
  `target_count` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '目标邀请人数',
  `reward_type` VARCHAR(32) NOT NULL COMMENT 'points / coupon / redpacket / exchange_code',
  `reward_value` TEXT NOT NULL COMMENT 'JSON 或文本：奖品说明与配置',
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'draft' COMMENT 'draft / active / paused / ended',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_campaigns_tenant` (`tenant_id`,`status`),
  KEY `idx_campaigns_time` (`tenant_id`,`start_time`,`end_time`),
  CONSTRAINT `fk_campaigns_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `campaign_enrollments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `campaign_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `invite_code` VARCHAR(32) NOT NULL,
  `invited_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_achieved` TINYINT(1) NOT NULL DEFAULT 0,
  `reward_sent_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_enroll_code` (`invite_code`),
  UNIQUE KEY `uk_campaign_customer` (`campaign_id`,`customer_id`),
  KEY `idx_enroll_campaign` (`campaign_id`),
  KEY `idx_enroll_customer` (`customer_id`),
  CONSTRAINT `fk_enroll_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enroll_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invite_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `campaign_id` BIGINT UNSIGNED NOT NULL,
  `inviter_id` BIGINT UNSIGNED NOT NULL,
  `invitee_id` BIGINT UNSIGNED NOT NULL,
  `invitee_external_userid` VARCHAR(64) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invite_pair` (`campaign_id`,`invitee_id`),
  KEY `idx_inv_campaign` (`campaign_id`),
  KEY `idx_inv_inviter` (`inviter_id`),
  CONSTRAINT `fk_inv_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_inviter` FOREIGN KEY (`inviter_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_invitee` FOREIGN KEY (`invitee_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `registration_otp_challenges` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `channel` ENUM('email','sms') NOT NULL,
  `target` VARCHAR(191) NOT NULL COMMENT '规范化后的邮箱或手机号',
  `code_hash` CHAR(64) NOT NULL COMMENT 'sha256(hex) 验证码+盐',
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_lookup` (`channel`, `target`(64), `consumed_at`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `page_visits` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `user_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `session_id` VARCHAR(64) NOT NULL,
  `utm_source` VARCHAR(100) NULL DEFAULT NULL,
  `utm_medium` VARCHAR(100) NULL DEFAULT NULL,
  `utm_campaign` VARCHAR(100) NULL DEFAULT NULL,
  `utm_content` VARCHAR(100) NULL DEFAULT NULL,
  `utm_term` VARCHAR(100) NULL DEFAULT NULL,
  `referrer` VARCHAR(500) NULL DEFAULT NULL,
  `landing_path` VARCHAR(255) NULL DEFAULT NULL,
  `ip` VARCHAR(45) NULL DEFAULT NULL,
  `user_agent` VARCHAR(512) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `attributed_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_page_visit_session` (`session_id`),
  KEY `idx_page_visits_source_time` (`utm_source`, `created_at`),
  KEY `idx_page_visits_tenant_time` (`tenant_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
