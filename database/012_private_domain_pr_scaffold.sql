-- PRD 骨架：私域成交 / 获客转化 / AI 话术 / 群发 / SOP 规则 / 外发任务
-- 在已有库上增量执行：mysql ... < database/012_private_domain_pr_scaffold.sql
-- MySQL 8.0+ utf8mb4

SET NAMES utf8mb4;

-- ---------- 1. 客户画像扩展（与 customers 一对一，避免狂加列撑爆主表） ----------
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

-- ---------- 2. 话术库（AI 营销中心 / 成交话术库） ----------
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

-- ---------- 3. 群发任务（批量触达；执行层对接企微群发 API 或人工） ----------
CREATE TABLE IF NOT EXISTS `broadcast_tasks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `channel` VARCHAR(32) NOT NULL DEFAULT 'wecom_mass' COMMENT 'wecom_mass / mock / future',
  `content` TEXT NOT NULL COMMENT '文本或结构化 JSON 字符串',
  `filter_json` JSON NULL COMMENT '{"tag_ids":[],"stages":[],"owner_id":null}',
  `status` VARCHAR(24) NOT NULL DEFAULT 'draft' COMMENT 'draft / scheduled / sending / done / failed / cancelled',
  `scheduled_at` DATETIME NULL DEFAULT NULL,
  `started_at` DATETIME NULL DEFAULT NULL,
  `finished_at` DATETIME NULL DEFAULT NULL,
  `stats_json` JSON NULL COMMENT '{"target":0,"sent":0,"fail":0}',
  `error_message` VARCHAR(500) NULL DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bt_tenant_status` (`tenant_id`, `status`),
  KEY `idx_bt_scheduled` (`tenant_id`, `scheduled_at`),
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

-- ---------- 4. 自动化 / SOP 规则（触发器 + 动作 JSON，后续由 Worker 消费） ----------
CREATE TABLE IF NOT EXISTS `automation_rules` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `trigger_type` VARCHAR(32) NOT NULL COMMENT 'customer_created / stage_changed / tag_added / no_reply_days / time_cron',
  `trigger_config` JSON NOT NULL COMMENT '各触发类型的参数，如 {"days":3} / {"tag_id":1}',
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

-- ---------- 5. 外发 / RPA 任务（对接 Python Worker，勿阻塞 Node 主进程） ----------
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

-- ---------- 6. 关键业务操作审计（分配客户、改阶段、导出等，满足风控叙述） ----------
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
