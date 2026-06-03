-- ============================================================================
-- ECS 补表脚本：仅创建 wework_saas 数据库中缺失的表
-- 幂等（全部使用 IF NOT EXISTS）
-- ============================================================================
SET NAMES utf8mb4;

-- ============================================================================
-- 043: 计费基础（plans / subscriptions / payment_records）
-- ============================================================================
CREATE TABLE IF NOT EXISTS plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(32) NOT NULL UNIQUE,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
  customers_limit INT NOT NULL DEFAULT -1,
  seats_limit INT NOT NULL DEFAULT -1,
  broadcasts_monthly INT NOT NULL DEFAULT -1,
  ai_calls_monthly INT NOT NULL DEFAULT -1,
  features JSON NOT NULL DEFAULT (JSON_ARRAY()),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO plans (name, code, price_monthly, price_yearly, customers_limit, seats_limit,
  broadcasts_monthly, ai_calls_monthly, features, sort_order)
VALUES
('免费版', 'free', 0, 0, 100, 3, 500, 100,
 JSON_ARRAY('customer_manage','broadcast','channel_track','dashboard'), 10),
('专业版', 'pro', 299, 2990, 5000, 20, 10000, 2000,
 JSON_ARRAY('customer_manage','broadcast','channel_track','dashboard','automation',
   'ai_full','campaign','migration','intent_alert','audit_log'), 20),
('企业版', 'enterprise', 999, 9990, -1, -1, -1, -1, JSON_ARRAY('all'), 30);

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL UNIQUE,
  plan_id BIGINT UNSIGNED NOT NULL,
  billing_cycle ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  status ENUM('trialing','active','expired','cancelled') NOT NULL DEFAULT 'trialing',
  trial_ends_at DATETIME NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sub_plan (plan_id),
  KEY idx_sub_status (status),
  KEY idx_sub_period_end (current_period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 为现有租户创建默认订阅（免费版，14天试用）
INSERT IGNORE INTO subscriptions (tenant_id, plan_id, status, trial_ends_at)
SELECT t.id, (SELECT id FROM plans WHERE code='free'), 'trialing', DATE_ADD(NOW(), INTERVAL 14 DAY)
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.tenant_id = t.id);

