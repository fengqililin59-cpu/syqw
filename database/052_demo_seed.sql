SET NAMES utf8mb4;

-- 052: 演示租户 / 用户 / 客户种子（幂等）
-- 演示销售 id=9997（勿用 9999，避免与真实用户自增 ID 冲突）
-- 访客 id=9998；租户 id=9999

INSERT INTO tenants (id, name, is_demo, plan, status, max_users, created_at)
VALUES (9999, '中数云科演示企业', 1, 'pro', 1, 20, NOW())
ON DUPLICATE KEY UPDATE name='中数云科演示企业', is_demo=1, status=1;

INSERT INTO users (
  id, tenant_id, username, real_name, password_hash, demo_mode, role, status, created_at
) VALUES
  (9997, 9999, 'demo_sales', '张销售', 'DEMO_NOT_LOGIN', 1, 'sales', 1, NOW()),
  (9998, 9999, 'guest', '访客体验', 'GUEST_NOT_LOGIN', 1, 'sales', 1, NOW())
ON DUPLICATE KEY UPDATE
  tenant_id=9999, demo_mode=1, status=1,
  username=VALUES(username), real_name=VALUES(real_name);

-- 仅当演示租户尚无客户时插入（完整重种请用 099_demo_reseed_safe.sql）
SET @demo_customer_count := (
  SELECT COUNT(*) FROM customers WHERE tenant_id = 9999
);

