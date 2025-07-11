-- Audio Notification System - Part 2: Indexes and Default Data
-- Run this AFTER Part 1 completes successfully

-- Create indexes for notification_log table performance
CREATE INDEX IF NOT EXISTS idx_notification_log_telegram_id ON notification_log (telegram_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_user_id ON notification_log (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log (notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at ON notification_log (sent_at);

-- Insert default sound types
INSERT INTO notification_sound_types (sound_name, sound_emoji, sound_description, category) VALUES
('SUCCESS', '🔔', 'Success notification sound', 'success'),
('ERROR', '🚨', 'Error alert sound', 'error'),
('WARNING', '⚠️', 'Warning notification sound', 'warning'),
('INFO', 'ℹ️', 'Information notification sound', 'info'),
('PAYMENT', '💰', 'Payment notification sound', 'payment'),
('APPROVAL', '✅', 'Approval notification sound', 'success'),
('REJECTION', '❌', 'Rejection notification sound', 'error'),
('COMMISSION', '💎', 'Commission update sound', 'payment'),
('WITHDRAWAL', '💸', 'Withdrawal notification sound', 'payment'),
('SYSTEM', '🔧', 'System notification sound', 'info'),
('URGENT', '🚨', 'Urgent alert sound', 'error'),
('CELEBRATION', '🎉', 'Celebration sound for achievements', 'success')
ON CONFLICT (sound_name) DO NOTHING;

-- Verify data insertion
SELECT 'Default sound types inserted!' as status;
SELECT sound_name, sound_emoji, category FROM notification_sound_types ORDER BY sound_name;
