SET NAMES utf8mb4;

-- 企微私域账号 ↔ 智学 AI 平台（www.syzs.top）账号绑定
CREATE TABLE IF NOT EXISTS user_syzs_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  syzs_user_id VARCHAR(64) NOT NULL COMMENT '平台 Prisma user.id',
  syzs_email VARCHAR(191) NULL,
  syzs_phone VARCHAR(32) NULL,
  linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_syzs (user_id),
  UNIQUE KEY uniq_syzs_global (syzs_user_id),
  KEY idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
