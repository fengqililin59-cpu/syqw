SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS intent_alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  owner_id BIGINT UNSIGNED NOT NULL,
  score_before SMALLINT UNSIGNED NOT NULL,
  score_after SMALLINT UNSIGNED NOT NULL,
  score_delta SMALLINT UNSIGNED NOT NULL,
  ai_script TEXT NULL,
  sent_at DATETIME NULL,
  status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  alert_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED,
  PRIMARY KEY (id),
  KEY idx_intent_alert_tenant_created (tenant_id, created_at),
  KEY idx_intent_alert_customer (customer_id),
  UNIQUE KEY uniq_alert_customer_day (customer_id, alert_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
