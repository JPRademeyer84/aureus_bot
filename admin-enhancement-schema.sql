-- Enhanced Admin System Schema
-- This file contains the database schema updates for the enhanced admin payment approval system

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
  payment_id UUID NOT NULL REFERENCES crypto_payment_transactions(id) ON DELETE CASCADE,
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

-- Add additional columns to crypto_payment_transactions for enhanced tracking
ALTER TABLE crypto_payment_transactions 
ADD COLUMN IF NOT EXISTS approved_by_admin_id BIGINT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejected_by_admin_id BIGINT,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'suspicious'
ADD COLUMN IF NOT EXISTS requires_two_step_approval BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_step_approved_by BIGINT,
ADD COLUMN IF NOT EXISTS two_step_approved_at TIMESTAMP WITH TIME ZONE;

-- Insert main admin user (TTTFOUNDER)
INSERT INTO admin_users (telegram_username, permission_level, is_active, created_at) 
VALUES ('TTTFOUNDER', 'main_admin', TRUE, NOW())
ON CONFLICT (telegram_username) DO NOTHING;

-- Create view for payment approval dashboard
CREATE OR REPLACE VIEW payment_approval_dashboard AS
SELECT 
  cpt.*,
  u.email,
  u.full_name as user_full_name,
  tu.first_name as telegram_first_name,
  tu.last_name as telegram_last_name,
  tu.username as telegram_username,
  aa_approved.admin_username as approved_by_username,
  aa_rejected.admin_username as rejected_by_username,
  (
    SELECT COUNT(*) 
    FROM payment_admin_notes pan 
    WHERE pan.payment_id = cpt.id
  ) as notes_count
FROM crypto_payment_transactions cpt
LEFT JOIN users u ON cpt.user_id = u.id
LEFT JOIN telegram_users tu ON u.id = tu.user_id
LEFT JOIN admin_users aa_approved ON cpt.approved_by_admin_id = aa_approved.telegram_id
LEFT JOIN admin_users aa_rejected ON cpt.rejected_by_admin_id = aa_rejected.telegram_id;

-- Create function to automatically log payment status changes
CREATE OR REPLACE FUNCTION log_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when payment status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO admin_audit_logs (
      admin_telegram_id,
      admin_username,
      action,
      target_type,
      target_id,
      details
    ) VALUES (
      COALESCE(NEW.approved_by_admin_id, NEW.rejected_by_admin_id, 0),
      COALESCE(
        (SELECT telegram_username FROM admin_users WHERE telegram_id = NEW.approved_by_admin_id),
        (SELECT telegram_username FROM admin_users WHERE telegram_id = NEW.rejected_by_admin_id),
        'system'
      ),
      CASE 
        WHEN NEW.status = 'approved' THEN 'APPROVE_PAYMENT'
        WHEN NEW.status = 'rejected' THEN 'REJECT_PAYMENT'
        ELSE 'UPDATE_PAYMENT_STATUS'
      END,
      'payment',
      NEW.id::text,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'amount', NEW.amount,
        'currency', NEW.currency,
        'network', NEW.network
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment status changes
DROP TRIGGER IF EXISTS payment_status_change_trigger ON crypto_payment_transactions;
CREATE TRIGGER payment_status_change_trigger
  AFTER UPDATE ON crypto_payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_status_change();
