SET NAMES utf8mb4;

-- 演示租户 / 用户基础数据（幂等）
-- 说明：id 为 AUTO_INCREMENT 时，显式列出 id 仍可手动插入固定值
INSERT IGNORE INTO tenants (id, name, is_demo, created_at)
VALUES (9999, 'ZhiFlow 演示企业', 1, NOW());

INSERT IGNORE INTO users (
  id, tenant_id, username, real_name, role, password_hash, status, created_at
)
VALUES (
  9999, 9999, 'demo_sales', '张销售', 'sales', 'DEMO_NOT_LOGIN', 1, NOW()
);

-- 防止重复执行插入重复客户：
-- 仅在 tenant_id=9999 没有任何 customers 时，才批量插入演示客户与演示记录
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
    -- 高意向客户 8 条
    (9999,9999,'王建国','深圳某科技有限公司','总经理','13800138001','intent',82,'高意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 5 DAY),DATE_SUB(NOW(),INTERVAL 5 DAY)),
    (9999,9999,'李晓梅','上海某贸易公司','采购总监','13800138002','intent',78,'高意向','广告投放',DATE_SUB(NOW(),INTERVAL 8 DAY),DATE_SUB(NOW(),INTERVAL 8 DAY)),
    (9999,9999,'张伟','北京某咨询公司','销售VP','13800138003','contacted',75,'高意向','渠道活码',DATE_SUB(NOW(),INTERVAL 3 DAY),DATE_SUB(NOW(),INTERVAL 3 DAY)),
    (9999,9999,'刘芳','广州某电商公司','运营总监','13800138004','contacted',71,'高意向','展会',DATE_SUB(NOW(),INTERVAL 12 DAY),DATE_SUB(NOW(),INTERVAL 12 DAY)),
    (9999,9999,'陈明','成都某教育机构','校长','13800138005','intent',88,'高意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 2 DAY),DATE_SUB(NOW(),INTERVAL 2 DAY)),
    (9999,9999,'赵丽','杭州某品牌公司','市场总监','13800138006','contacted',73,'高意向','短信营销',DATE_SUB(NOW(),INTERVAL 7 DAY),DATE_SUB(NOW(),INTERVAL 7 DAY)),
    (9999,9999,'孙强','武汉某制造企业','CEO','13800138007','intent',85,'高意向','渠道活码',DATE_SUB(NOW(),INTERVAL 4 DAY),DATE_SUB(NOW(),INTERVAL 4 DAY)),
    (9999,9999,'周静','南京某软件公司','产品总监','13800138008','contacted',70,'高意向','广告投放',DATE_SUB(NOW(),INTERVAL 9 DAY),DATE_SUB(NOW(),INTERVAL 9 DAY)),

    -- 中意向客户 12 条
    (9999,9999,'吴磊','苏州某外贸公司','业务经理','13800138009','contacted',55,'中意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 15 DAY),DATE_SUB(NOW(),INTERVAL 15 DAY)),
    (9999,9999,'郑秀','厦门某餐饮集团','运营总监','13800138010','contacted',48,'中意向','展会',DATE_SUB(NOW(),INTERVAL 20 DAY),DATE_SUB(NOW(),INTERVAL 20 DAY)),
    (9999,9999,'冯涛','青岛某物流公司','总经理','13800138011','new',52,'中意向','广告投放',DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_SUB(NOW(),INTERVAL 1 DAY)),
    (9999,9999,'蒋华','重庆某零售企业','采购经理','13800138012','contacted',45,'中意向','渠道活码',DATE_SUB(NOW(),INTERVAL 18 DAY),DATE_SUB(NOW(),INTERVAL 18 DAY)),
    (9999,9999,'韩雪','天津某医疗公司','市场经理','13800138013','contacted',60,'中意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 11 DAY),DATE_SUB(NOW(),INTERVAL 11 DAY)),
    (9999,9999,'杨帆','长沙某互联网公司','运营经理','13800138014','new',42,'中意向','短信营销',DATE_SUB(NOW(),INTERVAL 2 DAY),DATE_SUB(NOW(),INTERVAL 2 DAY)),
    (9999,9999,'朱敏','郑州某建材公司','销售经理','13800138015','contacted',58,'中意向','展会',DATE_SUB(NOW(),INTERVAL 25 DAY),DATE_SUB(NOW(),INTERVAL 25 DAY)),
    (9999,9999,'秦莉','西安某文化公司','总监','13800138016','contacted',50,'中意向','广告投放',DATE_SUB(NOW(),INTERVAL 14 DAY),DATE_SUB(NOW(),INTERVAL 14 DAY)),
    (9999,9999,'许波','沈阳某汽配公司','采购总监','13800138017','new',38,'中意向','渠道活码',DATE_SUB(NOW(),INTERVAL 3 DAY),DATE_SUB(NOW(),INTERVAL 3 DAY)),
    (9999,9999,'何洁','哈尔滨某食品公司','市场总监','13800138018','contacted',55,'中意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 30 DAY),DATE_SUB(NOW(),INTERVAL 30 DAY)),
    (9999,9999,'谢强','合肥某科技公司','技术总监','13800138019','contacted',47,'中意向','广告投放',DATE_SUB(NOW(),INTERVAL 16 DAY),DATE_SUB(NOW(),INTERVAL 16 DAY)),
    (9999,9999,'邓芳','福州某贸易公司','业务总监','13800138020','new',40,'中意向','展会',DATE_SUB(NOW(),INTERVAL 5 DAY),DATE_SUB(NOW(),INTERVAL 5 DAY)),

    -- 已成交客户 5 条
    (9999,9999,'曹阳','北京某地产公司','总裁','13800138021','deal',95,'高意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 45 DAY),DATE_SUB(NOW(),INTERVAL 45 DAY)),
    (9999,9999,'任娟','上海某金融公司','总经理','13800138022','deal',92,'高意向','渠道活码',DATE_SUB(NOW(),INTERVAL 38 DAY),DATE_SUB(NOW(),INTERVAL 38 DAY)),
    (9999,9999,'范浩','深圳某供应链公司','采购总监','13800138023','deal',90,'高意向','展会',DATE_SUB(NOW(),INTERVAL 52 DAY),DATE_SUB(NOW(),INTERVAL 52 DAY)),
    (9999,9999,'唐静','广州某品牌公司','市场VP','13800138024','deal',88,'高意向','广告投放',DATE_SUB(NOW(),INTERVAL 60 DAY),DATE_SUB(NOW(),INTERVAL 60 DAY)),
    (9999,9999,'卢明','杭州某科技公司','CEO','13800138025','deal',94,'高意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 35 DAY),DATE_SUB(NOW(),INTERVAL 35 DAY)),

    -- 流失客户 5 条
    (9999,9999,'薛涛','成都某贸易公司','采购经理','13800138026','lost',15,'低意向','广告投放',DATE_SUB(NOW(),INTERVAL 60 DAY),DATE_SUB(NOW(),INTERVAL 60 DAY)),
    (9999,9999,'侯雯','武汉某制造企业','总经理','13800138027','lost',10,'低意向','展会',DATE_SUB(NOW(),INTERVAL 55 DAY),DATE_SUB(NOW(),INTERVAL 55 DAY)),
    (9999,9999,'崔磊','南京某零售公司','运营经理','13800138028','lost',8,'低意向','渠道活码',DATE_SUB(NOW(),INTERVAL 70 DAY),DATE_SUB(NOW(),INTERVAL 70 DAY)),
    (9999,9999,'毛静','西安某餐饮公司','市场经理','13800138029','lost',12,'低意向','广告投放',DATE_SUB(NOW(),INTERVAL 65 DAY),DATE_SUB(NOW(),INTERVAL 65 DAY)),
    (9999,9999,'段芳','沈阳某科技公司','产品经理','13800138030','lost',5,'低意向','朋友介绍',DATE_SUB(NOW(),INTERVAL 80 DAY),DATE_SUB(NOW(),INTERVAL 80 DAY));

    -- 演示跟进记录（基于已插入 customers，不指定 id）
    INSERT INTO customer_follow_ups (customer_id, user_id, type, content, created_at)
    SELECT
      c.id,
      9999,
      'other',
      CASE c.stage
        WHEN 'intent' THEN '客户对产品很感兴趣，询问了具体价格和实施周期，已发送方案'
        WHEN 'contacted' THEN '电话沟通20分钟，客户有明确需求，下周安排线下演示'
        WHEN 'deal' THEN '合同已签署，首款到账，安排实施对接'
        ELSE '初次联系，客户表示会考虑'
      END,
      DATE_ADD(c.created_at, INTERVAL 1 DAY)
    FROM customers c
    WHERE c.tenant_id = 9999
      AND c.intent_score >= 60;

    -- intent 客户：设置逾期跟进（next_follow_at 在昨天）→ 待跟进列表可见
    INSERT INTO customer_follow_ups (customer_id, user_id, type, content, next_follow_at, created_at)
    SELECT
      c.id,
      9999,
      'other',
      '再次跟进，客户确认了预算，等待内部审批',
      DATE_SUB(NOW(), INTERVAL 1 DAY),
      DATE_SUB(NOW(), INTERVAL 1 DAY)
    FROM customers c
    WHERE c.tenant_id = 9999
      AND c.stage = 'intent';

    -- contacted 客户：插入单条逾期跟进（2 天前到期）
    INSERT INTO customer_follow_ups (customer_id, user_id, type, content, next_follow_at, created_at)
    SELECT
      c.id,
      9999,
      'other',
      '客户有意向，需要再跟进确认具体时间安排',
      DATE_SUB(NOW(), INTERVAL 2 DAY),
      DATE_SUB(NOW(), INTERVAL 2 DAY)
    FROM customers c
    WHERE c.tenant_id = 9999
      AND c.stage = 'contacted'
      AND c.intent_score >= 70;

    -- 演示意向预警（3 条）
    -- NOTE: 后续可将 ai_script 升级为更自然的多模板话术，以提升演示真实感（下次重置演示数据时再替换）
    INSERT IGNORE INTO intent_alerts (
      tenant_id, customer_id, owner_id, score_before, score_after, score_delta,
      ai_script, status, sent_at, created_at
    )
    SELECT
      9999,
      c.id,
      9999,
      GREATEST(c.intent_score - 18, 0),
      c.intent_score,
      LEAST(c.intent_score, 18),
      CONCAT('您好 ', c.name, '，我是ZhiFlow的顾问，看到您最近对我们的方案很感兴趣，想和您进一步沟通一下具体需求，方便的话今天下午有时间通话吗？'),
      'sent',
      DATE_SUB(NOW(), INTERVAL 2 HOUR),
      DATE_SUB(NOW(), INTERVAL 3 HOUR)
    FROM customers c
    WHERE c.tenant_id = 9999
      AND c.stage = 'intent'
    LIMIT 3;
  END IF;
END $$
DELIMITER ;

CALL seed_demo_data();
DROP PROCEDURE IF EXISTS seed_demo_data;

-- 访客账号（供未注册用户直接体验）
INSERT IGNORE INTO users (
  id, tenant_id, username, real_name,
  role, password_hash, demo_mode,
  status, created_at
) VALUES (
  9998, 9999, 'guest', '访客体验',
  'sales', 'GUEST_NOT_LOGIN', 1, 1, NOW()
);

-- 给访客账号分配销售角色
UPDATE users
SET role_id = (
  SELECT id FROM roles
  WHERE tenant_id = 9999
    AND name = '销售'
  LIMIT 1
)
WHERE id = 9998;
