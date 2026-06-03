-- ============================================================
-- ECS 生产环境数据库迁移 (078-096) 无外键版本
-- 用法: mysql -h127.0.0.1 -u<user> -p<password> <db> < deploy/ecs_migrate_078_096.sql
-- ============================================================
SET NAMES utf8mb4;

-- ============================================================
-- 078: 租户可配置销售管道
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_pipeline_configs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  stages          JSON            NOT NULL COMMENT '管道阶段数组',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenant (tenant_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 079: 可配置仪表盘
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_dashboard_configs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id  BIGINT UNSIGNED NOT NULL,
  config     JSON            NOT NULL COMMENT 'widget 配置数组',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 080: 租户级收件箱 AI 自动草稿开关 (ALTER TABLE, 幂等)
-- ============================================================
DROP PROCEDURE IF EXISTS add_col_080;
DELIMITER //
CREATE PROCEDURE add_col_080()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'inbox_auto_draft_enabled') THEN
    ALTER TABLE tenants ADD COLUMN inbox_auto_draft_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '租户级收件箱自动草稿开关';
  END IF;
END //
DELIMITER ;
CALL add_col_080();
DROP PROCEDURE IF EXISTS add_col_080;

-- 补索引（幂等）
DROP PROCEDURE IF EXISTS add_idx_080;
DELIMITER //
CREATE PROCEDURE add_idx_080()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND INDEX_NAME = 'idx_inbox_auto_draft') THEN
    ALTER TABLE tenants ADD INDEX idx_inbox_auto_draft (inbox_auto_draft_enabled);
  END IF;
END //
DELIMITER ;
CALL add_idx_080();
DROP PROCEDURE IF EXISTS add_idx_080;

-- ============================================================
-- 081: ai_reply_logs 建表（幂等）
-- ============================================================
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

