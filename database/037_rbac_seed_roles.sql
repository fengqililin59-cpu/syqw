SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- RBAC Step 2 — 预设角色（幂等）+ 存储过程 + 存量补齐 ads:view
--
-- 依赖：database/036_rbac_permissions.sql
--
-- ① 存储过程 `create_default_roles_for_tenant`：新租户注册时由应用层 CALL（与中文「管理员」「销售」一致）
-- ② 条件 UPDATE：仅当销售系统角色 JSON 中尚无 ads:view 时补齐（perm_codes + permissions）
-- ③ 为所有租户 CALL 一次存储过程（仅插入缺失行，不重复）
-- ④ 用户 role / role_id 回填（与历史脚本行为一致）
-- ⑤ 文件末尾验证查询（执行后人工查看结果集）
-- ---------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS `create_default_roles_for_tenant`;

DELIMITER $$

CREATE PROCEDURE `create_default_roles_for_tenant`(IN `p_tenant_id` BIGINT UNSIGNED)
BEGIN
  -- 管理员（显式全量权限码，与 permissions 字典对齐）
  INSERT INTO `roles` (`tenant_id`, `name`, `is_system`, `perm_codes`, `permissions`, `description`)
  SELECT
    `p_tenant_id`,
    '管理员',
    1,
    JSON_ARRAY(
      'customer:view', 'customer:edit', 'customer:delete', 'customer:export', 'customer:import',
      'broadcast:view', 'broadcast:send',
      'campaign:view', 'campaign:manage',
      'automation:view', 'automation:manage',
      'ai:use', 'channel:view', 'channel:manage',
      'dashboard:view', 'ads:view',
      'settings:manage', 'audit:view', 'user:manage'
    ),
    JSON_ARRAY(
      'customer:view', 'customer:edit', 'customer:delete', 'customer:export', 'customer:import',
      'broadcast:view', 'broadcast:send',
      'campaign:view', 'campaign:manage',
      'automation:view', 'automation:manage',
      'ai:use', 'channel:view', 'channel:manage',
      'dashboard:view', 'ads:view',
      'settings:manage', 'audit:view', 'user:manage'
    ),
    '系统预设（全权限）'
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1 FROM `roles` AS `r`
    WHERE `r`.`tenant_id` = `p_tenant_id`
      AND `r`.`name` IN ('管理员', 'admin')
  );

  -- 销售（基础权限，含 ads:view）
  INSERT INTO `roles` (`tenant_id`, `name`, `is_system`, `perm_codes`, `permissions`, `description`)
  SELECT
    `p_tenant_id`,
    '销售',
    1,
    JSON_ARRAY(
      'customer:view', 'customer:edit',
      'broadcast:view', 'campaign:view',
      'automation:view', 'ai:use',
      'channel:view', 'dashboard:view', 'ads:view'
    ),
    JSON_ARRAY(
      'customer:view', 'customer:edit',
      'broadcast:view', 'campaign:view',
      'automation:view', 'ai:use',
      'channel:view', 'dashboard:view', 'ads:view'
    ),
    '系统预设（业务默认权限）'
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1 FROM `roles` AS `r`
    WHERE `r`.`tenant_id` = `p_tenant_id`
      AND `r`.`name` IN ('销售', 'sales')
  );
END$$

DELIMITER ;

-- ③ 对每个租户幂等补全缺失的默认角色（已存在则存储过程内部不插入）
DROP PROCEDURE IF EXISTS `_rbac_seed_default_roles_all_tenants`;

DELIMITER $$

CREATE PROCEDURE `_rbac_seed_default_roles_all_tenants`()
BEGIN
  DECLARE `done` INT DEFAULT 0;
  DECLARE `v_tid` BIGINT UNSIGNED;
  DECLARE `cur` CURSOR FOR SELECT `id` FROM `tenants`;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET `done` = 1;

  OPEN `cur`;
  `tenant_loop`: LOOP
    FETCH `cur` INTO `v_tid`;
    IF `done` = 1 THEN
      LEAVE `tenant_loop`;
    END IF;
    CALL `create_default_roles_for_tenant`(`v_tid`);
  END LOOP `tenant_loop`;
  CLOSE `cur`;
END$$

DELIMITER ;

CALL `_rbac_seed_default_roles_all_tenants`();

DROP PROCEDURE IF EXISTS `_rbac_seed_default_roles_all_tenants`;

-- ② 存量销售角色：仅缺 ads:view 时补齐（同时写 permissions，避免 ORM 读旧列不一致）
UPDATE `roles`
SET
  `perm_codes` = JSON_ARRAY(
    'customer:view', 'customer:edit',
    'broadcast:view', 'campaign:view',
    'automation:view', 'ai:use',
    'channel:view', 'dashboard:view', 'ads:view'
  ),
  `permissions` = JSON_ARRAY(
    'customer:view', 'customer:edit',
    'broadcast:view', 'campaign:view',
    'automation:view', 'ai:use',
    'channel:view', 'dashboard:view', 'ads:view'
  )
WHERE `name` = '销售'
  AND `is_system` = 1
  AND JSON_SEARCH(`perm_codes`, 'one', 'ads:view') IS NULL;

-- ④ 用户关联（幂等）
UPDATE `users` AS `u`
INNER JOIN `roles` AS `r`
  ON `r`.`tenant_id` = `u`.`tenant_id`
  AND `r`.`is_system` = 1
  AND (
    (`u`.`role` IN ('admin', '管理员') AND `r`.`name` IN ('管理员', 'admin'))
    OR (`u`.`role` IN ('sales', '销售') AND `r`.`name` IN ('销售', 'sales'))
  )
SET `u`.`role_id` = `r`.`id`
WHERE `u`.`role_id` IS NULL
  AND `u`.`role` IS NOT NULL
  AND `u`.`role` <> '';

UPDATE `users` AS `u`
INNER JOIN `roles` AS `r` ON `r`.`id` = `u`.`role_id`
SET `u`.`role` = CASE
  WHEN `r`.`name` IN ('管理员', 'admin') THEN 'admin'
  WHEN `r`.`name` IN ('销售', 'sales') THEN 'sales'
  ELSE `u`.`role`
END
WHERE (`u`.`role` IS NULL OR `u`.`role` = '')
  AND `u`.`role_id` IS NOT NULL;

-- ===========================================================================
-- ⑤ 验证（执行本文件后查看下面结果集）
-- ===========================================================================

-- 核查：所有销售系统角色都应能解析到 ads:view
SELECT
  `id`,
  `tenant_id`,
  `name`,
  JSON_SEARCH(`perm_codes`, 'one', 'ads:view') AS `has_ads_view`
FROM `roles`
WHERE `name` = '销售'
  AND `is_system` = 1;

-- 核查：未分配 role_id 的用户数（期望为 0）
SELECT COUNT(*) AS `users_without_role_id`
FROM `users`
WHERE `role_id` IS NULL;
