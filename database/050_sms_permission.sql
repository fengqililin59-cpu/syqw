SET NAMES utf8mb4;

INSERT IGNORE INTO permissions (code, name, module, sort_order)
VALUES ('sms:send', '发送短信', 'broadcast', 30);

UPDATE roles
SET perm_codes = JSON_ARRAY_APPEND(perm_codes, '$', 'sms:send')
WHERE name IN ('管理员', '销售')
  AND is_system = 1
  AND JSON_SEARCH(perm_codes, 'one', 'sms:send') IS NULL;
