-- ============================================================
-- 100 美业增长闭环 P0：预约 / 卡项 / 消耗流水 / 服务记录
-- 详见 docs/product/beauty-growth-roadmap-zh.md
-- 设计原则：新增表为主，对已有表仅做可空列扩展，不破坏现有逻辑
-- 无外键约束（与生产环境既有风格一致），依赖应用层保证一致性
-- ============================================================

-- ------------------------------------------------------------
-- 1. 预约
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    customer_id     BIGINT       NOT NULL COMMENT '关联客户',
    staff_id        BIGINT       COMMENT '服务人员 users.id',
    product_id      BIGINT       COMMENT '预约项目 products.id',
    title           VARCHAR(200) NOT NULL COMMENT '项目名快照',
    start_at        DATETIME     NOT NULL COMMENT '预约开始时间',
    duration_min    SMALLINT UNSIGNED NOT NULL DEFAULT 60 COMMENT '时长(分钟)',
    status          VARCHAR(24)  NOT NULL DEFAULT 'booked'
                    COMMENT 'booked/arrived/completed/no_show/cancelled',
    source          VARCHAR(50)  COMMENT '来源：自助预约/员工代约/流程触发',
    arrived_at      DATETIME     COMMENT '实际到店时间',
    completed_at    DATETIME     COMMENT '服务完成时间',
    cancel_reason   VARCHAR(200) COMMENT '取消原因',
    remark          VARCHAR(500),
    metadata        JSON         COMMENT '行业扩展属性',
    created_by      BIGINT       COMMENT '创建人',
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_start (tenant_id, start_at),
    INDEX idx_tenant_customer (tenant_id, customer_id),
    INDEX idx_tenant_staff_start (tenant_id, staff_id, start_at),
    INDEX idx_tenant_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预约到店';

