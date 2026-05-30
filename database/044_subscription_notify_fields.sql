SET NAMES utf8mb4;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS expiry_notified_at DATETIME NULL
    AFTER cancelled_at;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS reminder_notified_at DATETIME NULL
    AFTER expiry_notified_at;
