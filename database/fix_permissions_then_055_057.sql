-- 补跑：先建 permissions（来自 036），再执行 055–057
-- 适用：bundle 054 已成功、在 055 INSERT 处报错 1146 的库
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `permissions` (
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `module` VARCHAR(32) NOT NULL,
  `sort_order` SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `permissions` (`code`, `name`, `module`, `sort_order`) VALUES
('customer:view',       '查看客户',       'customer',    10),
('customer:edit',       '编辑客户',       'customer',    20),
('customer:delete',     '删除客户',       'customer',    30),
('customer:export',     '导出客户',       'customer',    40),
('customer:import',     '导入客户',       'customer',    50),
('broadcast:view',      '查看群发',       'broadcast',   10),
('broadcast:send',      '创建/发送群发',  'broadcast',   20),
('campaign:view',       '查看裂变活动',   'campaign',    10),
('campaign:manage',     '管理裂变活动',   'campaign',    20),
('automation:view',     '查看自动化',     'automation',  10),
('automation:manage',     '管理自动化',     'automation',  20),
('ai:use',              '使用 AI 功能',   'ai',          10),
('channel:view',        '查看渠道追踪',   'channel',     10),
('channel:manage',      '管理渠道活码',   'channel',     20),
('dashboard:view',      '查看数据仪表盘', 'dashboard',  10),
('ads:view',            '查看广告 ROI',   'ads',         10),
('settings:manage',     '系统设置',       'settings',    10),
('audit:view',          '查看审计日志',   'settings',    20),
('user:manage',         '管理员工账号',   'settings',    30);

INSERT IGNORE INTO `permissions` (`code`, `name`, `module`, `sort_order`) VALUES
('inbox:view',   '查看统一收件箱', 'inbox', 10),
('inbox:reply',  '回复收件箱消息', 'inbox', 20),
('inbox:manage', '管理收件箱与知识库', 'inbox', 30),
('ai:approve',   '审核 AI 回复',     'ai',    20);

CREATE TABLE IF NOT EXISTS `customer_orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `order_no` VARCHAR(64) NULL DEFAULT NULL COMMENT '外部订单号',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'CNY',
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending' COMMENT 'pending/paid/shipped/completed/cancelled/refunded',
  `paid_at` DATETIME NULL DEFAULT NULL,
  `remark` VARCHAR(500) NULL DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_co_tenant_customer` (`tenant_id`, `customer_id`),
  KEY `idx_co_status` (`tenant_id`, `status`),
  CONSTRAINT `fk_co_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_co_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_tickets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `order_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `thread_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '来源收件箱会话',
  `type` VARCHAR(32) NOT NULL DEFAULT 'consultation' COMMENT 'consultation/refund/complaint/warranty/exchange',
  `priority` VARCHAR(16) NOT NULL DEFAULT 'normal' COMMENT 'low/normal/high/urgent',
  `status` VARCHAR(24) NOT NULL DEFAULT 'open' COMMENT 'open/in_progress/waiting_customer/resolved/closed',
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `resolution` TEXT NULL,
  `owner_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `resolved_at` DATETIME NULL DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_st_tenant_status` (`tenant_id`, `status`, `priority`),
  KEY `idx_st_customer` (`tenant_id`, `customer_id`),
  KEY `idx_st_owner` (`tenant_id`, `owner_id`),
  CONSTRAINT `fk_st_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_st_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_st_order` FOREIGN KEY (`order_id`) REFERENCES `customer_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_st_thread` FOREIGN KEY (`thread_id`) REFERENCES `inbox_threads` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_st_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `permissions` (`code`, `name`, `module`, `sort_order`) VALUES
('ticket:view',   '查看工单', 'ticket', 10),
('ticket:manage', '管理工单', 'ticket', 20),
('order:view',    '查看订单', 'order',  10),
('order:manage',  '管理订单', 'order',  20);
