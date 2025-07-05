-- Commission Withdrawal System Database Schema
-- Creates the commission_withdrawals table for managing withdrawal requests

-- Commission withdrawals table
CREATE TABLE IF NOT EXISTS commission_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  withdrawal_type VARCHAR(50) NOT NULL CHECK (withdrawal_type IN ('usdt', 'share_purchase')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  wallet_address VARCHAR(255), -- Required for USDT withdrawals, NULL for share purchases
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_notes TEXT,
  transaction_hash VARCHAR(255), -- Set when withdrawal is completed
  approved_by_admin_id BIGINT, -- Telegram ID of approving admin
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by_admin_id BIGINT, -- Telegram ID of rejecting admin
  rejected_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_user_id ON commission_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_status ON commission_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_created_at ON commission_withdrawals(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_commission_withdrawals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_commission_withdrawals_updated_at
  BEFORE UPDATE ON commission_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_withdrawals_updated_at();

-- Function to validate withdrawal amount against available balance
CREATE OR REPLACE FUNCTION validate_withdrawal_amount(
  p_user_id INTEGER,
  p_amount DECIMAL(15,2)
) RETURNS BOOLEAN AS $$
DECLARE
  available_balance DECIMAL(15,2);
BEGIN
  -- Get current USDT balance
  SELECT COALESCE(usdt_balance, 0) INTO available_balance
  FROM commission_balances
  WHERE user_id = p_user_id;
  
  -- Check if sufficient balance
  RETURN available_balance >= p_amount;
END;
$$ LANGUAGE plpgsql;

-- Function to process withdrawal approval
CREATE OR REPLACE FUNCTION process_withdrawal_approval(
  p_withdrawal_id UUID,
  p_admin_id BIGINT,
  p_admin_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  withdrawal_record RECORD;
BEGIN
  -- Get withdrawal details
  SELECT * INTO withdrawal_record
  FROM commission_withdrawals
  WHERE id = p_withdrawal_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Validate balance again
  IF NOT validate_withdrawal_amount(withdrawal_record.user_id, withdrawal_record.amount) THEN
    RETURN FALSE;
  END IF;
  
  -- Update withdrawal status
  UPDATE commission_withdrawals
  SET 
    status = 'approved',
    approved_by_admin_id = p_admin_id,
    approved_at = NOW(),
    admin_notes = p_admin_notes,
    updated_at = NOW()
  WHERE id = p_withdrawal_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to complete withdrawal and update balance
CREATE OR REPLACE FUNCTION complete_withdrawal(
  p_withdrawal_id UUID,
  p_transaction_hash VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
  withdrawal_record RECORD;
BEGIN
  -- Get withdrawal details
  SELECT * INTO withdrawal_record
  FROM commission_withdrawals
  WHERE id = p_withdrawal_id AND status = 'approved';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Update commission balance (deduct withdrawn amount)
  UPDATE commission_balances
  SET 
    usdt_balance = usdt_balance - withdrawal_record.amount,
    total_withdrawn_usdt = total_withdrawn_usdt + withdrawal_record.amount,
    last_updated = NOW()
  WHERE user_id = withdrawal_record.user_id;
  
  -- Mark withdrawal as completed
  UPDATE commission_withdrawals
  SET 
    status = 'completed',
    transaction_hash = p_transaction_hash,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_withdrawal_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for testing (optional)
-- INSERT INTO commission_withdrawals (user_id, withdrawal_type, amount, wallet_address, status)
-- VALUES (1, 'usdt', 50.00, 'TXYZabc123...', 'pending');
