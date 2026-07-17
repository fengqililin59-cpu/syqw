-- 外呼方式新增「本机直接拨打」(native)，无需 TCCC
ALTER TABLE user_call_settings
  MODIFY dial_mode ENUM('phone', 'webrtc', 'native') NOT NULL DEFAULT 'native';

ALTER TABLE call_records
  MODIFY dial_mode ENUM('phone', 'webrtc', 'native') NOT NULL DEFAULT 'native';
