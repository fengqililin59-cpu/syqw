-- 094: 发票系统增强 —— 发票文件存储 + 自动开票选项

-- billing_invoice_requests 增加发票文件相关字段
DROP PROCEDURE IF EXISTS add_invoice_columns;
DELIMITER $$
CREATE PROCEDURE add_invoice_columns()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'billing_invoice_requests' AND COLUMN_NAME = 'invoice_file_path') THEN
    ALTER TABLE billing_invoice_requests ADD COLUMN invoice_file_path VARCHAR(500) DEFAULT NULL COMMENT '发票文件路径/URL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'billing_invoice_requests' AND COLUMN_NAME = 'invoice_number') THEN
    ALTER TABLE billing_invoice_requests ADD COLUMN invoice_number VARCHAR(32) DEFAULT NULL COMMENT '发票号码';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'billing_invoice_requests' AND COLUMN_NAME = 'issued_by') THEN
    ALTER TABLE billing_invoice_requests ADD COLUMN issued_by BIGINT UNSIGNED DEFAULT NULL COMMENT '开票人';
  END IF;
END$$
DELIMITER ;
CALL add_invoice_columns();
DROP PROCEDURE IF EXISTS add_invoice_columns;

-- payment_records 增加自动开票标记
DROP PROCEDURE IF EXISTS add_payment_columns;
DELIMITER $$
CREATE PROCEDURE add_payment_columns()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'payment_records' AND COLUMN_NAME = 'auto_invoice') THEN
    ALTER TABLE payment_records ADD COLUMN auto_invoice TINYINT(1) NOT NULL DEFAULT 0 COMMENT '支付后自动申请发票';
  END IF;
END$$
DELIMITER ;
CALL add_payment_columns();
DROP PROCEDURE IF EXISTS add_payment_columns;
