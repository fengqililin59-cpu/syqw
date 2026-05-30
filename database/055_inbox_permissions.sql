-- 收件箱 / AI 审核权限点（幂等）
SET NAMES utf8mb4;

INSERT IGNORE INTO `permissions` (`code`, `name`, `module`, `sort_order`) VALUES
('inbox:view',   '查看统一收件箱', 'inbox', 10),
('inbox:reply',  '回复收件箱消息', 'inbox', 20),
('inbox:manage', '管理收件箱与知识库', 'inbox', 30),
('ai:approve',   '审核 AI 回复',     'ai',    20);
