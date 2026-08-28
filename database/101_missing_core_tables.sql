-- ============================================================
-- 101 补齐从未进入迁移体系的核心表
-- ============================================================
-- 背景：以下四张表在 backend/src/models/ 下都有模型，但 database/ 下
-- 从来没有编号迁移创建过它们。本地开发库里之所以有，是历史上跑过
-- sequelize.sync() 或手工执行了 deploy/ 下的一次性脚本：
--   products                          -> 仅存在于 deploy/ecs_fix_billing.sql
--   notifications / approval_templates
--   / approval_instances              -> 仅存在于 deploy/ecs_missing_tables.sql
--                                        与 database/zhiflow_prod_phase10_12_no_fk.sql
-- 这些脚本不属于编号迁移序列，是否在某台生产机上执行过无法确认，
-- 因此本迁移用 CREATE TABLE IF NOT EXISTS 把它们正式纳入迁移体系。
-- 直接症状：P0 页面报 Table 'wework_saas.products' doesn't exist。
--
-- 列定义以 Sequelize 模型为准（config/database.js 全局 underscored + timestamps），
-- 与本地开发库 SHOW CREATE TABLE 结果逐列核对一致。
--
-- 设计原则与 100_beauty_appointments_cards.sql 保持一致：
--   无外键约束（生产账号可能没有 REFERENCES 权限，靠应用层保证一致性）
--   不使用存储过程（生产 syqw_app 无 CREATE ROUTINE 权限）
--   幂等，可重复执行
-- ============================================================

SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- 1. 产品/服务项目目录
--    美业场景下同时承担「服务项目」与「卡项定义」的定义表，
--    被 appointments.product_id 与 customer_cards.product_id 引用（均可空）。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id`   BIGINT UNSIGNED NOT NULL,
  `name`        VARCHAR(200)    NOT NULL,
  `description` TEXT            NULL,
  `category`    VARCHAR(100)    NULL COMMENT '产品分类',
  `unit_price`  DECIMAL(12,2)   NULL DEFAULT 0 COMMENT '单价',
  `unit`        VARCHAR(20)     NULL COMMENT '单位（件/套/次/人/小时等）',
  `is_active`   TINYINT         NOT NULL DEFAULT 1,
  `image_url`   VARCHAR(500)    NULL,
  `metadata`    JSON            NULL COMMENT '行业自定义属性（如规格/型号/颜色等）',
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_products_tenant_category` (`tenant_id`, `category`),
  KEY `idx_products_tenant_active` (`tenant_id`, `is_active`),
  KEY `idx_products_tenant_name` (`tenant_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品/服务项目目录';

-- ------------------------------------------------------------
-- 2. 站内通知中心
--    模型 updatedAt: false，故只有 created_at。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id`         BIGINT UNSIGNED NOT NULL,
  `recipient_user_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM(
      'lead_assigned', 'followup_reminder', 'stage_changed', 'customer_transferred',
      'deal_won', 'deal_lost', 'comment_added', 'task_assigned', 'system_notice', 'ai_alert'
    ) NOT NULL,
  `title`             VARCHAR(255) NOT NULL,
  `body`              TEXT         NULL,
  `related_type`      VARCHAR(32)  NULL,
  `related_id`        VARCHAR(64)  NULL,
  `is_read`           TINYINT(1)   NOT NULL DEFAULT 0,
  `read_at`           DATETIME     NULL,
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_tenant_recipient_read` (`tenant_id`, `recipient_user_id`, `is_read`),
  KEY `idx_notifications_recipient_created` (`recipient_user_id`, `created_at`),
  KEY `idx_notifications_related` (`related_type`, `related_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='站内通知';

-- ------------------------------------------------------------
-- 3. 审批模板
--    模型未声明 indexes，故只有主键，与本地库一致。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `approval_templates` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id`   BIGINT UNSIGNED NOT NULL,
  `name`        VARCHAR(100)    NOT NULL,
  `description` VARCHAR(500)    NULL,
  `steps`       JSON            NOT NULL COMMENT '审批步骤数组 [{order, approver_id?, approver_role?, step_name}]',
  `is_active`   TINYINT         NOT NULL DEFAULT 1,
  `created_by`  BIGINT UNSIGNED NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批模板';

-- ------------------------------------------------------------
-- 4. 审批实例
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `approval_instances` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id`         BIGINT UNSIGNED NOT NULL,
  `template_id`       BIGINT UNSIGNED NOT NULL,
  `title`             VARCHAR(255)    NOT NULL,
  `applicant_user_id` BIGINT UNSIGNED NOT NULL,
  `related_type`      VARCHAR(32)     NULL COMMENT '关联业务类型(customer/deal/order/refund)',
  `related_id`        VARCHAR(64)     NULL COMMENT '关联业务ID',
  `status`            ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  `current_step`      INT             NOT NULL DEFAULT 0 COMMENT '当前审批步骤序号(从0开始)',
  `steps_snapshot`    JSON            NOT NULL COMMENT '提交时冻结的步骤快照 [{order,approver_id,step_name,status,comment,action_user_id,action_at}]',
  `submitted_at`      DATETIME        NULL,
  `completed_at`      DATETIME        NULL,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_approval_instances_tenant_status` (`tenant_id`, `status`),
  KEY `idx_approval_instances_tenant_applicant` (`tenant_id`, `applicant_user_id`),
  KEY `idx_approval_instances_template_id` (`template_id`),
  KEY `idx_approval_instances_related` (`related_type`, `related_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批实例';

-- ------------------------------------------------------------
-- 5. 聚合表补 created_at
--    模型 timestamps: true 声明了 created_at，但迁移 030/031/032 只建了
--    updated_at。Sequelize 在 INSERT 时会带上 created_at，缺列会导致
--    "Unknown column 'created_at' in 'field list'"。
--    历史行没有真实创建时间，回填为 updated_at 的值。
-- ------------------------------------------------------------
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agg_ads_roi_daily' AND COLUMN_NAME = 'created_at') > 0,
  'SELECT ''agg_ads_roi_daily.created_at 已存在''',
  'ALTER TABLE agg_ads_roi_daily ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER conversion_value');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agg_channel_daily' AND COLUMN_NAME = 'created_at') > 0,
  'SELECT ''agg_channel_daily.created_at 已存在''',
  'ALTER TABLE agg_channel_daily ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'aggregation_meta' AND COLUMN_NAME = 'created_at') > 0,
  'SELECT ''aggregation_meta.created_at 已存在''',
  'ALTER TABLE aggregation_meta ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- 回填：仅处理 created_at 明显早于表内数据的历史行（新加列默认值为执行时刻，
-- 而 updated_at 才是这些聚合行的真实写入时间）。
UPDATE agg_ads_roi_daily SET created_at = updated_at WHERE created_at > updated_at;
UPDATE agg_channel_daily  SET created_at = updated_at WHERE created_at > updated_at;
UPDATE aggregation_meta   SET created_at = updated_at WHERE created_at > updated_at;
