SET NAMES utf8mb4;

INSERT IGNORE INTO permissions (code, name, module, sort_order)
VALUES ('call:make', '发起电话外呼', 'customer', 60);

UPDATE roles
SET perm_codes = JSON_ARRAY_APPEND(perm_codes, '$', 'call:make')
WHERE name IN ('管理员', '销售')
  AND is_system = 1
  AND JSON_SEARCH(perm_codes, 'one', 'call:make') IS NULL;
