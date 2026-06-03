SET NAMES utf8mb4;

-- 平台运营对租户的回访 / 备注（仅平台超管可见）
CREATE TABLE IF NOT EXISTS tenant_platform_ops_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED NULL,
  note_type ENUM('call', 'wechat', 'email', 'other') NOT NULL DEFAULT 'call',
  content TEXT NOT NULL,
  next_follow_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tpon_tenant_created (tenant_id, created_at),
  CONSTRAINT fk_tpon_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台运营租户备注';