-- ------------------------------------------------------------
-- 2. 客户持卡（次卡 / 储值卡 / 期限卡）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_cards (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id         BIGINT       NOT NULL,
    customer_id       BIGINT       NOT NULL,
    product_id        BIGINT       COMMENT '关联卡项定义 products.id',
    order_id          BIGINT       COMMENT '关联 customer_orders.id',
    card_type         VARCHAR(24)  NOT NULL COMMENT 'times/stored/period',
    name              VARCHAR(200) NOT NULL COMMENT '卡名快照',
    total_times       INT          COMMENT '总次数(次卡)',
    remaining_times   INT          COMMENT '剩余次数',
    total_amount      DECIMAL(12,2) COMMENT '面值(储值卡)',
    remaining_amount  DECIMAL(12,2) COMMENT '余额',
    paid_amount       DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '实付金额，计入 LTV',
    valid_from        DATE,
    valid_until       DATE,
    status            VARCHAR(24)  NOT NULL DEFAULT 'active'
                      COMMENT 'active/used_up/expired/refunded/frozen',
    metadata          JSON,
    created_by        BIGINT,
    created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_customer_status (tenant_id, customer_id, status),
    INDEX idx_tenant_valid_until (tenant_id, valid_until),
    INDEX idx_tenant_status_times (tenant_id, status, remaining_times)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户持卡';

-- ------------------------------------------------------------
-- 3. 卡项消耗流水
--    手工调整(adjust)必须同时写入 audit_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_transactions (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    card_id         BIGINT       NOT NULL,
    customer_id     BIGINT       NOT NULL COMMENT '冗余，便于按客户查流水',
    appointment_id  BIGINT       COMMENT '关联到店',
    type            VARCHAR(24)  NOT NULL COMMENT 'consume/recharge/refund/adjust',
    times_delta     INT          COMMENT '次数变动，负数为消耗',
    amount_delta    DECIMAL(12,2) COMMENT '金额变动，负数为消耗',
    times_after     INT          COMMENT '变动后剩余次数快照，用于对账',
    amount_after    DECIMAL(12,2) COMMENT '变动后余额快照',
    reason          VARCHAR(200) COMMENT '手工调整必填',
    operator_id     BIGINT,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_card (tenant_id, card_id),
    INDEX idx_tenant_customer_time (tenant_id, customer_id, created_at),
    INDEX idx_tenant_type (tenant_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='卡项消耗流水';

-- ------------------------------------------------------------
-- 4. 服务记录（P0 建表，变美档案字段 P1 启用）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_records (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    customer_id     BIGINT       NOT NULL,
    appointment_id  BIGINT,
    staff_id        BIGINT       COMMENT '服务人员',
    product_id      BIGINT,
    served_at       DATETIME     NOT NULL,
    skin_profile    JSON         COMMENT '肤质/肤况（P1）',
    before_images   JSON         COMMENT '疗程前照（P1，需授权）',
    after_images    JSON         COMMENT '疗程后照（P1，需授权）',
    media_consent   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '影像使用授权，未授权禁止进入内容生成',
    notes           TEXT,
    created_by      BIGINT,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_customer_time (tenant_id, customer_id, served_at),
    INDEX idx_tenant_staff_time (tenant_id, staff_id, served_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务记录/变美档案';

-- ------------------------------------------------------------
-- 5. 服务人员排班（预约档期校验依赖）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_schedules (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT      NOT NULL,
    staff_id        BIGINT      NOT NULL,
    weekday         TINYINT     COMMENT '0-6，周期性排班；与 work_date 二选一',
    work_date       DATE        COMMENT '指定日期排班/休假，优先级高于 weekday',
    start_time      TIME        NOT NULL,
    end_time        TIME        NOT NULL,
    is_off          TINYINT(1)  NOT NULL DEFAULT 0 COMMENT '1=休息',
    created_at      DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_staff (tenant_id, staff_id),
    INDEX idx_tenant_date (tenant_id, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务人员排班';

-- ------------------------------------------------------------
-- 6. 已有表扩展（全部为可空新增列）
-- ------------------------------------------------------------
-- 幂等添加列与索引，可重复执行。
-- 刻意不使用存储过程：应用数据库账号通常没有 CREATE ROUTINE 权限
-- （生产 syqw_app 实测报 "alter routine command denied"）。
-- PREPARE/EXECUTE 只需普通 ALTER 权限。

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'next_appointment_at') > 0,
  'SELECT ''next_appointment_at 已存在''',
  'ALTER TABLE customers ADD COLUMN next_appointment_at DATETIME NULL COMMENT ''下次预约到店时间''');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'last_visit_at') > 0,
  'SELECT ''last_visit_at 已存在''',
  'ALTER TABLE customers ADD COLUMN last_visit_at DATETIME NULL COMMENT ''最近一次到店时间''');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'visit_count') > 0,
  'SELECT ''visit_count 已存在''',
  'ALTER TABLE customers ADD COLUMN visit_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''累计到店次数''');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'total_paid_amount') > 0,
  'SELECT ''total_paid_amount 已存在''',
  'ALTER TABLE customers ADD COLUMN total_paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT ''累计消费金额(LTV缓存)''');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_tenant_last_visit') > 0,
  'SELECT ''idx_tenant_last_visit 已存在''',
  'ALTER TABLE customers ADD INDEX idx_tenant_last_visit (tenant_id, last_visit_at)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_tenant_next_appt') > 0,
  'SELECT ''idx_tenant_next_appt 已存在''',
  'ALTER TABLE customers ADD INDEX idx_tenant_next_appt (tenant_id, next_appointment_at)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- ------------------------------------------------------------
-- 7. 权限码
-- ------------------------------------------------------------
-- 说明：perm_codes 存于 roles 表 JSON 字段，此处仅登记新增权限码供参考：
--   appointment:view   预约查看
--   appointment:edit   预约创建/修改/到店/核销
--   card:view          卡项查看
--   card:edit          开卡/充值/核销
--   card:adjust        手工调整余额与次数（默认仅店长/管理员）
--   cockpit:view       老板驾驶舱
-- 实际授予请在 roles 维护脚本中按租户角色追加。
