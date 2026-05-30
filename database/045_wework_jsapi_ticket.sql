SET NAMES utf8mb4;

ALTER TABLE wework_tokens
  ADD COLUMN IF NOT EXISTS jsapi_ticket VARCHAR(256) NULL AFTER expires_at,
  ADD COLUMN IF NOT EXISTS jsapi_ticket_expires_at DATETIME NULL AFTER jsapi_ticket,
  ADD COLUMN IF NOT EXISTS agent_jsapi_ticket VARCHAR(256) NULL AFTER jsapi_ticket_expires_at,
  ADD COLUMN IF NOT EXISTS agent_jsapi_ticket_expires_at DATETIME NULL AFTER agent_jsapi_ticket;
