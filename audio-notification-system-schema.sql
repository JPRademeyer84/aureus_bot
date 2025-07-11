-- Audio Notification System Database Schema
-- Complete implementation for user and admin audio notification preferences

-- Create user_notification_preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    
    -- General audio settings
    audio_enabled BOOLEAN DEFAULT true,
    notification_volume VARCHAR(10) DEFAULT 'medium', -- 'low', 'medium', 'high'
    
    -- User notification types
    payment_approval_audio BOOLEAN DEFAULT true,
    payment_rejection_audio BOOLEAN DEFAULT true,
    withdrawal_approval_audio BOOLEAN DEFAULT true,
    withdrawal_rejection_audio BOOLEAN DEFAULT true,
    commission_update_audio BOOLEAN DEFAULT true,
    referral_bonus_audio BOOLEAN DEFAULT true,
    system_announcement_audio BOOLEAN DEFAULT true,
    
    -- Notification timing preferences
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Advanced preferences
    custom_sound_enabled BOOLEAN DEFAULT false,
    notification_frequency VARCHAR(20) DEFAULT 'all', -- 'all', 'important', 'critical'
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one preference record per user
    UNIQUE(user_id),
    UNIQUE(telegram_id)
);

-- Create admin_notification_preferences table
CREATE TABLE IF NOT EXISTS admin_notification_preferences (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    
    -- General admin audio settings
    audio_enabled BOOLEAN DEFAULT true,
    notification_volume VARCHAR(10) DEFAULT 'high', -- Admins default to high volume
    
    -- Admin-specific notification types
    new_payment_audio BOOLEAN DEFAULT true,
    new_withdrawal_request_audio BOOLEAN DEFAULT true,
    new_commission_conversion_audio BOOLEAN DEFAULT true,
    system_error_audio BOOLEAN DEFAULT true,
    user_registration_audio BOOLEAN DEFAULT false,
    high_value_transaction_audio BOOLEAN DEFAULT true, -- Transactions above threshold
    
    -- Priority levels
    critical_alerts_audio BOOLEAN DEFAULT true,
    high_priority_audio BOOLEAN DEFAULT true,
    medium_priority_audio BOOLEAN DEFAULT true,
    low_priority_audio BOOLEAN DEFAULT false,
    
    -- Threshold settings
    high_value_threshold DECIMAL(15,2) DEFAULT 1000.00, -- Alert for transactions above this amount
    
    -- Timing preferences for admins
    quiet_hours_enabled BOOLEAN DEFAULT false, -- Admins may want 24/7 alerts
    quiet_hours_start TIME DEFAULT '23:00:00',
    quiet_hours_end TIME DEFAULT '07:00:00',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Advanced admin preferences
    escalation_enabled BOOLEAN DEFAULT true, -- Escalate if no response
    escalation_delay_minutes INTEGER DEFAULT 30,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one preference record per admin
    UNIQUE(admin_user_id),
    UNIQUE(telegram_id)
);

-- Create notification_log table for tracking and analytics
CREATE TABLE IF NOT EXISTS notification_log (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    user_id INTEGER REFERENCES users(id),

    -- Notification details
    notification_type VARCHAR(50) NOT NULL, -- 'payment_approval', 'withdrawal_request', etc.
    audio_type VARCHAR(20) NOT NULL, -- 'SUCCESS', 'ERROR', 'WARNING', etc.
    message_preview TEXT, -- First 100 chars of message

    -- Delivery details
    audio_enabled BOOLEAN NOT NULL,
    delivery_status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'queued'
    error_message TEXT,

    -- Timing
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,

    -- User interaction
    user_read BOOLEAN DEFAULT false,
    user_interacted BOOLEAN DEFAULT false, -- Clicked button, replied, etc.

    -- Metadata for analytics
    is_admin_notification BOOLEAN DEFAULT false,
    priority_level VARCHAR(20) DEFAULT 'medium' -- 'low', 'medium', 'high', 'critical'
);

