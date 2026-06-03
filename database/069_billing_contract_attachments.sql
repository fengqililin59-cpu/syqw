SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS billing_contract_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  payment_record_id BIGINT UNSIGNED NOT NULL,
  out_trade_no VARCHAR(64) NOT NULL,
  uploaded_by BIGINT UNSIGNED NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(128) NOT NULL COMMENT '磁盘相对路径片段',
  mime_type VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
  size_bytes INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_contract_att_payment (payment_record_id),
  KEY idx_contract_att_trade (out_trade_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台合同开单附件';
