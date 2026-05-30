SET NAMES utf8mb4;

INSERT IGNORE INTO `permissions` (`code`, `name`, `module`, `sort_order`) VALUES
('ticket:view',   '查看工单', 'ticket', 10),
('ticket:manage', '管理工单', 'ticket', 20),
('order:view',    '查看订单', 'order',  10),
('order:manage',  '管理订单', 'order',  20);