DROP PROCEDURE IF EXISTS seed_demo_data;
DELIMITER $$
CREATE PROCEDURE seed_demo_data()
BEGIN
  IF @demo_customer_count = 0 THEN
    INSERT INTO customers (
      tenant_id, owner_id, name, company, position, phone, stage, intent_score,
      intent_tier, source, added_at, created_at
    ) VALUES
    (9999,9997,'王建国','星辰教育集团','校长','13800138001','intent',88,'高意向','广告投放',DATE_SUB(NOW(),INTERVAL 2 DAY),DATE_SUB(NOW(),INTERVAL 2 DAY)),
    (9999,9997,'李晓梅','启航素质教育','教务主任','13800138002','intent',82,'高意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 5 DAY),DATE_SUB(NOW(),INTERVAL 5 DAY)),
    (9999,9997,'张伟','北辰咨询','销售VP','13800138003','contacted',78,'高意向','渠道活码',DATE_SUB(NOW(),INTERVAL 3 DAY),DATE_SUB(NOW(),INTERVAL 3 DAY)),
    (9999,9997,'刘芳','海川供应链','采购总监','13800138004','contacted',74,'高意向','展会',DATE_SUB(NOW(),INTERVAL 12 DAY),DATE_SUB(NOW(),INTERVAL 12 DAY)),
    (9999,9997,'陈明','未来编程俱乐部','创始人','13800138005','intent',85,'高意向','渠道活码',DATE_SUB(NOW(),INTERVAL 2 DAY),DATE_SUB(NOW(),INTERVAL 2 DAY)),
    (9999,9997,'赵丽','悦己医美门诊','店长','13800138006','intent',80,'高意向','广告投放',DATE_SUB(NOW(),INTERVAL 7 DAY),DATE_SUB(NOW(),INTERVAL 7 DAY)),
    (9999,9997,'孙强','云启科技','CEO','13800138007','intent',86,'高意向','展会',DATE_SUB(NOW(),INTERVAL 4 DAY),DATE_SUB(NOW(),INTERVAL 4 DAY)),
    (9999,9997,'周静','花间美容会所','运营总监','13800138008','contacted',76,'高意向','广告投放',DATE_SUB(NOW(),INTERVAL 9 DAY),DATE_SUB(NOW(),INTERVAL 9 DAY)),
    (9999,9997,'吴磊','启明外语','招生主管','13800138009','contacted',55,'中意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 15 DAY),DATE_SUB(NOW(),INTERVAL 15 DAY)),
    (9999,9997,'郑秀','美莱轻医美','市场经理','13800138010','contacted',48,'中意向','展会',DATE_SUB(NOW(),INTERVAL 20 DAY),DATE_SUB(NOW(),INTERVAL 20 DAY)),
    (9999,9997,'冯涛','拓界软件','总经理','13800138011','new',52,'中意向','广告投放',DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_SUB(NOW(),INTERVAL 1 DAY)),
    (9999,9997,'蒋华','优品连锁','采购经理','13800138012','contacted',45,'中意向','渠道活码',DATE_SUB(NOW(),INTERVAL 18 DAY),DATE_SUB(NOW(),INTERVAL 18 DAY)),
    (9999,9997,'韩雪','童心托管','园长','13800138013','contacted',60,'中意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 11 DAY),DATE_SUB(NOW(),INTERVAL 11 DAY)),
    (9999,9997,'杨帆','清颜皮肤管理','顾问主管','13800138014','new',42,'中意向','短信营销',DATE_SUB(NOW(),INTERVAL 2 DAY),DATE_SUB(NOW(),INTERVAL 2 DAY)),
    (9999,9997,'朱敏','联创工贸','销售经理','13800138015','contacted',58,'中意向','展会',DATE_SUB(NOW(),INTERVAL 25 DAY),DATE_SUB(NOW(),INTERVAL 25 DAY)),
    (9999,9997,'秦莉','数联科技','运营总监','13800138016','contacted',50,'中意向','广告投放',DATE_SUB(NOW(),INTERVAL 14 DAY),DATE_SUB(NOW(),INTERVAL 14 DAY)),
    (9999,9997,'许波','远航汽配','采购总监','13800138017','new',38,'中意向','渠道活码',DATE_SUB(NOW(),INTERVAL 3 DAY),DATE_SUB(NOW(),INTERVAL 3 DAY)),
    (9999,9997,'何洁','家美家政','市场总监','13800138018','contacted',55,'中意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 30 DAY),DATE_SUB(NOW(),INTERVAL 30 DAY)),
    (9999,9997,'谢强','锐思智能','技术总监','13800138019','contacted',47,'中意向','广告投放',DATE_SUB(NOW(),INTERVAL 16 DAY),DATE_SUB(NOW(),INTERVAL 16 DAY)),
    (9999,9997,'邓芳','博雅培训','业务总监','13800138020','new',40,'中意向','展会',DATE_SUB(NOW(),INTERVAL 5 DAY),DATE_SUB(NOW(),INTERVAL 5 DAY)),
    (9999,9997,'曹阳','金桥地产','总裁','13800138021','deal',95,'高意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 45 DAY),DATE_SUB(NOW(),INTERVAL 45 DAY)),
    (9999,9997,'任娟','华信金融','总经理','13800138022','deal',92,'高意向','渠道活码',DATE_SUB(NOW(),INTERVAL 38 DAY),DATE_SUB(NOW(),INTERVAL 38 DAY)),
    (9999,9997,'范浩','迅达物流','采购总监','13800138023','deal',90,'高意向','展会',DATE_SUB(NOW(),INTERVAL 52 DAY),DATE_SUB(NOW(),INTERVAL 52 DAY)),
    (9999,9997,'唐静','美妆连锁总部','市场VP','13800138024','deal',88,'高意向','广告投放',DATE_SUB(NOW(),INTERVAL 60 DAY),DATE_SUB(NOW(),INTERVAL 60 DAY)),
    (9999,9997,'卢明','智学在线','CEO','13800138025','deal',94,'高意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 35 DAY),DATE_SUB(NOW(),INTERVAL 35 DAY)),
    (9999,9997,'薛涛','旧日贸易','采购经理','13800138026','lost',15,'低意向','广告投放',DATE_SUB(NOW(),INTERVAL 60 DAY),DATE_SUB(NOW(),INTERVAL 60 DAY)),
    (9999,9997,'侯雯','停滞制造','总经理','13800138027','lost',10,'低意向','展会',DATE_SUB(NOW(),INTERVAL 55 DAY),DATE_SUB(NOW(),INTERVAL 55 DAY)),
    (9999,9997,'崔磊','沉默零售','运营经理','13800138028','lost',8,'低意向','渠道活码',DATE_SUB(NOW(),INTERVAL 70 DAY),DATE_SUB(NOW(),INTERVAL 70 DAY)),
    (9999,9997,'毛静','流失餐饮','市场经理','13800138029','lost',12,'低意向','广告投放',DATE_SUB(NOW(),INTERVAL 65 DAY),DATE_SUB(NOW(),INTERVAL 65 DAY)),
    (9999,9997,'段芳','旁观科技','产品经理','13800138030','lost',5,'低意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 80 DAY),DATE_SUB(NOW(),INTERVAL 80 DAY));

    INSERT INTO customer_follow_ups (customer_id, user_id, type, content, created_at)
    SELECT c.id, 9997, 'other',
      CASE c.stage
        WHEN 'intent' THEN '客户对产品很感兴趣，询问了具体价格和实施周期，已发送方案'
        WHEN 'contacted' THEN '电话沟通20分钟，客户有明确需求，下周安排线下演示'
        WHEN 'deal' THEN '合同已签署，首款到账，安排实施对接'
        ELSE '初次联系，客户表示会考虑'
      END,
      DATE_ADD(c.created_at, INTERVAL 1 DAY)
    FROM customers c
    WHERE c.tenant_id = 9999 AND c.intent_score >= 60;

    INSERT INTO customer_follow_ups (customer_id, user_id, type, content, next_follow_at, created_at)
    SELECT c.id, 9997, 'other', '再次跟进，客户确认了预算，等待内部审批',
      DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)
    FROM customers c WHERE c.tenant_id = 9999 AND c.stage = 'intent';

    INSERT INTO customer_follow_ups (customer_id, user_id, type, content, next_follow_at, created_at)
    SELECT c.id, 9997, 'other', '客户有意向，需要再跟进确认具体时间安排',
      DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(),INTERVAL 2 DAY)
    FROM customers c
    WHERE c.tenant_id = 9999 AND c.stage = 'contacted' AND c.intent_score >= 70;

    INSERT IGNORE INTO intent_alerts (
      tenant_id, customer_id, owner_id, score_before, score_after, score_delta,
      ai_script, status, sent_at, created_at
    )
    SELECT
      9999, c.id, 9997,
      GREATEST(c.intent_score - 18, 0), c.intent_score, LEAST(c.intent_score, 18),
      CONCAT('您好 ', c.name, '，我是中数云科的顾问，看到您最近对我们的方案很感兴趣，想和您进一步沟通一下具体需求，方便的话今天下午有时间通话吗？'),
      'sent', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 3 HOUR)
    FROM customers c
    WHERE c.tenant_id = 9999 AND c.stage = 'intent'
    LIMIT 3;
  END IF;
END $$
DELIMITER ;

CALL seed_demo_data();
DROP PROCEDURE IF EXISTS seed_demo_data;

UPDATE users
SET role_id = (
  SELECT id FROM roles
  WHERE tenant_id = 9999 AND (name = '销售' OR name LIKE '%销售%')
  ORDER BY id ASC LIMIT 1
)
WHERE id IN (9997, 9998) AND tenant_id = 9999;