-- ============================================================
-- 082: KPI 目标配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS `kpi_targets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NULL COMMENT 'NULL=全员默认目标',
  `dimension` VARCHAR(32) NOT NULL COMMENT 'followups|calls|revenue|orders|new_customers',
  `target_value` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `period` VARCHAR(16) NOT NULL DEFAULT 'daily' COMMENT 'daily|weekly|monthly',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_user_dim_period` (`tenant_id`, `user_id`, `dimension`, `period`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='KPI 目标配置';

-- ============================================================
-- 083: 合同管理（无外键）
-- ============================================================
CREATE TABLE IF NOT EXISTS `contracts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT UNSIGNED NOT NULL,
  `customer_id` INT UNSIGNED NULL COMMENT '关联客户',
  `owner_id` INT UNSIGNED NULL COMMENT '负责人(员工)',
  `title` VARCHAR(200) NOT NULL COMMENT '合同标题',
  `contract_no` VARCHAR(100) NULL UNIQUE COMMENT '合同编号',
  `type` ENUM('sales','service','nda','other') NOT NULL DEFAULT 'sales' COMMENT '合同类型',
  `status` ENUM('draft','pending','signed','active','expired','terminated') NOT NULL DEFAULT 'draft' COMMENT '状态',
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '合同金额',
  `currency` VARCHAR(10) NOT NULL DEFAULT 'CNY',
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `signed_at` DATETIME NULL COMMENT '签署日期',
  `party_a` VARCHAR(200) NULL COMMENT '甲方(我方)',
  `party_b` VARCHAR(200) NULL COMMENT '乙方(客户方)',
  `content` TEXT NULL COMMENT '合同条款',
  `attachment_url` VARCHAR(500) NULL COMMENT '附件URL',
  `reminder_days` INT NOT NULL DEFAULT 7 COMMENT '到期提醒天数',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tenant` (`tenant_id`),
  INDEX `idx_customer` (`customer_id`),
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_type` (`type`),
  INDEX `idx_end_date` (`end_date`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='合同管理';

CREATE TABLE IF NOT EXISTS `contract_approval` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `contract_id` INT UNSIGNED NOT NULL,
  `approval_instance_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_contract` (`contract_id`),
  INDEX `idx_instance` (`approval_instance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='合同审批关联';

-- ============================================================
-- 084: 任务管理系统（无外键）
-- ============================================================
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT UNSIGNED NOT NULL,
  `assignee_id` INT UNSIGNED NULL COMMENT '指派人',
  `creator_id` INT UNSIGNED NOT NULL COMMENT '创建人',
  `customer_id` INT UNSIGNED NULL COMMENT '关联客户',
  `contract_id` INT UNSIGNED NULL COMMENT '关联合同',
  `title` VARCHAR(200) NOT NULL COMMENT '任务标题',
  `description` TEXT NULL COMMENT '任务描述',
  `priority` ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium' COMMENT '优先级',
  `status` ENUM('todo','in_progress','done','cancelled') NOT NULL DEFAULT 'todo' COMMENT '状态',
  `due_date` DATETIME NULL COMMENT '截止日期',
  `completed_at` DATETIME NULL COMMENT '完成时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tenant` (`tenant_id`),
  INDEX `idx_assignee` (`assignee_id`),
  INDEX `idx_creator` (`creator_id`),
  INDEX `idx_customer` (`customer_id`),
  INDEX `idx_contract` (`contract_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_due_date` (`due_date`),
  INDEX `idx_priority` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='任务管理';

-- ============================================================
-- 085: 营销活动 & 消息模板（无外键）
-- ============================================================
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    name            VARCHAR(200) NOT NULL COMMENT '活动名称',
    type            ENUM('email','sms','wechat') NOT NULL DEFAULT 'email' COMMENT '渠道类型',
    status          ENUM('draft','scheduled','sending','sent','cancelled') NOT NULL DEFAULT 'draft',
    subject         VARCHAR(300) NULL COMMENT '邮件主题 / 短信前缀',
    content         TEXT         NULL COMMENT '邮件HTML内容 / 短信文本',
    template_id     BIGINT       NULL COMMENT '关联消息模板',
    target_filter   JSON         NULL COMMENT '目标客户筛选条件',
    target_count    INT          DEFAULT 0 COMMENT '目标客户数量',
    sent_count      INT          DEFAULT 0 COMMENT '已发送数量',
    open_count      INT          DEFAULT 0 COMMENT '打开数量(邮件)',
    click_count     INT          DEFAULT 0 COMMENT '点击数量',
    reply_count     INT          DEFAULT 0 COMMENT '回复数量',
    bounce_count    INT          DEFAULT 0 COMMENT '退信数量',
    scheduled_at    DATETIME     NULL COMMENT '定时发送时间',
    sent_at         DATETIME     NULL COMMENT '实际发送时间',
    created_by      BIGINT       NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (status),
    INDEX idx_type   (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销活动';

CREATE TABLE IF NOT EXISTS message_templates (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    name            VARCHAR(200) NOT NULL COMMENT '模板名称',
    type            ENUM('email','sms','wechat') NOT NULL DEFAULT 'email',
    subject         VARCHAR(300) NULL COMMENT '邮件主题模板',
    content         TEXT         NOT NULL COMMENT '模板内容(支持变量替换)',
    variables       JSON         NULL COMMENT '可用变量列表',
    is_active       TINYINT(1)  DEFAULT 1,
    created_by      BIGINT       NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_type   (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息模板库';

CREATE TABLE IF NOT EXISTS marketing_messages (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    campaign_id     BIGINT       NOT NULL,
    customer_id     BIGINT       NULL,
    contact_value   VARCHAR(500) NOT NULL COMMENT '邮箱地址 / 手机号',
    subject          VARCHAR(300) NULL,
    content         TEXT         NULL COMMENT '实际发送内容',
    status          ENUM('pending','sent','failed','opened','clicked','bounced') DEFAULT 'pending',
    error_message   TEXT         NULL,
    sent_at         DATETIME     NULL,
    opened_at       DATETIME     NULL,
    clicked_at      DATETIME     NULL,
    track_open_id   VARCHAR(64)  NULL,
    track_click_id  VARCHAR(64)  NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant      (tenant_id),
    INDEX idx_campaign    (campaign_id),
    INDEX idx_customer    (customer_id),
    INDEX idx_status      (status),
    INDEX idx_contact     (contact_value(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销消息发送记录';

CREATE TABLE IF NOT EXISTS marketing_optouts (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    customer_id     BIGINT       NULL,
    contact_value   VARCHAR(500) NOT NULL COMMENT '邮箱/手机号',
    reason          VARCHAR(500) NULL COMMENT '退订原因',
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_contact (tenant_id, contact_value(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销退订记录';

-- ============================================================
-- 086: 客户细分/智能标签系统（无外键）
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_segments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT           NOT NULL,
  name        VARCHAR(100)  NOT NULL COMMENT '分组名称',
  description VARCHAR(500)  COMMENT '分组说明',
  rules       JSON          NOT NULL COMMENT '筛选规则数组',
  match_type  ENUM('all','any') DEFAULT 'all',
  color_tag   VARCHAR(20)   COMMENT '颜色标签 hex',
  icon        VARCHAR(50)   COMMENT '图标标识',
  is_auto_refresh TINYINT(1) DEFAULT 0,
  member_count    INT        DEFAULT 0,
  last_refreshed_at DATETIME,
  created_by  INT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS customer_segment_members (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  segment_id  INT NOT NULL,
  customer_id INT NOT NULL,
  tenant_id   INT NOT NULL,
  added_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_segment_customer (segment_id, customer_id),
  INDEX idx_segment (segment_id),
  INDEX idx_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 087: 知识库/帮助中心（无外键）
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_categories (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id     INT          NOT NULL,
  name          VARCHAR(100) NOT NULL COMMENT '分类名称',
  slug          VARCHAR(100) COMMENT 'URL别名',
  description   VARCHAR(500),
  icon          VARCHAR(50),
  sort_order    INT          DEFAULT 0,
  is_published  TINYINT(1)  DEFAULT 0,
  created_by    INT,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kb_articles (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id          INT           NOT NULL,
  category_id        INT,
  title              VARCHAR(200)  NOT NULL,
  slug               VARCHAR(200),
  summary            VARCHAR(500),
  content            TEXT,
  content_type       ENUM('markdown','html','text') DEFAULT 'markdown',
  tags               JSON,
  author_id          INT,
  status             ENUM('draft','published','archived') DEFAULT 'draft',
  is_featured        TINYINT(1)   DEFAULT 0,
  is_ai_generated    TINYINT(1)   DEFAULT 0,
  view_count         INT           DEFAULT 0,
  helpful_yes        INT           DEFAULT 0,
  helpful_no         INT           DEFAULT 0,
  sort_order         INT           DEFAULT 0,
  published_at       DATETIME,
  created_at         DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_category (category_id),
  INDEX idx_status (status),
  INDEX idx_featured (is_featured),
  INDEX idx_published (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 088: 智能通知规则 + 浏览器推送订阅（无外键）
-- ============================================================
CREATE TABLE IF NOT EXISTS `notification_rules` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `description` VARCHAR(500) NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `trigger_type` VARCHAR(32) NOT NULL COMMENT '触发类型: schedule|event|cron',
  `trigger_config` JSON NOT NULL,
  `channels` JSON NOT NULL,
  `recipient_type` VARCHAR(32) NOT NULL DEFAULT 'specific',
  `recipient_config` JSON NULL,
  `template` JSON NOT NULL,
  `priority` ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  `cooldown_minutes` INT NOT NULL DEFAULT 60,
  `max_per_run` INT NOT NULL DEFAULT 50,
  `last_triggered_at` DATETIME NULL DEFAULT NULL,
  `trigger_count` INT NOT NULL DEFAULT 0,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_nr_tenant` (`tenant_id`),
  KEY `idx_nr_enabled` (`enabled`),
  KEY `idx_nr_trigger` (`trigger_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_rule_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `rule_id` INT UNSIGNED NOT NULL,
  `triggered_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `recipients_count` INT NOT NULL DEFAULT 0,
  `channels_used` JSON NULL,
  `status` ENUM('success','partial','failed') NOT NULL DEFAULT 'success',
  `error_message` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_nrl_rule` (`rule_id`),
  KEY `idx_nrl_tenant_triggered` (`tenant_id`, `triggered_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `browser_push_subscriptions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `endpoint` TEXT NOT NULL,
  `p256dh` TEXT NOT NULL,
  `auth` TEXT NOT NULL,
  `user_agent` VARCHAR(500) NULL DEFAULT NULL,
  `device_name` VARCHAR(100) NULL DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_used_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bps_user_endpoint` (`user_id`, `endpoint`(255)),
  KEY `idx_bps_user` (`user_id`),
  KEY `idx_bps_active` (`is_active`),
  KEY `idx_bps_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 089: AI 教练建议系统（无外键）
-- ============================================================
CREATE TABLE IF NOT EXISTS `ai_coach_suggestions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL COMMENT '租户ID',
  `user_id` BIGINT NOT NULL COMMENT '目标员工ID',
  `coach_type` VARCHAR(32) NOT NULL COMMENT '建议维度：followup/call/deal/develop/time/overall',
  `title` VARCHAR(120) NOT NULL COMMENT '建议标题',
  `content` TEXT NOT NULL COMMENT 'AI生成的教练建议正文',
  `context_data` JSON DEFAULT NULL,
  `priority` TINYINT NOT NULL DEFAULT 3 COMMENT '1=紧急 2=重要 3=普通 4=建议',
  `status` VARCHAR(16) NOT NULL DEFAULT 'active' COMMENT 'active/dismissed/implemented',
  `impact_score` DECIMAL(5,2) DEFAULT NULL,
  `generated_by` VARCHAR(64) DEFAULT NULL,
  `generated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `implemented_at` DATETIME DEFAULT NULL,
  `dismissed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_coach_tenant_user` (`tenant_id`, `user_id`),
  INDEX `idx_coach_type` (`tenant_id`, `coach_type`),
  INDEX `idx_coach_status` (`tenant_id`, `status`),
  INDEX `idx_coach_generated` (`generated_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 教练建议';

-- ============================================================
-- 090: 管理员收件箱 & AI 权限（幂等）
-- ============================================================
INSERT IGNORE INTO `permissions` (`code`, `name`, `module`, `sort_order`) VALUES
('inbox:view',   '查看统一收件箱', 'inbox', 10),
('inbox:reply',  '回复收件箱消息', 'inbox', 20),
('inbox:manage', '管理收件箱与知识库', 'inbox', 30),
('ai:approve',   '审核 AI 回复',     'ai',    20);

UPDATE `roles`
SET `perm_codes` = JSON_ARRAY_APPEND(`perm_codes`, '$', 'inbox:view')
WHERE `name` IN ('管理员', 'admin')
  AND `is_system` = 1
  AND JSON_SEARCH(`perm_codes`, 'one', 'inbox:view') IS NULL;

UPDATE `roles`
SET `perm_codes` = JSON_ARRAY_APPEND(`perm_codes`, '$', 'inbox:reply')
WHERE `name` IN ('管理员', 'admin')
  AND `is_system` = 1
  AND JSON_SEARCH(`perm_codes`, 'one', 'inbox:reply') IS NULL;

UPDATE `roles`
SET `perm_codes` = JSON_ARRAY_APPEND(`perm_codes`, '$', 'inbox:manage')
WHERE `name` IN ('管理员', 'admin')
  AND `is_system` = 1
  AND JSON_SEARCH(`perm_codes`, 'one', 'inbox:manage') IS NULL;

UPDATE `roles`
SET `perm_codes` = JSON_ARRAY_APPEND(`perm_codes`, '$', 'ai:approve')
WHERE `name` IN ('管理员', 'admin')
  AND `is_system` = 1
  AND JSON_SEARCH(`perm_codes`, 'one', 'ai:approve') IS NULL;

-- ============================================================
-- 091: 落地页构建器
-- ============================================================
CREATE TABLE IF NOT EXISTS landing_pages (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    title           VARCHAR(200) NOT NULL COMMENT '落地页标题',
    slug            VARCHAR(100) NOT NULL COMMENT 'URL 路径标识',
    description     VARCHAR(500) COMMENT 'SEO 描述',
    status          ENUM('draft','published','archived') DEFAULT 'draft',
    template        VARCHAR(50)  DEFAULT 'default',
    content         JSON         NOT NULL COMMENT '页面区块 JSON',
    custom_css      TEXT,
    meta_title      VARCHAR(200),
    og_image        VARCHAR(500),
    bg_color        VARCHAR(20)  DEFAULT '#ffffff',
    primary_color   VARCHAR(20)  DEFAULT '#534AB7',
    logo_url        VARCHAR(500),
    favicon_url     VARCHAR(500),
    enable_form     TINYINT(1)   DEFAULT 1,
    form_title      VARCHAR(200),
    form_fields     JSON,
    submit_btn_text VARCHAR(50)  DEFAULT '立即咨询',
    success_msg     VARCHAR(500) DEFAULT '提交成功，我们会尽快联系您！',
    redirect_url    VARCHAR(500),
    qrcode_url      VARCHAR(500),
    qrcode_text     VARCHAR(200),
    view_count      INT UNSIGNED DEFAULT 0,
    submit_count    INT UNSIGNED DEFAULT 0,
    published_at    DATETIME,
    created_by      BIGINT,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_slug (tenant_id, slug),
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='落地页';

CREATE TABLE IF NOT EXISTS landing_submissions (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    landing_id      BIGINT       NOT NULL,
    customer_id     BIGINT,
    data            JSON         NOT NULL,
    ip              VARCHAR(45),
    user_agent      VARCHAR(500),
    referer         VARCHAR(500),
    utm_source      VARCHAR(200),
    utm_medium      VARCHAR(200),
    utm_campaign    VARCHAR(200),
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_landing (landing_id),
    INDEX idx_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='落地页留资记录';

-- ============================================================
-- 092: 余额系统 + 自动续费（修复 DATABASE() 引用）
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_balances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL UNIQUE,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_recharged DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_consumed DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS balance_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  type ENUM('recharge', 'consume', 'refund') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  channel ENUM('wechat', 'alipay', 'manual', 'auto_renew', 'addon_purchase') NOT NULL DEFAULT 'manual',
  reference VARCHAR(128) DEFAULT NULL,
  description VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant (tenant_id),
  KEY idx_type (type),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订阅表增加自动续费字段（使用 DATABASE() 动态获取库名）
DROP PROCEDURE IF EXISTS add_sub_092;
DELIMITER //
CREATE PROCEDURE add_sub_092()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'auto_renew') THEN
    ALTER TABLE subscriptions ADD COLUMN auto_renew TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否开启自动续费';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'auto_renew_plan_id') THEN
    ALTER TABLE subscriptions ADD COLUMN auto_renew_plan_id BIGINT UNSIGNED DEFAULT NULL COMMENT '自动续费目标套餐ID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'auto_renew_cycle') THEN
    ALTER TABLE subscriptions ADD COLUMN auto_renew_cycle ENUM('monthly','yearly') DEFAULT NULL COMMENT '自动续费周期';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'expiry_notified_at') THEN
    ALTER TABLE subscriptions ADD COLUMN expiry_notified_at DATETIME DEFAULT NULL COMMENT '到期通知发送时间';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'reminder_notified_at') THEN
    ALTER TABLE subscriptions ADD COLUMN reminder_notified_at DATETIME DEFAULT NULL COMMENT '续费提醒发送时间';
  END IF;
END //
DELIMITER ;
CALL add_sub_092();
DROP PROCEDURE IF EXISTS add_sub_092;

CREATE TABLE IF NOT EXISTS recharge_packages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  bonus DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO recharge_packages (name, amount, bonus, sort_order) VALUES
('小额充值', 100.00, 0.00, 10),
('标准充值', 500.00, 20.00, 20),
('大额充值', 1000.00, 60.00, 30),
('超值充值', 3000.00, 240.00, 40),
('旗舰充值', 5000.00, 500.00, 50);

-- ============================================================
-- 093: 用量加购包系统
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_addon_packages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(32) NOT NULL UNIQUE,
  resource_type ENUM('customers','seats','broadcasts','ai_calls') NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_months INT UNSIGNED NOT NULL DEFAULT 1,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tenant_usage_addons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  addon_package_id BIGINT UNSIGNED NOT NULL,
  resource_type ENUM('customers','seats','broadcasts','ai_calls') NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  consumed INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  payment_record_id BIGINT UNSIGNED DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant (tenant_id),
  KEY idx_expires (expires_at),
  KEY idx_active (tenant_id, resource_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO usage_addon_packages (name, code, resource_type, quantity, price, duration_months, sort_order) VALUES
('AI调用包 1000次', 'ai_1k', 'ai_calls', 1000, 59.00, 1, 10),
('AI调用包 5000次', 'ai_5k', 'ai_calls', 5000, 199.00, 1, 20),
('AI调用包 10000次', 'ai_10k', 'ai_calls', 10000, 349.00, 1, 30),
('群发包 2000次', 'broadcast_2k', 'broadcasts', 2000, 49.00, 1, 40),
('群发包 10000次', 'broadcast_10k', 'broadcasts', 10000, 199.00, 1, 50),
('客户扩容包 500人', 'customers_500', 'customers', 500, 29.00, 1, 60),
('客户扩容包 2000人', 'customers_2k', 'customers', 2000, 99.00, 1, 70),
('席位包 5人', 'seats_5', 'seats', 5, 39.00, 1, 80),
('席位包 10人', 'seats_10', 'seats', 10, 69.00, 1, 90);

-- ============================================================
-- 094: 发票系统增强
-- ============================================================
DROP PROCEDURE IF EXISTS add_inv_094;
DELIMITER //
CREATE PROCEDURE add_inv_094()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoice_requests' AND COLUMN_NAME = 'invoice_file_path') THEN
    ALTER TABLE billing_invoice_requests ADD COLUMN invoice_file_path VARCHAR(500) DEFAULT NULL COMMENT '发票文件路径/URL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoice_requests' AND COLUMN_NAME = 'invoice_number') THEN
    ALTER TABLE billing_invoice_requests ADD COLUMN invoice_number VARCHAR(32) DEFAULT NULL COMMENT '发票号码';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoice_requests' AND COLUMN_NAME = 'issued_by') THEN
    ALTER TABLE billing_invoice_requests ADD COLUMN issued_by BIGINT UNSIGNED DEFAULT NULL COMMENT '开票人';
  END IF;
END //
DELIMITER ;
CALL add_inv_094();
DROP PROCEDURE IF EXISTS add_inv_094;

DROP PROCEDURE IF EXISTS add_pay_094;
DELIMITER //
CREATE PROCEDURE add_pay_094()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records' AND COLUMN_NAME = 'auto_invoice') THEN
    ALTER TABLE payment_records ADD COLUMN auto_invoice TINYINT(1) NOT NULL DEFAULT 0 COMMENT '支付后自动申请发票';
  END IF;
END //
DELIMITER ;
CALL add_pay_094();
DROP PROCEDURE IF EXISTS add_pay_094;

-- ============================================================
-- 095: 支付记录增加 purchase_type（幂等处理）
-- ============================================================
DROP PROCEDURE IF EXISTS add_pt_095;
DELIMITER //
CREATE PROCEDURE add_pt_095()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records' AND COLUMN_NAME = 'purchase_type') THEN
    ALTER TABLE payment_records
      ADD COLUMN purchase_type ENUM('subscription', 'balance_recharge', 'addon_purchase') 
        NOT NULL DEFAULT 'subscription' 
        AFTER pay_channel;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records' AND COLUMN_NAME = 'metadata') THEN
    ALTER TABLE payment_records
      ADD COLUMN metadata JSON NULL 
      AFTER remark;
  END IF;
  -- 如果 plan_id 是 NOT NULL 且不存在 purchase_type，则设为 nullable
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records' AND COLUMN_NAME = 'plan_id' AND IS_NULLABLE = 'NO') THEN
    ALTER TABLE payment_records MODIFY COLUMN plan_id BIGINT UNSIGNED NULL;
  END IF;
END //
DELIMITER ;
CALL add_pt_095();
DROP PROCEDURE IF EXISTS add_pt_095;

-- ============================================================
-- 096: 修复 billing_invoice_requests 与 Sequelize 模型对齐
-- ============================================================
DROP PROCEDURE IF EXISTS safe_add_column;

DELIMITER //
CREATE PROCEDURE safe_add_column(IN tbl VARCHAR(64), IN col VARCHAR(64), IN colDef VARCHAR(512))
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', colDef);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL safe_add_column('billing_invoice_requests', 'requested_by', 'BIGINT UNSIGNED NULL');
CALL safe_add_column('billing_invoice_requests', 'email', 'VARCHAR(120) NOT NULL DEFAULT ""');
CALL safe_add_column('billing_invoice_requests', 'mailing_address', 'VARCHAR(255) NULL');
CALL safe_add_column('billing_invoice_requests', 'remark', 'VARCHAR(500) NULL');
CALL safe_add_column('billing_invoice_requests', 'admin_remark', 'VARCHAR(500) NULL');
CALL safe_add_column('billing_invoice_requests', 'issued_at', 'DATETIME NULL');
CALL safe_add_column('billing_invoice_requests', 'issued_by', 'BIGINT UNSIGNED NULL');
CALL safe_add_column('billing_invoice_requests', 'invoice_file_path', 'VARCHAR(500) NULL');
CALL safe_add_column('billing_invoice_requests', 'invoice_number', 'VARCHAR(32) NULL');

-- 修复列名（幂等处理：如果存在旧列名 tax_number 则重命名）
DROP PROCEDURE IF EXISTS fix_tax_col;
DELIMITER //
CREATE PROCEDURE fix_tax_col()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoice_requests' AND COLUMN_NAME = 'tax_number')
     AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_invoice_requests' AND COLUMN_NAME = 'tax_no') THEN
    ALTER TABLE billing_invoice_requests CHANGE COLUMN tax_number tax_no VARCHAR(32) NOT NULL DEFAULT '';
  END IF;
END //
DELIMITER ;
CALL fix_tax_col();
DROP PROCEDURE IF EXISTS fix_tax_col;

-- 确保 invoice_type ENUM 包含 electronic
ALTER TABLE billing_invoice_requests
  MODIFY COLUMN invoice_type
    ENUM('vat_special','vat_normal','electronic') NOT NULL DEFAULT 'electronic';

-- 确保 status ENUM 有所有值
ALTER TABLE billing_invoice_requests
  MODIFY COLUMN status
    ENUM('pending','processing','issued','rejected') NOT NULL DEFAULT 'pending';

-- 余额相关表（仅当 092 创建失败时补救）
CREATE TABLE IF NOT EXISTS tenant_balances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL UNIQUE,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_recharged DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_consumed DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS balance_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  type ENUM('recharge','consume','refund') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  channel VARCHAR(32) NOT NULL DEFAULT 'manual',
  description VARCHAR(500) NULL,
  payment_record_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recharge_packages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  bonus DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO recharge_packages (name, amount, bonus, sort_order) VALUES
('¥100', 100.00, 0.00, 1),
('¥500', 500.00, 50.00, 2),
('¥1000', 1000.00, 120.00, 3),
('¥2000', 2000.00, 300.00, 4),
('¥5000', 5000.00, 800.00, 5);

-- 为所有租户创建余额记录
INSERT IGNORE INTO tenant_balances (tenant_id, balance, total_recharged, total_consumed)
  SELECT id, 0.00, 0.00, 0.00 FROM tenants;

DROP PROCEDURE IF EXISTS safe_add_column;

-- ============================================================
-- 迁移记录表（幂等追踪）
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    filename  VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 记录本次迁移
INSERT IGNORE INTO schema_migrations (filename) VALUES
('078_pipeline_config.sql'),
('079_dashboard_config.sql'),
('080_tenant_inbox_auto_draft.sql'),
('081_fix_ai_reply_logs.sql'),
('082_add_kpi_targets.sql'),
('083_add_contracts.sql'),
('084_add_tasks.sql'),
('085_add_marketing_campaigns.sql'),
('086_add_customer_segments.sql'),
('087_add_knowledge_base.sql'),
('088_add_notification_rules.sql'),
('089_add_coach_suggestions.sql'),
('090_admin_inbox_ai_permissions.sql'),
('091_add_landing_pages.sql'),
('092_balance_autorenew.sql'),
('093_usage_addons.sql'),
('094_invoice_enhance.sql'),
('095_payment_purchase_type.sql'),
('096_fix_invoice_and_balance_schema.sql');

SELECT '✅ ECS 迁移 078-096 执行完毕' AS status;