-- Create indexes for notification_log table performance
CREATE INDEX IF NOT EXISTS idx_notification_log_telegram_id ON notification_log (telegram_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_user_id ON notification_log (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log (notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at ON notification_log (sent_at);

-- Create notification_sound_types table for customizable sounds
CREATE TABLE IF NOT EXISTS notification_sound_types (
    id SERIAL PRIMARY KEY,
    sound_name VARCHAR(50) NOT NULL UNIQUE,
    sound_emoji VARCHAR(10) NOT NULL,
    sound_description TEXT,
    category VARCHAR(30) NOT NULL, -- 'success', 'error', 'warning', 'info', 'payment'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Create function to get user audio preferences
CREATE OR REPLACE FUNCTION get_user_audio_preferences(p_telegram_id BIGINT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_preferences JSON;
BEGIN
    SELECT json_build_object(
        'audio_enabled', COALESCE(audio_enabled, true),
        'notification_volume', COALESCE(notification_volume, 'medium'),
        'payment_approval_audio', COALESCE(payment_approval_audio, true),
        'payment_rejection_audio', COALESCE(payment_rejection_audio, true),
        'withdrawal_approval_audio', COALESCE(withdrawal_approval_audio, true),
        'withdrawal_rejection_audio', COALESCE(withdrawal_rejection_audio, true),
        'commission_update_audio', COALESCE(commission_update_audio, true),
        'referral_bonus_audio', COALESCE(referral_bonus_audio, true),
        'system_announcement_audio', COALESCE(system_announcement_audio, true),
        'quiet_hours_enabled', COALESCE(quiet_hours_enabled, false),
        'quiet_hours_start', COALESCE(quiet_hours_start, '22:00:00'),
        'quiet_hours_end', COALESCE(quiet_hours_end, '08:00:00'),
        'timezone', COALESCE(timezone, 'UTC'),
        'notification_frequency', COALESCE(notification_frequency, 'all')
    )
    INTO v_preferences
    FROM user_notification_preferences
    WHERE telegram_id = p_telegram_id;
    
    -- If no preferences found, return defaults
    IF v_preferences IS NULL THEN
        v_preferences := json_build_object(
            'audio_enabled', true,
            'notification_volume', 'medium',
            'payment_approval_audio', true,
            'payment_rejection_audio', true,
            'withdrawal_approval_audio', true,
            'withdrawal_rejection_audio', true,
            'commission_update_audio', true,
            'referral_bonus_audio', true,
            'system_announcement_audio', true,
            'quiet_hours_enabled', false,
            'quiet_hours_start', '22:00:00',
            'quiet_hours_end', '08:00:00',
            'timezone', 'UTC',
            'notification_frequency', 'all'
        );
    END IF;
    
    RETURN v_preferences;
END;
$$;

-- Create function to update user audio preferences
CREATE OR REPLACE FUNCTION update_user_audio_preferences(
    p_telegram_id BIGINT,
    p_user_id INTEGER,
    p_preferences JSON
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_notification_preferences (
        user_id,
        telegram_id,
        audio_enabled,
        notification_volume,
        payment_approval_audio,
        payment_rejection_audio,
        withdrawal_approval_audio,
        withdrawal_rejection_audio,
        commission_update_audio,
        referral_bonus_audio,
        system_announcement_audio,
        quiet_hours_enabled,
        quiet_hours_start,
        quiet_hours_end,
        timezone,
        notification_frequency,
        updated_at
    ) VALUES (
        p_user_id,
        p_telegram_id,
        COALESCE((p_preferences->>'audio_enabled')::BOOLEAN, true),
        COALESCE(p_preferences->>'notification_volume', 'medium'),
        COALESCE((p_preferences->>'payment_approval_audio')::BOOLEAN, true),
        COALESCE((p_preferences->>'payment_rejection_audio')::BOOLEAN, true),
        COALESCE((p_preferences->>'withdrawal_approval_audio')::BOOLEAN, true),
        COALESCE((p_preferences->>'withdrawal_rejection_audio')::BOOLEAN, true),
        COALESCE((p_preferences->>'commission_update_audio')::BOOLEAN, true),
        COALESCE((p_preferences->>'referral_bonus_audio')::BOOLEAN, true),
        COALESCE((p_preferences->>'system_announcement_audio')::BOOLEAN, true),
        COALESCE((p_preferences->>'quiet_hours_enabled')::BOOLEAN, false),
        COALESCE((p_preferences->>'quiet_hours_start')::TIME, '22:00:00'),
        COALESCE((p_preferences->>'quiet_hours_end')::TIME, '08:00:00'),
        COALESCE(p_preferences->>'timezone', 'UTC'),
        COALESCE(p_preferences->>'notification_frequency', 'all'),
        NOW()
    )
    ON CONFLICT (telegram_id) DO UPDATE SET
        audio_enabled = COALESCE((p_preferences->>'audio_enabled')::BOOLEAN, user_notification_preferences.audio_enabled),
        notification_volume = COALESCE(p_preferences->>'notification_volume', user_notification_preferences.notification_volume),
        payment_approval_audio = COALESCE((p_preferences->>'payment_approval_audio')::BOOLEAN, user_notification_preferences.payment_approval_audio),
        payment_rejection_audio = COALESCE((p_preferences->>'payment_rejection_audio')::BOOLEAN, user_notification_preferences.payment_rejection_audio),
        withdrawal_approval_audio = COALESCE((p_preferences->>'withdrawal_approval_audio')::BOOLEAN, user_notification_preferences.withdrawal_approval_audio),
        withdrawal_rejection_audio = COALESCE((p_preferences->>'withdrawal_rejection_audio')::BOOLEAN, user_notification_preferences.withdrawal_rejection_audio),
        commission_update_audio = COALESCE((p_preferences->>'commission_update_audio')::BOOLEAN, user_notification_preferences.commission_update_audio),
        referral_bonus_audio = COALESCE((p_preferences->>'referral_bonus_audio')::BOOLEAN, user_notification_preferences.referral_bonus_audio),
        system_announcement_audio = COALESCE((p_preferences->>'system_announcement_audio')::BOOLEAN, user_notification_preferences.system_announcement_audio),
        quiet_hours_enabled = COALESCE((p_preferences->>'quiet_hours_enabled')::BOOLEAN, user_notification_preferences.quiet_hours_enabled),
        quiet_hours_start = COALESCE((p_preferences->>'quiet_hours_start')::TIME, user_notification_preferences.quiet_hours_start),
        quiet_hours_end = COALESCE((p_preferences->>'quiet_hours_end')::TIME, user_notification_preferences.quiet_hours_end),
        timezone = COALESCE(p_preferences->>'timezone', user_notification_preferences.timezone),
        notification_frequency = COALESCE(p_preferences->>'notification_frequency', user_notification_preferences.notification_frequency),
        updated_at = NOW();
    
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON admin_notification_preferences TO authenticated;
GRANT SELECT, INSERT ON notification_log TO authenticated;
GRANT SELECT ON notification_sound_types TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_audio_preferences(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_audio_preferences(BIGINT, INTEGER, JSON) TO authenticated;
