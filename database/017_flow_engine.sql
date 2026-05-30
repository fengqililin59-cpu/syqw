-- 可视化流程引擎（MVP）：流程 / 节点 / 连线 / 运行实例
-- mysql ... < database/017_flow_engine.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `flows` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT 'draft / active / paused',
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_flows_tenant_status` (`tenant_id`, `status`),
  CONSTRAINT `fk_flows_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_flows_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='自动化流程';

CREATE TABLE IF NOT EXISTS `flow_nodes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `flow_id` BIGINT UNSIGNED NOT NULL,
  `node_key` VARCHAR(64) NOT NULL COMMENT '与画布节点 id 一致，便于连线',
  `type` VARCHAR(32) NOT NULL COMMENT 'trigger / condition / action / delay',
  `config` JSON NOT NULL,
  `position_x` INT NOT NULL DEFAULT 0,
  `position_y` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fn_flow_nodekey` (`flow_id`, `node_key`),
  KEY `idx_fn_flow` (`flow_id`),
  CONSTRAINT `fk_fn_flow` FOREIGN KEY (`flow_id`) REFERENCES `flows` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流程节点';

CREATE TABLE IF NOT EXISTS `flow_edges` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `flow_id` BIGINT UNSIGNED NOT NULL,
  `source_key` VARCHAR(64) NOT NULL,
  `target_key` VARCHAR(64) NOT NULL,
  `branch` VARCHAR(20) NULL DEFAULT NULL COMMENT 'yes / no / default / NULL',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fe_flow_src` (`flow_id`, `source_key`),
  CONSTRAINT `fk_fe_flow` FOREIGN KEY (`flow_id`) REFERENCES `flows` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流程连线';

CREATE TABLE IF NOT EXISTS `flow_runs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `flow_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'running' COMMENT 'running / waiting / completed / failed',
  `current_node_key` VARCHAR(64) NULL DEFAULT NULL,
  `context_json` JSON NULL,
  `next_run_at` DATETIME NULL DEFAULT NULL COMMENT 'delay 恢复时间',
  `error_message` VARCHAR(500) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fr_tenant_wait` (`tenant_id`, `status`, `next_run_at`),
  KEY `idx_fr_customer` (`tenant_id`, `customer_id`),
  CONSTRAINT `fk_fr_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fr_flow` FOREIGN KEY (`flow_id`) REFERENCES `flows` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fr_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流程运行实例';
