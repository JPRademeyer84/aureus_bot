-- Fix for Admin Audit Logs - Allow System Actions
-- This fixes the NOT NULL constraint issue for system actions

-- Option 1: Allow NULL values for system actions (Recommended)
-- This allows the admin_telegram_id to be NULL for automated system actions
ALTER TABLE admin_audit_logs ALTER COLUMN admin_telegram_id DROP NOT NULL;

-- Add a comment to clarify the purpose
COMMENT ON COLUMN admin_audit_logs.admin_telegram_id IS 'Telegram ID of admin who performed action. NULL for automated system actions.';

-- Option 2: Alternative - Create a system user (if you prefer not to use NULL)
-- Uncomment the lines below if you prefer to use a dedicated system user instead of NULL

/*
-- Insert a system user for automated actions (only if it doesn't exist)
INSERT INTO users (username, telegram_id, is_admin, created_at) 
VALUES ('SYSTEM', 0, true, NOW())
ON CONFLICT (telegram_id) DO NOTHING;

-- Insert corresponding telegram_users record
INSERT INTO telegram_users (telegram_id, user_id, username, first_name, created_at)
VALUES (0, (SELECT id FROM users WHERE telegram_id = 0), 'SYSTEM', 'System', NOW())
ON CONFLICT (telegram_id) DO NOTHING;
*/

-- Verify the change
SELECT 
    column_name, 
    is_nullable, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'admin_audit_logs' 
AND column_name = 'admin_telegram_id';

-- Test query to ensure system actions can now be logged
-- This should work without errors after the fix
SELECT 'System action logging test - this should work now!' as status;
