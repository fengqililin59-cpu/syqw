SET NAMES utf8mb4;

-- AI 专用套餐（站内 AI 助手，不依赖外部主站）
INSERT IGNORE INTO plans
(name, code, price_monthly, price_yearly,
 customers_limit, seats_limit,
 broadcasts_monthly, ai_calls_monthly,
 features, sort_order)
VALUES
('AI 助手版', 'ai_assistant', 199, 1990,
 2000, 10, 3000, 8000,
 JSON_ARRAY(
   'customer_manage', 'broadcast', 'channel_track', 'dashboard',
   'automation', 'ai_full', 'script_library', 'intent_alert'
 ), 25),
('AI 旗舰版', 'ai_assistant_pro', 499, 4990,
 10000, 30, 15000, 30000,
 JSON_ARRAY(
   'customer_manage', 'broadcast', 'channel_track', 'dashboard',
   'automation', 'ai_full', 'campaign', 'migration', 'intent_alert',
   'audit_log', 'script_library'
 ), 26);
