SET NAMES utf8mb4;

-- 平台 MRR 月度快照（订阅口径，由定时任务写入）
CREATE TABLE IF NOT EXISTS platform_mrr_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  snapshot_month CHAR(7) NOT NULL COMMENT 'YYYY-MM',
  mrr_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  active_subscriptions INT UNSIGNED NOT NULL DEFAULT 0,
  mrr_by_plan_json JSON NOT NULL,
  captured_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_mrr_snapshot_month (snapshot_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
