#!/usr/bin/env bash
set -euo pipefail
OUT=/tmp/bundle_ai_employee_054_057.sql
cat > "$OUT" << 'SQLEOF'
-- AI 员工 MVP：全渠道收件箱 + 知识库 + AI 回复审核 + 跟进任务
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `omni_channels` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(32) NOT NULL COMMENT 'wework / douyin / xiaohongshu / wechat_mp',
  `name` VARCHAR(64) NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1=启用 0=停用',
  `config_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_omni_tenant_code` (`tenant_id`, `code`),
  CONSTRAINT `fk_omni_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inbox_threads` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `channel_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `external_thread_key` VARCHAR(128) NOT NULL COMMENT '渠道侧会话唯一键',
  `assignee_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '负责员工 users.id',
  `sales_stage` VARCHAR(32) NOT NULL DEFAULT 'new' COMMENT 'new/qualify/proposal/quote/followup/deal/after_sale',
  `status` VARCHAR(24) NOT NULL DEFAULT 'open' COMMENT 'open/pending_human/closed',
  `lead_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `last_message_at` DATETIME NULL DEFAULT NULL,
  `last_customer_message_at` DATETIME NULL DEFAULT NULL,
  `metadata_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inbox_thread` (`tenant_id`, `channel_id`, `external_thread_key`),
  KEY `idx_inbox_thread_tenant_time` (`tenant_id`, `last_message_at`),
  KEY `idx_inbox_thread_assignee` (`tenant_id`, `assignee_id`, `status`),
  CONSTRAINT `fk_inbox_thread_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inbox_thread_channel` FOREIGN KEY (`channel_id`) REFERENCES `omni_channels` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inbox_thread_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inbox_thread_assignee` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inbox_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `thread_id` BIGINT UNSIGNED NOT NULL,
  `channel_message_id` VARCHAR(96) NOT NULL COMMENT '渠道消息 ID，企微为 msg_id',
  `direction` VARCHAR(16) NOT NULL COMMENT 'customer/staff/ai/system',
  `sender_role` VARCHAR(16) NOT NULL DEFAULT 'customer',
  `content` TEXT NULL,
  `msg_type` VARCHAR(32) NOT NULL DEFAULT 'text',
  `risk_level` VARCHAR(8) NOT NULL DEFAULT 'p0' COMMENT 'p0自动/p1审核/p2人工',
  `raw_payload` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inbox_msg` (`tenant_id`, `channel_message_id`),
  KEY `idx_inbox_msg_thread` (`thread_id`, `created_at`),
  CONSTRAINT `fk_inbox_msg_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inbox_msg_thread` FOREIGN KEY (`thread_id`) REFERENCES `inbox_threads` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `kb_documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `category` VARCHAR(64) NULL DEFAULT NULL,
  `content_text` MEDIUMTEXT NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'active' COMMENT 'active/archived',
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_kb_doc_tenant` (`tenant_id`, `status`),
  CONSTRAINT `fk_kb_doc_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `kb_chunks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `document_id` BIGINT UNSIGNED NOT NULL,
  `chunk_index` INT UNSIGNED NOT NULL DEFAULT 0,
  `content` TEXT NOT NULL,
  `embedding_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_kb_chunk_doc` (`document_id`, `chunk_index`),
  CONSTRAINT `fk_kb_chunk_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kb_chunk_doc` FOREIGN KEY (`document_id`) REFERENCES `kb_documents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_reply_tenant_status` (`tenant_id`, `status`, `created_at`),
  KEY `idx_ai_reply_thread` (`thread_id`, `created_at`),
  CONSTRAINT `fk_ai_reply_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ai_reply_thread` FOREIGN KEY (`thread_id`) REFERENCES `inbox_threads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ai_reply_trigger` FOREIGN KEY (`trigger_message_id`) REFERENCES `inbox_messages` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ai_reply_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inbox_followup_tasks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `thread_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `title` VARCHAR(200) NOT NULL,
  `due_at` DATETIME NULL DEFAULT NULL,
  `owner_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'open' COMMENT 'open/done/cancelled',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_followup_owner_due` (`tenant_id`, `owner_id`, `due_at`),
  CONSTRAINT `fk_followup_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_followup_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_followup_thread` FOREIGN KEY (`thread_id`) REFERENCES `inbox_threads` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_followup_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- 收件箱 / AI 审核权限点（幂等）
SET NAMES utf8mb4;

INSERT IGNORE INTO `permissions` (`code`, `name`, `module`, `sort_order`) VALUES
('inbox:view',   '查看统一收件箱', 'inbox', 10),
('inbox:reply',  '回复收件箱消息', 'inbox', 20),
('inbox:manage', '管理收件箱与知识库', 'inbox', 30),
('ai:approve',   '审核 AI 回复',     'ai',    20);
-- 成交订单 + 售后/服务工单（AI 员工闭环）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `customer_orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `order_no` VARCHAR(64) NULL DEFAULT NULL COMMENT '外部订单号',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'CNY',
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending' COMMENT 'pending/paid/shipped/completed/cancelled/refunded',
  `paid_at` DATETIME NULL DEFAULT NULL,
  `remark` VARCHAR(500) NULL DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_co_tenant_customer` (`tenant_id`, `customer_id`),
  KEY `idx_co_status` (`tenant_id`, `status`),
  CONSTRAINT `fk_co_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_co_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_tickets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `order_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `thread_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '来源收件箱会话',
  `type` VARCHAR(32) NOT NULL DEFAULT 'consultation' COMMENT 'consultation/refund/complaint/warranty/exchange',
  `priority` VARCHAR(16) NOT NULL DEFAULT 'normal' COMMENT 'low/normal/high/urgent',
  `status` VARCHAR(24) NOT NULL DEFAULT 'open' COMMENT 'open/in_progress/waiting_customer/resolved/closed',
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `resolution` TEXT NULL,
  `owner_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `resolved_at` DATETIME NULL DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_st_tenant_status` (`tenant_id`, `status`, `priority`),
  KEY `idx_st_customer` (`tenant_id`, `customer_id`),
  KEY `idx_st_owner` (`tenant_id`, `owner_id`),
  CONSTRAINT `fk_st_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_st_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_st_order` FOREIGN KEY (`order_id`) REFERENCES `customer_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_st_thread` FOREIGN KEY (`thread_id`) REFERENCES `inbox_threads` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_st_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SET NAMES utf8mb4;

INSERT IGNORE INTO `permissions` (`code`, `name`, `module`, `sort_order`) VALUES
('ticket:view',   '查看工单', 'ticket', 10),
('ticket:manage', '管理工单', 'ticket', 20),
('order:view',    '查看订单', 'order',  10),
('order:manage',  '管理订单', 'order',  20);
SQLEOF
echo "OK: $(wc -c < "$OUT") bytes -> $OUT"
