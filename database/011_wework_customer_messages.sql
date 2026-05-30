-- 企微「客户联系 / 接收消息」解密入库（需在 backend 配置回调 URL）
-- 执行：mysql ... < database/011_wework_customer_messages.sql

CREATE TABLE IF NOT EXISTS `wework_customer_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '匹配到的 customers.id',
  `msg_id` VARCHAR(64) NOT NULL COMMENT '企微 MsgId 或生成的 evt: 键',
  `external_userid` VARCHAR(64) NULL DEFAULT NULL COMMENT '外部联系人 userid',
  `staff_userid` VARCHAR(64) NULL DEFAULT NULL COMMENT '成员 userid',
  `direction` VARCHAR(16) NOT NULL COMMENT 'customer | staff',
  `msg_type` VARCHAR(32) NOT NULL,
  `content` TEXT NULL COMMENT '文本内容或简述',
  `raw_plain_xml` MEDIUMTEXT NULL COMMENT '解密后的原始 XML（节选限制长度时可截断）',
  `msg_time` DATETIME NOT NULL COMMENT '消息创建时间（企微 CreateTime）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wcm_tenant_msg` (`tenant_id`, `msg_id`),
  KEY `idx_wcm_customer_time` (`tenant_id`, `customer_id`, `msg_time`),
  CONSTRAINT `fk_wcm_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wcm_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='企微会话消息存档';
