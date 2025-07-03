-- Additional tables for the complete Aureus system

-- Enhanced Admin System Tables

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

-- Crypto payment transactions table
CREATE TABLE IF NOT EXISTS crypto_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_purchase_id UUID REFERENCES aureus_share_purchases(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USDT',
  network VARCHAR(50) NOT NULL, -- BSC, POL, TRON
  sender_wallet VARCHAR(255) NOT NULL,
  receiver_wallet VARCHAR(255) NOT NULL,
  transaction_hash VARCHAR(255) UNIQUE,
  screenshot_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, rejected
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for crypto_payment_transactions table
CREATE INDEX IF NOT EXISTS idx_crypto_payments_user_id ON crypto_payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_investment_id ON crypto_payment_transactions(share_purchase_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_status ON crypto_payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_hash ON crypto_payment_transactions(transaction_hash);

-- Add additional columns to crypto_payment_transactions for enhanced admin tracking
ALTER TABLE crypto_payment_transactions
ADD COLUMN IF NOT EXISTS approved_by_admin_id BIGINT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejected_by_admin_id BIGINT,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending'; -- 'pending', 'verified', 'suspicious'

-- Company wallets table (dynamic wallet addresses)
CREATE TABLE IF NOT EXISTS company_wallets (
  id SERIAL PRIMARY KEY,
  network VARCHAR(50) NOT NULL, -- BSC, POL, TRON
  currency VARCHAR(10) NOT NULL, -- USDT
  wallet_address VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_network_currency UNIQUE(network, currency)
);

-- Indexes for company_wallets table
CREATE INDEX IF NOT EXISTS idx_company_wallets_network ON company_wallets(network);
CREATE INDEX IF NOT EXISTS idx_company_wallets_active ON company_wallets(is_active);

-- Referrals table (sponsor-referral relationships)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 15.00,
  total_commission DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_referral UNIQUE(referrer_id, referred_id)
);

-- Indexes for referrals table
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- Commissions table (referral tracking)
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_purchase_id UUID NOT NULL REFERENCES aureus_share_purchases(id) ON DELETE CASCADE,
  commission_rate DECIMAL(5,2) DEFAULT 15.00,
  commission_amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, paid
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for commissions table
CREATE INDEX IF NOT EXISTS idx_commissions_referrer_id ON commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_commissions_referred_id ON commissions(referred_id);
CREATE INDEX IF NOT EXISTS idx_commissions_investment_id ON commissions(share_purchase_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

-- Share Purchase phases table (20-phase system)
CREATE TABLE IF NOT EXISTS share_purchase_phases (
  id SERIAL PRIMARY KEY,
  phase_number INTEGER UNIQUE NOT NULL,
  phase_name VARCHAR(100) NOT NULL,
  price_per_share DECIMAL(10,2) NOT NULL,
  total_shares_available INTEGER NOT NULL,
  shares_sold INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT FALSE,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for share_purchase_phases table
CREATE INDEX IF NOT EXISTS idx_investment_phases_number ON share_purchase_phases(phase_number);
CREATE INDEX IF NOT EXISTS idx_investment_phases_active ON share_purchase_phases(is_active);

-- Terms acceptance table
CREATE TABLE IF NOT EXISTS terms_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_type VARCHAR(50) NOT NULL, -- general, privacy, investment_risks, mining_operations, nft_terms, dividend_policy
  version VARCHAR(20) DEFAULT '1.0',
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Indexes for terms_acceptance table
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_user_id ON terms_acceptance(user_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_type ON terms_acceptance(terms_type);

-- User sessions table (for state management)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL,
  session_state VARCHAR(100),
  session_data JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user_sessions table
CREATE INDEX IF NOT EXISTS idx_user_sessions_telegram_id ON user_sessions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Update share packages with the official 8 packages (safe insert - will skip if already exists)
-- Note: This will only insert packages that don't already exist
INSERT INTO share_packages (name, description, price, shares, roi, annual_dividends, quarter_dividends, bonuses)
SELECT * FROM (VALUES
  ('Shovel', 'Entry-level mining equipment package for new shareholders', 25.00, 5, 15.00, 3.75, 0.94, '["Welcome bonus", "Mining guide"]'::jsonb),
  ('Pick', 'Basic mining tools package for steady growth', 50.00, 10, 15.00, 7.50, 1.88, '["Mining guide", "Progress tracking"]'::jsonb),
  ('Miner', 'Professional miner package with enhanced returns', 75.00, 15, 15.00, 11.25, 2.81, '["Priority support", "Mining reports"]'::jsonb),
  ('Loader', 'Heavy equipment package for serious shareholders', 100.00, 20, 15.00, 15.00, 3.75, '["Priority support", "Quarterly reports"]'::jsonb),
  ('Excavator', 'Industrial excavation package with premium benefits', 250.00, 50, 15.00, 37.50, 9.38, '["VIP support", "Monthly reports", "Direct advisor access"]'::jsonb),
  ('Crusher', 'Rock crushing equipment for maximum efficiency', 500.00, 100, 15.00, 75.00, 18.75, '["VIP support", "Weekly reports", "Personal advisor"]'::jsonb),
  ('Refinery', 'Gold refining equipment for premium shareholders', 750.00, 150, 15.00, 112.50, 28.13, '["24/7 support", "Daily reports", "Dedicated advisor", "Exclusive events"]'::jsonb),
  ('Aureus', 'Ultimate gold mining package with maximum returns', 1000.00, 200, 15.00, 150.00, 37.50, '["24/7 support", "Real-time reports", "Dedicated advisor", "Exclusive events", "NFT certificate"]'::jsonb)
) AS new_packages(name, description, price, shares, roi, annual_dividends, quarter_dividends, bonuses)
WHERE NOT EXISTS (
  SELECT 1 FROM share_packages WHERE share_packages.name = new_packages.name
);

-- Insert the 20-phase share purchase system (safe insert - will skip if already exists)
INSERT INTO share_purchase_phases (phase_number, phase_name, price_per_share, total_shares_available, is_active)
SELECT * FROM (VALUES
  (0, 'Pre Sale', 5.00, 200000, TRUE),
  (1, 'Phase 1', 10.00, 100000, FALSE),
  (2, 'Phase 2', 15.00, 100000, FALSE),
  (3, 'Phase 3', 20.00, 100000, FALSE),
  (4, 'Phase 4', 25.00, 100000, FALSE),
  (5, 'Phase 5', 30.00, 100000, FALSE),
  (6, 'Phase 6', 35.00, 100000, FALSE),
  (7, 'Phase 7', 40.00, 100000, FALSE),
  (8, 'Phase 8', 45.00, 100000, FALSE),
  (9, 'Phase 9', 50.00, 100000, FALSE),
  (10, 'Phase 10', 100.00, 50000, FALSE),
  (11, 'Phase 11', 200.00, 25000, FALSE),
  (12, 'Phase 12', 300.00, 25000, FALSE),
  (13, 'Phase 13', 400.00, 25000, FALSE),
  (14, 'Phase 14', 500.00, 25000, FALSE),
  (15, 'Phase 15', 600.00, 25000, FALSE),
  (16, 'Phase 16', 700.00, 25000, FALSE),
  (17, 'Phase 17', 800.00, 25000, FALSE),
  (18, 'Phase 18', 900.00, 25000, FALSE),
  (19, 'Phase 19', 1000.00, 25000, FALSE)
) AS new_phases(phase_number, phase_name, price_per_share, total_shares_available, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM share_purchase_phases WHERE share_purchase_phases.phase_number = new_phases.phase_number
);

-- Insert sample company wallet addresses
-- Insert company wallets (safe insert - will skip if already exists)
INSERT INTO company_wallets (network, currency, wallet_address, is_active)
SELECT * FROM (VALUES
  ('BSC', 'USDT', '0x742d35Cc6634C0532925a3b8D4C9db96590c6C89', TRUE),
  ('POL', 'USDT', '0x742d35Cc6634C0532925a3b8D4C9db96590c6C89', TRUE),
  ('TRON', 'USDT', 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', TRUE)
) AS new_wallets(network, currency, wallet_address, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM company_wallets
  WHERE company_wallets.network = new_wallets.network
  AND company_wallets.currency = new_wallets.currency
);

-- Insert main admin user (TTTFOUNDER) - safe insert
INSERT INTO admin_users (telegram_username, permission_level, is_active, created_at)
SELECT * FROM (VALUES
  ('TTTFOUNDER', 'main_admin', TRUE, NOW())
) AS new_admin(telegram_username, permission_level, is_active, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM admin_users WHERE admin_users.telegram_username = new_admin.telegram_username
);
