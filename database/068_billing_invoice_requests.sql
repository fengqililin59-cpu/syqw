SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS billing_invoice_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  requested_by BIGINT UNSIGNED NULL COMMENT 'users.id',
  payment_record_id BIGINT UNSIGNED NULL COMMENT '关联 payment_records',
  invoice_type ENUM('vat_special','vat_normal','electronic') NOT NULL DEFAULT 'electronic',
  title VARCHAR(200) NOT NULL COMMENT '开票抬头',
  tax_no VARCHAR(32) NOT NULL COMMENT '纳税人识别号',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  email VARCHAR(120) NOT NULL COMMENT '接收邮箱',
  mailing_address VARCHAR(255) NULL COMMENT '纸质专票邮寄地址',
  remark VARCHAR(500) NULL COMMENT '租户备注',
  admin_remark VARCHAR(500) NULL COMMENT '平台处理备注',
  status ENUM('pending','processing','issued','rejected') NOT NULL DEFAULT 'pending',
  issued_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_invoice_tenant_status (tenant_id, status),
  KEY idx_invoice_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户开票申请';
