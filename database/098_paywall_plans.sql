SET NAMES utf8mb4;

-- 098: 付费墙重构 — 收紧体验版配额，区分付费专属 AI 能力，调整专业版/增长版定价

-- 体验版：仅手动 CRM + 基础群发，不含 AI 高级能力
UPDATE plans
SET
  customers_limit = 30,
  seats_limit = 1,
  broadcasts_monthly = 50,
  ai_calls_monthly = 20,
  features = JSON_ARRAY(
    'customer_manage',
    'dashboard',
    'channel_track',
    'broadcast'
  )
WHERE code = 'free';

-- 专业版：398/月，解锁全部 AI 与自动化
UPDATE plans
SET
  name = '专业版',
  price_monthly = 398.00,
  price_yearly = 3980.00,
  customers_limit = 5000,
  seats_limit = 20,
  broadcasts_monthly = 10000,
  ai_calls_monthly = 2000,
  features = JSON_ARRAY(
    'customer_manage',
    'broadcast',
    'channel_track',
    'dashboard',
    'automation',
    'ai_full',
    'campaign',
    'migration',
    'intent_alert',
    'audit_log',
    'ai_intent_score',
    'ai_coach_daily',
    'ads_roi',
    'archive_analysis'
  ),
  sort_order = 20
WHERE code = 'pro';

-- 增长版：998/月，含巨量表单 + AI 教练 + 多席位
INSERT INTO plans
  (name, code, price_monthly, price_yearly,
   customers_limit, seats_limit, broadcasts_monthly, ai_calls_monthly,
   features, sort_order, is_active)
VALUES
  ('增长版', 'growth', 998.00, 9980.00,
   20000, 50, 30000, 5000,
   JSON_ARRAY(
     'customer_manage',
     'broadcast',
     'channel_track',
     'dashboard',
     'automation',
     'ai_full',
     'campaign',
     'migration',
     'intent_alert',
     'audit_log',
     'ai_intent_score',
     'ai_coach_daily',
     'ads_roi',
     'archive_analysis',
     'ocean_lead',
     'script_library'
   ),
   25, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  price_monthly = VALUES(price_monthly),
  price_yearly = VALUES(price_yearly),
  customers_limit = VALUES(customers_limit),
  seats_limit = VALUES(seats_limit),
  broadcasts_monthly = VALUES(broadcasts_monthly),
  ai_calls_monthly = VALUES(ai_calls_monthly),
  features = VALUES(features),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);
