-- Audio Notification System - Part 3: Database Functions
-- Run this AFTER Parts 1 and 2 complete successfully

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

-- Test the functions
SELECT 'Functions created successfully!' as status;
SELECT get_user_audio_preferences(123456789) as test_function;
