-- 096: 修复 billing_invoice_requests 表结构与 Sequelize 模型对齐
-- 以及确保余额相关表存在（balance_transactions, tenant_balances, recharge_packages）
-- 执行日期: 2026-06-02

-- ============================================================
-- 1. billing_invoice_requests 表修复
-- ============================================================
-- 确保列存在（ALTER IGNORE / ADD COLUMN IF NOT EXISTS 兼容写法）
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

-- 添加缺失列
CALL safe_add_column('billing_invoice_requests', 'requested_by', 'BIGINT UNSIGNED NULL');
CALL safe_add_column('billing_invoice_requests', 'email', 'VARCHAR(120) NOT NULL DEFAULT ""');
CALL safe_add_column('billing_invoice_requests', 'mailing_address', 'VARCHAR(255) NULL');
CALL safe_add_column('billing_invoice_requests', 'remark', 'VARCHAR(500) NULL');
CALL safe_add_column('billing_invoice_requests', 'admin_remark', 'VARCHAR(500) NULL');
CALL safe_add_column('billing_invoice_requests', 'issued_at', 'DATETIME NULL');
CALL safe_add_column('billing_invoice_requests', 'issued_by', 'BIGINT UNSIGNED NULL');
CALL safe_add_column('billing_invoice_requests', 'invoice_file_path', 'VARCHAR(500) NULL');
CALL safe_add_column('billing_invoice_requests', 'invoice_number', 'VARCHAR(32) NULL');

-- 修复列名: tax_number → tax_no（如果存在旧列名）
ALTER TABLE billing_invoice_requests
  CHANGE COLUMN tax_number tax_no VARCHAR(32) NOT NULL DEFAULT '';

-- 修复 ENUM 值
ALTER TABLE billing_invoice_requests
  MODIFY COLUMN invoice_type
    ENUM('vat_special','vat_normal','electronic') NOT NULL DEFAULT 'electronic';

ALTER TABLE billing_invoice_requests
  MODIFY COLUMN status
    ENUM('pending','processing','issued','rejected') NOT NULL DEFAULT 'pending';

-- 调整列长度
ALTER TABLE billing_invoice_requests
  MODIFY COLUMN title VARCHAR(200) NOT NULL;

-- ============================================================
-- 2. 确保余额相关表存在
-- ============================================================
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

-- 默认充值面额（如果不存在）
INSERT IGNORE INTO recharge_packages (name, amount, bonus, sort_order) VALUES
('¥100', 100.00, 0.00, 1),
('¥500', 500.00, 50.00, 2),
('¥1000', 1000.00, 120.00, 3),
('¥2000', 2000.00, 300.00, 4),
('¥5000', 5000.00, 800.00, 5);

-- 为所有租户创建余额记录（如果不存在）
INSERT IGNORE INTO tenant_balances (tenant_id, balance, total_recharged, total_consumed)
  SELECT id, 0.00, 0.00, 0.00 FROM tenants;

DROP PROCEDURE IF EXISTS safe_add_column;
