SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS customer_transfers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  from_user_id BIGINT UNSIGNED NOT NULL,
  to_user_id BIGINT UNSIGNED NOT NULL,
  initiated_by BIGINT UNSIGNED NOT NULL,
  reason ENUM('resigned','reassign')
    NOT NULL DEFAULT 'resigned',
  status ENUM('pending','processing','done','partial','failed')
    NOT NULL DEFAULT 'pending',
  total_count INT UNSIGNED NOT NULL DEFAULT 0,
  success_count INT UNSIGNED NOT NULL DEFAULT 0,
  failed_count INT UNSIGNED NOT NULL DEFAULT 0,
  detail_json JSON NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transfer_tenant (tenant_id),
  KEY idx_transfer_from_user (from_user_id),
  KEY idx_transfer_to_user (to_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
