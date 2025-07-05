-- Add telegram_id column to users table
-- This allows direct Telegram authentication without requiring separate telegram_users table lookup

-- Add the telegram_id column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;

-- Create index for telegram_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

-- Optional: Make email and password_hash nullable since Telegram users don't need them
-- (Uncomment these lines if you want to make email/password optional for Telegram users)
-- ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
-- ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'telegram_id';
