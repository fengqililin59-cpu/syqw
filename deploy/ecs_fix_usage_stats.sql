-- usage_stats 补列（计费页 / payment/channels 依赖用量查询）
-- 幂等，库名默认 wework_saas
SET NAMES utf8mb4;

SET @db = 'wework_saas';

-- customers_count
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'usage_stats' AND COLUMN_NAME = 'customers_count');
SET @sql = IF(@c = 0,
  'ALTER TABLE usage_stats ADD COLUMN customers_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''客户数'' AFTER stat_month',
  'SELECT ''customers_count exists'' AS msg');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- seats_count
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'usage_stats' AND COLUMN_NAME = 'seats_count');
SET @sql = IF(@c = 0,
  'ALTER TABLE usage_stats ADD COLUMN seats_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''席位数'' AFTER customers_count',
  'SELECT ''seats_count exists'' AS msg');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- broadcasts_used
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'usage_stats' AND COLUMN_NAME = 'broadcasts_used');
SET @sql = IF(@c = 0,
  'ALTER TABLE usage_stats ADD COLUMN broadcasts_used INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''群发次数'' AFTER seats_count',
  'SELECT ''broadcasts_used exists'' AS msg');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ai_calls_used
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'usage_stats' AND COLUMN_NAME = 'ai_calls_used');
SET @sql = IF(@c = 0,
  'ALTER TABLE usage_stats ADD COLUMN ai_calls_used INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''AI调用次数'' AFTER broadcasts_used',
  'SELECT ''ai_calls_used exists'' AS msg');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT COLUMN_NAME FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'usage_stats'
  ORDER BY ORDINAL_POSITION;

SELECT '✅ usage_stats 列补全完成' AS status;
