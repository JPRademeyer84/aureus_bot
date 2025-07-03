-- Commission System Overhaul - Database Schema Updates
-- This script creates the new tables for the dual commission structure and withdrawal system

-- Enhanced commissions table with dual commission tracking
CREATE TABLE IF NOT EXISTS commission_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usdt_balance DECIMAL(15,2) DEFAULT 0.00,
  share_balance DECIMAL(15,2) DEFAULT 0.00,
  total_earned_usdt DECIMAL(15,2) DEFAULT 0.00,
  total_earned_shares DECIMAL(15,2) DEFAULT 0.00,
  total_withdrawn_usdt DECIMAL(15,2) DEFAULT 0.00,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for commission_balances table
CREATE INDEX IF NOT EXISTS idx_commission_balances_user_id ON commission_balances(user_id);

-- Commission transactions table (detailed tracking of each commission)
CREATE TABLE IF NOT EXISTS commission_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_purchase_id UUID NOT NULL REFERENCES aureus_share_purchases(id) ON DELETE CASCADE,
  commission_rate DECIMAL(5,2) DEFAULT 15.00,
  share_purchase_amount DECIMAL(15,2) NOT NULL,
  usdt_commission DECIMAL(15,2) NOT NULL,
  share_commission DECIMAL(15,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, paid
  payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for commission_transactions table
CREATE INDEX IF NOT EXISTS idx_commission_transactions_referrer_id ON commission_transactions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_commission_transactions_referred_id ON commission_transactions(referred_id);
CREATE INDEX IF NOT EXISTS idx_commission_transactions_share_purchase_id ON commission_transactions(share_purchase_id);
CREATE INDEX IF NOT EXISTS idx_commission_transactions_status ON commission_transactions(status);
CREATE INDEX IF NOT EXISTS idx_commission_transactions_payment_date ON commission_transactions(payment_date);

-- Commission withdrawal requests table
CREATE TABLE IF NOT EXISTS commission_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  withdrawal_amount DECIMAL(15,2) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL,
  network VARCHAR(50) NOT NULL, -- BSC, POL, TRON
  currency VARCHAR(10) DEFAULT 'USDT',
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, paid
  admin_notes TEXT,
  approved_by_admin_id BIGINT,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by_admin_id BIGINT,
  rejected_at TIMESTAMP WITH TIME ZONE,
  paid_by_admin_id BIGINT,
  paid_at TIMESTAMP WITH TIME ZONE,
  transaction_hash VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for commission_withdrawal_requests table
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_user_id ON commission_withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_status ON commission_withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_network ON commission_withdrawal_requests(network);
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_created_at ON commission_withdrawal_requests(created_at);

-- Commission usage for share purchases table
CREATE TABLE IF NOT EXISTS commission_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_purchase_id UUID NOT NULL REFERENCES aureus_share_purchases(id) ON DELETE CASCADE,
  commission_amount_used DECIMAL(15,2) NOT NULL,
  remaining_payment_amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for commission_usage table
CREATE INDEX IF NOT EXISTS idx_commission_usage_user_id ON commission_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_usage_share_purchase_id ON commission_usage(share_purchase_id);

-- Daily commission processing log table
CREATE TABLE IF NOT EXISTS daily_commission_processing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processing_date DATE NOT NULL,
  total_commissions_processed INTEGER DEFAULT 0,
  total_usdt_amount DECIMAL(15,2) DEFAULT 0.00,
  total_share_amount DECIMAL(15,2) DEFAULT 0.00,
  processing_status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for daily_commission_processing table
CREATE INDEX IF NOT EXISTS idx_daily_commission_processing_date ON daily_commission_processing(processing_date);
CREATE INDEX IF NOT EXISTS idx_daily_commission_processing_status ON daily_commission_processing(processing_status);

-- Update existing commissions table to reference new share_purchase_id
-- Note: This is a safe update that adds the new column if it doesn't exist
ALTER TABLE commissions 
ADD COLUMN IF NOT EXISTS share_purchase_id UUID REFERENCES aureus_share_purchases(id) ON DELETE CASCADE;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_commissions_share_purchase_id ON commissions(share_purchase_id);

-- Commission settings table for configurable parameters
CREATE TABLE IF NOT EXISTS commission_settings (
  id SERIAL PRIMARY KEY,
  setting_name VARCHAR(100) UNIQUE NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  description TEXT,
  updated_by_admin_id BIGINT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default commission settings
INSERT INTO commission_settings (setting_name, setting_value, description) VALUES
('commission_rate_usdt', '15.00', 'USDT commission rate percentage'),
('commission_rate_shares', '15.00', 'Share commission rate percentage'),
('daily_processing_enabled', 'true', 'Enable daily commission processing'),
('minimum_withdrawal_amount', '10.00', 'Minimum USDT withdrawal amount'),
('withdrawal_fee_percentage', '0.00', 'Withdrawal fee percentage'),
('auto_approval_limit', '100.00', 'Auto-approve withdrawals under this amount')
ON CONFLICT (setting_name) DO NOTHING;

-- Indexes for commission_settings table
CREATE INDEX IF NOT EXISTS idx_commission_settings_name ON commission_settings(setting_name);

-- Create a view for easy commission balance queries
CREATE OR REPLACE VIEW user_commission_summary AS
SELECT 
  u.id as user_id,
  u.username,
  u.full_name,
  COALESCE(cb.usdt_balance, 0) as available_usdt,
  COALESCE(cb.share_balance, 0) as available_shares,
  COALESCE(cb.total_earned_usdt, 0) as total_earned_usdt,
  COALESCE(cb.total_earned_shares, 0) as total_earned_shares,
  COALESCE(cb.total_withdrawn_usdt, 0) as total_withdrawn_usdt,
  COALESCE(pending_withdrawals.pending_amount, 0) as pending_withdrawals,
  COALESCE(referral_count.total_referrals, 0) as total_referrals,
  COALESCE(active_referrals.active_referrals, 0) as active_referrals
FROM users u
LEFT JOIN commission_balances cb ON u.id = cb.user_id
LEFT JOIN (
  SELECT 
    user_id, 
    SUM(withdrawal_amount) as pending_amount
  FROM commission_withdrawal_requests 
  WHERE status IN ('pending', 'approved')
  GROUP BY user_id
) pending_withdrawals ON u.id = pending_withdrawals.user_id
LEFT JOIN (
  SELECT 
    referrer_id, 
    COUNT(*) as total_referrals
  FROM referrals 
  GROUP BY referrer_id
) referral_count ON u.id = referral_count.referrer_id
LEFT JOIN (
  SELECT 
    referrer_id, 
    COUNT(*) as active_referrals
  FROM referrals 
  WHERE status = 'active'
  GROUP BY referrer_id
) active_referrals ON u.id = active_referrals.referrer_id;

-- Function to update commission balances
CREATE OR REPLACE FUNCTION update_commission_balance(
  p_user_id INTEGER,
  p_usdt_amount DECIMAL(15,2),
  p_share_amount DECIMAL(15,2)
) RETURNS VOID AS $$
BEGIN
  INSERT INTO commission_balances (user_id, usdt_balance, share_balance, total_earned_usdt, total_earned_shares)
  VALUES (p_user_id, p_usdt_amount, p_share_amount, p_usdt_amount, p_share_amount)
  ON CONFLICT (user_id) DO UPDATE SET
    usdt_balance = commission_balances.usdt_balance + p_usdt_amount,
    share_balance = commission_balances.share_balance + p_share_amount,
    total_earned_usdt = commission_balances.total_earned_usdt + p_usdt_amount,
    total_earned_shares = commission_balances.total_earned_shares + p_share_amount,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to process commission withdrawal
CREATE OR REPLACE FUNCTION process_commission_withdrawal(
  p_user_id INTEGER,
  p_withdrawal_amount DECIMAL(15,2)
) RETURNS BOOLEAN AS $$
DECLARE
  current_balance DECIMAL(15,2);
BEGIN
  -- Get current USDT balance
  SELECT COALESCE(usdt_balance, 0) INTO current_balance
  FROM commission_balances
  WHERE user_id = p_user_id;
  
  -- Check if sufficient balance
  IF current_balance >= p_withdrawal_amount THEN
    -- Update balance
    UPDATE commission_balances
    SET 
      usdt_balance = usdt_balance - p_withdrawal_amount,
      total_withdrawn_usdt = total_withdrawn_usdt + p_withdrawal_amount,
      last_updated = NOW()
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;
