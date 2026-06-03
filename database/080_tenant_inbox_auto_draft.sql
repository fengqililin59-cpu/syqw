-- Migration 080: 租户级收件箱 AI 自动草稿开关
-- 允许租户独立控制是否在新消息到达时自动生成 AI 草稿并尝试自动发送
-- 此前仅依赖全局环境变量 INBOX_AUTO_DRAFT，现改为租户级优先

ALTER TABLE tenants
  ADD COLUMN inbox_auto_draft_enabled TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '租户级收件箱自动草稿开关。开启后，新客户消息到达时自动生成AI回复草稿并尝试自动发送（需同时满足风险、护栏等条件）'
  AFTER inbox_ai_platform_disabled;

-- 索引：便于平台运营查询已开启此功能的租户
ALTER TABLE tenants
  ADD INDEX idx_inbox_auto_draft (inbox_auto_draft_enabled);
