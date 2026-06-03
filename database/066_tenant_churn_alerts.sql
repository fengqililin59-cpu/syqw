SET NAMES utf8mb4;

-- 流失预警发送记录（同类型 7 天内不重复推送）
CREATE TABLE IF NOT EXISTS tenant_churn_alerts (
  tenant_id BIGINT UNSIGNED NOT NULL,
  alert_key VARCHAR(64) NOT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detail JSON NULL,
  PRIMARY KEY (tenant_id, alert_key),
  KEY idx_churn_sent (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
