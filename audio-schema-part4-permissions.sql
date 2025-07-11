-- Audio Notification System - Part 4: Permissions
-- Run this AFTER Parts 1, 2, and 3 complete successfully

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON admin_notification_preferences TO authenticated;
GRANT SELECT, INSERT ON notification_log TO authenticated;
GRANT SELECT ON notification_sound_types TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_audio_preferences(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_audio_preferences(BIGINT, INTEGER, JSON) TO authenticated;

-- Grant sequence permissions (needed for SERIAL columns)
GRANT USAGE, SELECT ON SEQUENCE user_notification_preferences_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE admin_notification_preferences_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE notification_log_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE notification_sound_types_id_seq TO authenticated;

-- Verify permissions
SELECT 'Permissions granted successfully!' as status;

-- Final verification - check all tables exist
SELECT 
    table_name,
    CASE 
        WHEN table_name LIKE '%notification%' THEN '✅ Audio System Table'
        ELSE '📋 Other Table'
    END as table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'user_notification_preferences',
    'admin_notification_preferences', 
    'notification_log',
    'notification_sound_types'
)
ORDER BY table_name;

-- Show sample data
SELECT 'Sample sound types:' as info;
SELECT sound_name, sound_emoji FROM notification_sound_types LIMIT 5;