CREATE TABLE IF NOT EXISTS payment_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  billing_cycle ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'CNY',
  status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  pay_channel ENUM('wechat','alipay','manual') NOT NULL DEFAULT 'manual',
  out_trade_no VARCHAR(64) NOT NULL UNIQUE,
  paid_at DATETIME NULL,
  remark VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payment_tenant (tenant_id),
  KEY idx_payment_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 077: 自定义字段（EAV 模型，无FK版）
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_custom_field_defs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  field_key       VARCHAR(64)     NOT NULL COMMENT '字段键',
  field_label     VARCHAR(128)    NOT NULL COMMENT '显示名称',
  field_type      ENUM('text','number','date','select','multi_select','checkbox','textarea')
                                  NOT NULL DEFAULT 'text',
  options         JSON            NULL,
  group_name      VARCHAR(64)     NULL,
  is_required     TINYINT(1)      NOT NULL DEFAULT 0,
  display_order   INT             NOT NULL DEFAULT 0,
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  placeholder     VARCHAR(255)    NULL,
  help_text       VARCHAR(500)    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenant_field (tenant_id, field_key),
  KEY idx_tenant_order (tenant_id, display_order),
  KEY idx_tenant_group (tenant_id, group_name),
  KEY idx_tenant_active (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tenant_customer_field_values (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  customer_id     BIGINT UNSIGNED NOT NULL,
  field_id        BIGINT UNSIGNED NOT NULL,
  value           TEXT            NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_field (customer_id, field_id),
  KEY idx_tenant_customer (tenant_id, customer_id),
  KEY idx_field (field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 通知中心
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('lead_assigned','followup_reminder','stage_changed','customer_transferred',
    'deal_won','deal_lost','comment_added','task_assigned','system_notice','ai_alert') NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NULL,
  related_type VARCHAR(32) NULL DEFAULT NULL,
  related_id VARCHAR(64) NULL DEFAULT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_tenant_user_read (tenant_id, recipient_user_id, is_read),
  KEY idx_notif_user_created (recipient_user_id, created_at),
  KEY idx_notif_related (related_type, related_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 审批工作流
-- ============================================================================
CREATE TABLE IF NOT EXISTS approval_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL DEFAULT NULL,
  steps JSON NOT NULL COMMENT '审批步骤 [{order, approver_id?, approver_role?, step_name}]',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_at_tenant (tenant_id),
  KEY idx_at_tenant_active (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_instances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  template_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  applicant_user_id BIGINT UNSIGNED NOT NULL,
  related_type VARCHAR(32) NULL DEFAULT NULL COMMENT 'customer/deal/order/refund',
  related_id VARCHAR(64) NULL DEFAULT NULL,
  status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  current_step INT NOT NULL DEFAULT 0 COMMENT '当前步骤序号(从0开始)',
  steps_snapshot JSON NOT NULL COMMENT '冻结的步骤快照',
  submitted_at DATETIME NULL DEFAULT NULL,
  completed_at DATETIME NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_tenant_status (tenant_id, status),
  KEY idx_ai_tenant_applicant (tenant_id, applicant_user_id),
  KEY idx_ai_template (template_id),
  KEY idx_ai_related (related_type, related_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 092: 余额充值/自动续费（subscriptions 加列 + recharge_packages 建表）
-- ============================================================================
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS add_sub_cols_092()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'auto_renew') THEN
    ALTER TABLE subscriptions ADD COLUMN auto_renew TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否自动续费';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'expiry_notified_at') THEN
    ALTER TABLE subscriptions ADD COLUMN expiry_notified_at DATETIME DEFAULT NULL COMMENT '到期通知发送时间';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'reminder_notified_at') THEN
    ALTER TABLE subscriptions ADD COLUMN reminder_notified_at DATETIME DEFAULT NULL COMMENT '续费提醒发送时间';
  END IF;
END //
DELIMITER ;
CALL add_sub_cols_092();
DROP PROCEDURE IF EXISTS add_sub_cols_092;

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
('￥100 充值', 100.00, 0.00, 1),
('￥500 充值', 500.00, 25.00, 2),
('￥1000 充值', 1000.00, 80.00, 3),
('￥3000 充值', 3000.00, 300.00, 4);

-- tenant_balances 表已存在于 ECS，跳过建表。仅补列
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS add_balance_cols_092()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenant_balances' AND COLUMN_NAME = 'frozen_balance') THEN
    ALTER TABLE tenant_balances ADD COLUMN frozen_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '冻结金额';
  END IF;
END //
DELIMITER ;
CALL add_balance_cols_092();
DROP PROCEDURE IF EXISTS add_balance_cols_092;

-- ============================================================================
-- 093: 用量加购包
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_addon_packages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  addon_type ENUM('customers','seats','broadcasts','ai_calls') NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO usage_addon_packages (name, addon_type, quantity, price, sort_order) VALUES
('客户包 +1000', 'customers', 1000, 50.00, 1),
('客户包 +5000', 'customers', 5000, 200.00, 2),
('席位包 +5', 'seats', 5, 100.00, 3),
('群发包 +5000', 'broadcasts', 5000, 100.00, 4),
('AI 调用包 +1000', 'ai_calls', 1000, 200.00, 5);

-- ============================================================================
-- 094: 发票系统增强（invoices 表如不存在则建）
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT UNSIGNED AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  invoice_no VARCHAR(64) NULL,
  invoice_type ENUM('vat_normal','vat_special','electronic') NOT NULL DEFAULT 'electronic',
  title VARCHAR(200) NOT NULL COMMENT '发票抬头',
  tax_no VARCHAR(50) NULL COMMENT '税号',
  bank_info VARCHAR(500) NULL COMMENT '开户行及账号',
  address_phone VARCHAR(500) NULL COMMENT '地址电话',
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','issued','mailed','voided') NOT NULL DEFAULT 'pending',
  issued_at DATETIME NULL,
  mailed_at DATETIME NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inv_tenant (tenant_id),
  KEY idx_inv_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 095: 支付记录增加 purchase_type 字段
-- ============================================================================
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS add_payment_col_095()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records' AND COLUMN_NAME = 'purchase_type') THEN
    ALTER TABLE payment_records ADD COLUMN purchase_type ENUM('plan','recharge','addon') NOT NULL DEFAULT 'plan' COMMENT '购买类型';
  END IF;
END //
DELIMITER ;
CALL add_payment_col_095();
DROP PROCEDURE IF EXISTS add_payment_col_095;

-- ============================================================================
-- 完成
-- ============================================================================
SELECT '✅ ECS 补表完成' AS status;
