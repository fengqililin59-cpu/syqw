-- 099: 演示数据安全重种（仅 tenant_id=9999）
-- 演示销售用户固定 id=9997（避开真实账号可能占用的 9999）
-- 访客用户固定 id=9998；演示租户固定 id=9999
-- 用法：mysql ... < database/099_demo_reseed_safe.sql
-- 或：bash deploy/ecs_reseed_demo.sh

SET NAMES utf8mb4;

-- 1) 演示租户
INSERT INTO tenants (id, name, is_demo, plan, status, max_users, contact_name, contact_phone)
VALUES (9999, '中数云科演示企业', 1, 'pro', 1, 20, '演示管理员', '13800009999')
ON DUPLICATE KEY UPDATE
  name = '中数云科演示企业',
  is_demo = 1,
  status = 1;

-- 2) 演示销售（9997）与访客（9998）；绝不改动其他租户的用户
INSERT INTO users (id, tenant_id, username, real_name, password_hash, phone, demo_mode, role, status)
VALUES
  (9997, 9999, 'demo_sales', '张销售', 'DEMO_NOT_LOGIN', '13800009997', 1, 'sales', 1),
  (9998, 9999, 'guest', '访客体验', 'GUEST_NOT_LOGIN', NULL, 1, 'sales', 1)
ON DUPLICATE KEY UPDATE
  tenant_id = 9999,
  username = VALUES(username),
  real_name = VALUES(real_name),
  demo_mode = 1,
  status = 1,
  role = COALESCE(role, 'sales');

-- 3) 默认角色（有存储过程才执行）
-- 忽略错误：部分环境未导入 create_default_roles_for_tenant

-- 4) 清空演示租户业务数据（不影响租户 10000 等真实数据）
DELETE FROM intent_alerts WHERE tenant_id = 9999;
DELETE fu FROM customer_follow_ups fu
  INNER JOIN customers c ON c.id = fu.customer_id
  WHERE c.tenant_id = 9999;
DELETE FROM customers WHERE tenant_id = 9999;

