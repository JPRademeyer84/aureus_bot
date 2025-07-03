-- Safe Schema Migration for Enhanced Admin System
-- This script safely updates the database without breaking existing foreign key relationships

-- Step 1: Create admin tables (these are new, so no conflicts)

-- Admin users table for multi-admin support
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_username VARCHAR(255) UNIQUE NOT NULL,
  telegram_id BIGINT UNIQUE,
  full_name VARCHAR(255),
  permission_level VARCHAR(50) DEFAULT 'sub_admin', -- 'main_admin', 'sub_admin'
  is_active BOOLEAN DEFAULT TRUE,
  created_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for admin_users table
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(telegram_username);
CREATE INDEX IF NOT EXISTS idx_admin_users_telegram_id ON admin_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

-- Admin audit logs table for comprehensive logging
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_telegram_id BIGINT NOT NULL,
  admin_username VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50), -- 'payment', 'user', 'admin', 'system'
  target_id VARCHAR(255), -- ID of the target (payment_id, user_id, etc.)
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for admin_audit_logs table
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_telegram_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_timestamp ON admin_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON admin_audit_logs(target_type, target_id);

-- Payment admin notes table
CREATE TABLE IF NOT EXISTS payment_admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  admin_telegram_id BIGINT NOT NULL,
  admin_username VARCHAR(255),
  note_type VARCHAR(50) DEFAULT 'general', -- 'approval', 'rejection', 'verification', 'general'
  note_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE, -- Internal notes vs notes shared with user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for payment_admin_notes table
CREATE INDEX IF NOT EXISTS idx_payment_admin_notes_payment_id ON payment_admin_notes(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_admin_notes_admin_id ON payment_admin_notes(admin_telegram_id);
CREATE INDEX IF NOT EXISTS idx_payment_admin_notes_type ON payment_admin_notes(note_type);

-- Step 2: Add new columns to existing tables (safe operations)

-- Add additional columns to crypto_payment_transactions for enhanced admin tracking
ALTER TABLE crypto_payment_transactions 
ADD COLUMN IF NOT EXISTS approved_by_admin_id BIGINT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejected_by_admin_id BIGINT,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending'; -- 'pending', 'verified', 'suspicious'

-- Step 3: Add unique constraint to investment_packages name (if it doesn't exist)
-- This is needed for safe upsert operations
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'investment_packages_name_key'
    ) THEN
        ALTER TABLE investment_packages ADD CONSTRAINT investment_packages_name_key UNIQUE (name);
    END IF;
END $$;

-- Step 4: Safely update investment packages without deleting existing data
-- This will update existing packages or insert new ones without breaking foreign keys

-- Insert or update the official 8 packages
INSERT INTO investment_packages (name, description, price, shares, roi, annual_dividends, quarter_dividends, bonuses) VALUES
('Shovel', 'Entry-level mining equipment package for new investors', 25.00, 5, 15.00, 3.75, 0.94, '["Welcome bonus", "Mining guide"]'::jsonb),
('Pick', 'Basic mining tools package for steady growth', 50.00, 10, 15.00, 7.50, 1.88, '["Mining guide", "Progress tracking"]'::jsonb),
('Miner', 'Professional miner package with enhanced returns', 75.00, 15, 15.00, 11.25, 2.81, '["Priority support", "Mining reports"]'::jsonb),
('Loader', 'Heavy equipment package for serious investors', 100.00, 20, 15.00, 15.00, 3.75, '["Priority support", "Quarterly reports"]'::jsonb),
('Excavator', 'Industrial excavation package with premium benefits', 250.00, 50, 15.00, 37.50, 9.38, '["VIP support", "Monthly reports", "Direct advisor access"]'::jsonb),
('Crusher', 'Rock crushing equipment for maximum efficiency', 500.00, 100, 15.00, 75.00, 18.75, '["VIP support", "Weekly reports", "Personal advisor"]'::jsonb),
('Refinery', 'Gold refining equipment for premium investors', 750.00, 150, 15.00, 112.50, 28.13, '["24/7 support", "Daily reports", "Dedicated advisor", "Exclusive events"]'::jsonb),
('Aureus', 'Ultimate gold mining package with maximum returns', 1000.00, 200, 15.00, 150.00, 37.50, '["24/7 support", "Real-time reports", "Dedicated advisor", "Exclusive events", "NFT certificate"]'::jsonb)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  shares = EXCLUDED.shares,
  roi = EXCLUDED.roi,
  annual_dividends = EXCLUDED.annual_dividends,
  quarter_dividends = EXCLUDED.quarter_dividends,
  bonuses = EXCLUDED.bonuses,
  updated_at = NOW();

-- Step 5: Insert main admin user (safe operation)
INSERT INTO admin_users (telegram_username, permission_level, is_active, created_at) 
VALUES ('TTTFOUNDER', 'main_admin', TRUE, NOW())
ON CONFLICT (telegram_username) DO NOTHING;

-- Step 6: Create foreign key constraint for payment_admin_notes (if crypto_payment_transactions exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crypto_payment_transactions') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'payment_admin_notes_payment_id_fkey'
        ) THEN
            ALTER TABLE payment_admin_notes 
            ADD CONSTRAINT payment_admin_notes_payment_id_fkey 
            FOREIGN KEY (payment_id) REFERENCES crypto_payment_transactions(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;
