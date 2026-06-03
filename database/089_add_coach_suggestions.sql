-- ============================================================
-- 089: AI 教练建议系统
-- 存储 AI 生成的个性化教练建议，支持多维度分析和历史追踪
-- ============================================================

-- 教练建议表
CREATE TABLE IF NOT EXISTS `ai_coach_suggestions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL COMMENT '租户ID',
  `user_id` BIGINT NOT NULL COMMENT '目标员工ID',
  `coach_type` VARCHAR(32) NOT NULL COMMENT '建议维度：followup/call/deal/develop/time/overall',
  `title` VARCHAR(120) NOT NULL COMMENT '建议标题',
  `content` TEXT NOT NULL COMMENT 'AI 生成的教练建议正文',
  `context_data` JSON DEFAULT NULL COMMENT '生成时的指标快照：{today:{...}, kpi:{...}, rankings:[...], trend30:[...]}',
  `priority` TINYINT NOT NULL DEFAULT 3 COMMENT '优先级：1=紧急 2=重要 3=普通 4=建议',
  `status` VARCHAR(16) NOT NULL DEFAULT 'active' COMMENT '状态：active/dismissed/implemented',
  `impact_score` DECIMAL(5,2) DEFAULT NULL COMMENT '采纳后的改进效果分（由后续数据对比自动计算）',
  `generated_by` VARCHAR(64) DEFAULT NULL COMMENT '生成模型：deepseek-chat / gpt-4o 等',
  `generated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  `implemented_at` DATETIME DEFAULT NULL COMMENT '标记为已实施的时间',
  `dismissed_at` DATETIME DEFAULT NULL COMMENT '忽略时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_coach_tenant_user` (`tenant_id`, `user_id`),
  INDEX `idx_coach_type` (`tenant_id`, `coach_type`),
  INDEX `idx_coach_status` (`tenant_id`, `status`),
  INDEX `idx_coach_generated` (`generated_at` DESC),
  CONSTRAINT `fk_coach_sug_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_coach_sug_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 教练建议';