-- 5) 客户：教培 / 美业 / B2B 混合，覆盖看板各阶段
INSERT INTO customers (
  tenant_id, owner_id, name, company, position, phone, stage, intent_score,
  intent_tier, source, added_at, last_contact_at, created_at, updated_at
) VALUES
-- 高意向 / 待成交（教培）
(9999,9997,'王建国','星辰教育集团','校长','13800138001','intent',88,'高意向','广告投放',DATE_SUB(NOW(),INTERVAL 2 DAY),DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_SUB(NOW(),INTERVAL 2 DAY),NOW()),
(9999,9997,'李晓梅','启航素质教育','教务主任','13800138002','intent',82,'高意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 5 DAY),DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_SUB(NOW(),INTERVAL 5 DAY),NOW()),
(9999,9997,'陈明','未来编程俱乐部','创始人','13800138005','intent',85,'高意向','渠道活码',DATE_SUB(NOW(),INTERVAL 3 DAY),DATE_SUB(NOW(),INTERVAL 6 HOUR),DATE_SUB(NOW(),INTERVAL 3 DAY),NOW()),
-- 高意向（美业）
(9999,9997,'赵丽','悦己医美门诊','店长','13800138006','intent',80,'高意向','广告投放',DATE_SUB(NOW(),INTERVAL 4 DAY),DATE_SUB(NOW(),INTERVAL 12 HOUR),DATE_SUB(NOW(),INTERVAL 4 DAY),NOW()),
(9999,9997,'周静','花间美容会所','运营总监','13800138008','contacted',76,'高意向','短信营销',DATE_SUB(NOW(),INTERVAL 6 DAY),DATE_SUB(NOW(),INTERVAL 2 DAY),DATE_SUB(NOW(),INTERVAL 6 DAY),NOW()),
-- 高意向（B2B）
(9999,9997,'孙强','云启科技有限公司','CEO','13800138007','intent',86,'高意向','展会',DATE_SUB(NOW(),INTERVAL 3 DAY),DATE_SUB(NOW(),INTERVAL 8 HOUR),DATE_SUB(NOW(),INTERVAL 3 DAY),NOW()),
(9999,9997,'张伟','北辰咨询','销售VP','13800138003','contacted',78,'高意向','渠道活码',DATE_SUB(NOW(),INTERVAL 7 DAY),DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_SUB(NOW(),INTERVAL 7 DAY),NOW()),
(9999,9997,'刘芳','海川供应链','采购总监','13800138004','contacted',74,'高意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 9 DAY),DATE_SUB(NOW(),INTERVAL 3 DAY),DATE_SUB(NOW(),INTERVAL 9 DAY),NOW()),

-- 中意向 / 跟进中
(9999,9997,'吴磊','启明外语','招生主管','13800138009','contacted',58,'中意向','广告投放',DATE_SUB(NOW(),INTERVAL 10 DAY),DATE_SUB(NOW(),INTERVAL 4 DAY),DATE_SUB(NOW(),INTERVAL 10 DAY),NOW()),
(9999,9997,'郑秀','美莱轻医美','市场经理','13800138010','contacted',55,'中意向','展会',DATE_SUB(NOW(),INTERVAL 12 DAY),DATE_SUB(NOW(),INTERVAL 5 DAY),DATE_SUB(NOW(),INTERVAL 12 DAY),NOW()),
(9999,9997,'冯涛','拓界软件','总经理','13800138011','new',52,'中意向','广告投放',DATE_SUB(NOW(),INTERVAL 1 DAY),NULL,DATE_SUB(NOW(),INTERVAL 1 DAY),NOW()),
(9999,9997,'蒋华','优品连锁','采购经理','13800138012','contacted',48,'中意向','渠道活码',DATE_SUB(NOW(),INTERVAL 14 DAY),DATE_SUB(NOW(),INTERVAL 6 DAY),DATE_SUB(NOW(),INTERVAL 14 DAY),NOW()),
(9999,9997,'韩雪','童心托管','园长','13800138013','contacted',60,'中意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 8 DAY),DATE_SUB(NOW(),INTERVAL 2 DAY),DATE_SUB(NOW(),INTERVAL 8 DAY),NOW()),
(9999,9997,'杨帆','清颜皮肤管理','顾问主管','13800138014','new',45,'中意向','短信营销',DATE_SUB(NOW(),INTERVAL 2 DAY),NULL,DATE_SUB(NOW(),INTERVAL 2 DAY),NOW()),
(9999,9997,'朱敏','联创工贸','销售经理','13800138015','contacted',57,'中意向','展会',DATE_SUB(NOW(),INTERVAL 18 DAY),DATE_SUB(NOW(),INTERVAL 7 DAY),DATE_SUB(NOW(),INTERVAL 18 DAY),NOW()),
(9999,9997,'秦莉','数联科技','运营总监','13800138016','contacted',50,'中意向','广告投放',DATE_SUB(NOW(),INTERVAL 11 DAY),DATE_SUB(NOW(),INTERVAL 4 DAY),DATE_SUB(NOW(),INTERVAL 11 DAY),NOW()),
(9999,9997,'许波','远航汽配','采购总监','13800138017','new',42,'中意向','渠道活码',DATE_SUB(NOW(),INTERVAL 3 DAY),NULL,DATE_SUB(NOW(),INTERVAL 3 DAY),NOW()),
(9999,9997,'何洁','家美家政','市场总监','13800138018','contacted',53,'中意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 20 DAY),DATE_SUB(NOW(),INTERVAL 8 DAY),DATE_SUB(NOW(),INTERVAL 20 DAY),NOW()),
(9999,9997,'谢强','锐思智能','技术总监','13800138019','contacted',47,'中意向','广告投放',DATE_SUB(NOW(),INTERVAL 15 DAY),DATE_SUB(NOW(),INTERVAL 5 DAY),DATE_SUB(NOW(),INTERVAL 15 DAY),NOW()),
(9999,9997,'邓芳','博雅培训','业务总监','13800138020','new',40,'中意向','展会',DATE_SUB(NOW(),INTERVAL 4 DAY),NULL,DATE_SUB(NOW(),INTERVAL 4 DAY),NOW()),

-- 已成交
(9999,9997,'曹阳','金桥地产','总裁','13800138021','deal',95,'高意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 45 DAY),DATE_SUB(NOW(),INTERVAL 10 DAY),DATE_SUB(NOW(),INTERVAL 45 DAY),NOW()),
(9999,9997,'任娟','华信金融','总经理','13800138022','deal',92,'高意向','渠道活码',DATE_SUB(NOW(),INTERVAL 38 DAY),DATE_SUB(NOW(),INTERVAL 12 DAY),DATE_SUB(NOW(),INTERVAL 38 DAY),NOW()),
(9999,9997,'范浩','迅达物流','采购总监','13800138023','deal',90,'高意向','展会',DATE_SUB(NOW(),INTERVAL 52 DAY),DATE_SUB(NOW(),INTERVAL 20 DAY),DATE_SUB(NOW(),INTERVAL 52 DAY),NOW()),
(9999,9997,'唐静','美妆连锁总部','市场VP','13800138024','deal',88,'高意向','广告投放',DATE_SUB(NOW(),INTERVAL 60 DAY),DATE_SUB(NOW(),INTERVAL 15 DAY),DATE_SUB(NOW(),INTERVAL 60 DAY),NOW()),
(9999,9997,'卢明','智学在线','CEO','13800138025','deal',94,'高意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 35 DAY),DATE_SUB(NOW(),INTERVAL 8 DAY),DATE_SUB(NOW(),INTERVAL 35 DAY),NOW()),

-- 流失
(9999,9997,'薛涛','旧日贸易','采购经理','13800138026','lost',15,'低意向','广告投放',DATE_SUB(NOW(),INTERVAL 60 DAY),DATE_SUB(NOW(),INTERVAL 40 DAY),DATE_SUB(NOW(),INTERVAL 60 DAY),NOW()),
(9999,9997,'侯雯','停滞制造','总经理','13800138027','lost',10,'低意向','展会',DATE_SUB(NOW(),INTERVAL 55 DAY),DATE_SUB(NOW(),INTERVAL 45 DAY),DATE_SUB(NOW(),INTERVAL 55 DAY),NOW()),
(9999,9997,'崔磊','沉默零售','运营经理','13800138028','lost',8,'低意向','渠道活码',DATE_SUB(NOW(),INTERVAL 70 DAY),DATE_SUB(NOW(),INTERVAL 50 DAY),DATE_SUB(NOW(),INTERVAL 70 DAY),NOW()),
(9999,9997,'毛静','流失餐饮','市场经理','13800138029','lost',12,'低意向','广告投放',DATE_SUB(NOW(),INTERVAL 65 DAY),DATE_SUB(NOW(),INTERVAL 48 DAY),DATE_SUB(NOW(),INTERVAL 65 DAY),NOW()),
(9999,9997,'段芳','旁观科技','产品经理','13800138030','lost',5,'低意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 80 DAY),DATE_SUB(NOW(),INTERVAL 60 DAY),DATE_SUB(NOW(),INTERVAL 80 DAY),NOW());

-- 6) 跟进记录（含逾期 next_follow_at → 待跟进列表有内容）
INSERT INTO customer_follow_ups (customer_id, user_id, type, content, created_at)
SELECT
  c.id,
  9997,
  'other',
  CASE c.stage
    WHEN 'intent' THEN CONCAT('【演示】', c.name, '对方案很感兴趣，已发报价，等待内部拍板')
    WHEN 'contacted' THEN CONCAT('【演示】已与', c.name, '电话沟通，确认需求，约本周演示')
    WHEN 'deal' THEN CONCAT('【演示】', c.name, '合同已签，首款到账，进入实施')
    WHEN 'lost' THEN CONCAT('【演示】', c.name, '选择暂缓，已标记流失原因：预算不足')
    ELSE CONCAT('【演示】初次联系', c.name, '，客户表示会考虑')
  END,
  DATE_ADD(c.created_at, INTERVAL 1 DAY)
FROM customers c
WHERE c.tenant_id = 9999;

-- intent：昨天到期 → 待跟进
INSERT INTO customer_follow_ups (customer_id, user_id, type, content, next_follow_at, created_at)
SELECT
  c.id, 9997, 'other',
  CONCAT('【待跟进】再次联系', c.name, '，确认预算与体验/演示时间'),
  DATE_SUB(NOW(), INTERVAL 1 DAY),
  DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM customers c
WHERE c.tenant_id = 9999 AND c.stage = 'intent';

-- 高分 contacted：2 天前到期
INSERT INTO customer_follow_ups (customer_id, user_id, type, content, next_follow_at, created_at)
SELECT
  c.id, 9997, 'other',
  CONCAT('【待跟进】', c.name, '有意向，需确认具体时间'),
  DATE_SUB(NOW(), INTERVAL 2 DAY),
  DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM customers c
WHERE c.tenant_id = 9999 AND c.stage = 'contacted' AND c.intent_score >= 70;

-- 今日到期（再造几条「今天必做」）
INSERT INTO customer_follow_ups (customer_id, user_id, type, content, next_follow_at, created_at)
SELECT
  c.id, 9997, 'other',
  CONCAT('【今日必做】回访', c.name, '，推进下一阶段'),
  DATE_ADD(CURDATE(), INTERVAL 10 HOUR),
  NOW()
FROM customers c
WHERE c.tenant_id = 9999 AND c.stage IN ('intent','contacted') AND c.intent_score >= 75
LIMIT 5;

-- 7) 意向预警（3 条高意向）
INSERT INTO intent_alerts (
  tenant_id, customer_id, owner_id, score_before, score_after, score_delta,
  ai_script, status, sent_at, created_at
)
SELECT
  9999,
  c.id,
  9997,
  GREATEST(c.intent_score - 18, 0),
  c.intent_score,
  LEAST(c.intent_score, 18),
  CONCAT(
    '您好', c.name, '，我是中数云科的顾问。看到您最近对我们的方案很感兴趣，',
    '想和您约 15 分钟确认一下需求和排期，您今天下午或明天上午哪个更方便？'
  ),
  'sent',
  DATE_SUB(NOW(), INTERVAL 2 HOUR),
  DATE_SUB(NOW(), INTERVAL 3 HOUR)
FROM customers c
WHERE c.tenant_id = 9999 AND c.stage = 'intent'
ORDER BY c.intent_score DESC
LIMIT 3;

-- 8) 访客角色（有销售角色则挂上）
UPDATE users u
SET u.role_id = (
  SELECT r.id FROM roles r
  WHERE r.tenant_id = 9999 AND (r.name = '销售' OR r.name LIKE '%销售%')
  ORDER BY r.id ASC LIMIT 1
)
WHERE u.id IN (9997, 9998) AND u.tenant_id = 9999;

SELECT 'demo_reseed_done' AS status,
  (SELECT COUNT(*) FROM customers WHERE tenant_id=9999) AS customers,
  (SELECT COUNT(*) FROM customer_follow_ups fu JOIN customers c ON c.id=fu.customer_id WHERE c.tenant_id=9999) AS follow_ups,
  (SELECT COUNT(*) FROM intent_alerts WHERE tenant_id=9999) AS alerts;
