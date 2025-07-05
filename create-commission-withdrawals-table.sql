-- Create missing commission_withdrawals table for Aureus Telegram Bot
-- Run this in Supabase SQL Editor

-- Commission withdrawals table (for withdrawal request functionality)
CREATE TABLE IF NOT EXISTS commission_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  withdrawal_type VARCHAR(50) NOT NULL, -- 'usdt' or 'shares'
  amount DECIMAL(15,2) NOT NULL,
  wallet_address VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  admin_notes TEXT,
  processed_by INTEGER REFERENCES users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for commission_withdrawals table
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_user_id ON commission_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_status ON commission_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_type ON commission_withdrawals(withdrawal_type);
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_created ON commission_withdrawals(created_at);

-- Add comments for documentation
COMMENT ON TABLE commission_withdrawals IS 'Commission withdrawal requests from users';
COMMENT ON COLUMN commission_withdrawals.user_id IS 'Reference to users table';
COMMENT ON COLUMN commission_withdrawals.withdrawal_type IS 'Type of withdrawal: usdt or shares';
COMMENT ON COLUMN commission_withdrawals.amount IS 'Amount to withdraw';
COMMENT ON COLUMN commission_withdrawals.wallet_address IS 'User wallet address for USDT withdrawals';
COMMENT ON COLUMN commission_withdrawals.status IS 'Withdrawal status: pending, approved, rejected, completed';
COMMENT ON COLUMN commission_withdrawals.admin_notes IS 'Admin notes for withdrawal processing';
COMMENT ON COLUMN commission_withdrawals.processed_by IS 'Admin user who processed the withdrawal';

-- Test the table creation
SELECT 'commission_withdrawals table created successfully' AS result;
