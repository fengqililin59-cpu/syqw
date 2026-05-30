-- 企业注册：邮箱/短信验证码（短时有效，一次性消费）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `registration_otp_challenges` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `channel` ENUM('email','sms') NOT NULL,
  `target` VARCHAR(191) NOT NULL COMMENT '规范化后的邮箱或手机号',
  `code_hash` CHAR(64) NOT NULL COMMENT 'sha256(hex) 验证码+盐',
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_lookup` (`channel`, `target`(64), `consumed_at`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
