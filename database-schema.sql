-- =====================================================
-- Aureus Telegram Bot Database Schema
-- =====================================================

-- Test connection table
CREATE TABLE IF NOT EXISTS test_connection (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (main user accounts)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Telegram users table (links Telegram accounts to main users)
CREATE TABLE IF NOT EXISTS telegram_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  is_registered BOOLEAN DEFAULT FALSE,
  registration_step VARCHAR(50) DEFAULT 'start',
  registration_mode VARCHAR(20) DEFAULT 'login',
  temp_email VARCHAR(255),
  temp_password VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for telegram_users table
CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON telegram_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id ON telegram_users(user_id);

-- Telegram sessions table (for bot session management)
CREATE TABLE IF NOT EXISTS telegram_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL,
  session_data TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for telegram_sessions table
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_telegram_id ON telegram_sessions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_expires_at ON telegram_sessions(expires_at);

-- Investment packages table (renamed to share packages in user interface)
CREATE TABLE IF NOT EXISTS investment_packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(15,2) NOT NULL,
  shares INTEGER NOT NULL,
  roi DECIMAL(10,2) DEFAULT 0,
  annual_dividends DECIMAL(15,2) DEFAULT 0,
  quarter_dividends DECIMAL(15,2) DEFAULT 0,
  bonuses JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for investment_packages table
CREATE INDEX IF NOT EXISTS idx_investment_packages_active ON investment_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_investment_packages_price ON investment_packages(price);

-- Investments table (user investments)
CREATE TABLE IF NOT EXISTS aureus_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id INTEGER NOT NULL REFERENCES investment_packages(id) ON DELETE RESTRICT,
  amount DECIMAL(15,2) NOT NULL,
  shares INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(100),
  payment_reference VARCHAR(255),
  payment_proof_url VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for aureus_investments table
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON aureus_investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_package_id ON aureus_investments(package_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON aureus_investments(status);
CREATE INDEX IF NOT EXISTS idx_investments_created_at ON aureus_investments(created_at);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES aureus_investments(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  payment_method VARCHAR(100) NOT NULL,
  payment_reference VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  gateway_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for payments table
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_investment_id ON payments(investment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

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
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- Certificates table (for NFT certificates)
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  investment_id UUID NOT NULL REFERENCES aureus_investments(id) ON DELETE CASCADE,
  certificate_number VARCHAR(100) UNIQUE NOT NULL,
  certificate_type VARCHAR(50) DEFAULT 'investment',
  certificate_url VARCHAR(500),
  nft_token_id VARCHAR(255),
  nft_contract_address VARCHAR(255),
  blockchain_network VARCHAR(50) DEFAULT 'ethereum',
  metadata JSONB,
  is_minted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for certificates table
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_investment_id ON certificates(investment_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_nft_token ON certificates(nft_token_id);

-- Crypto payment transactions table
CREATE TABLE IF NOT EXISTS crypto_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES aureus_investments(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_crypto_payments_investment_id ON crypto_payment_transactions(investment_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_status ON crypto_payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_hash ON crypto_payment_transactions(transaction_hash);

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

-- Commissions table (referral tracking)
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  investment_id UUID NOT NULL REFERENCES aureus_investments(id) ON DELETE CASCADE,
  commission_rate DECIMAL(5,2) DEFAULT 15.00,
  commission_amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, paid
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for commissions table
CREATE INDEX IF NOT EXISTS idx_commissions_referrer_id ON commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_commissions_referred_id ON commissions(referred_id);
CREATE INDEX IF NOT EXISTS idx_commissions_investment_id ON commissions(investment_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

-- Enhanced Commission System Tables

-- Commission balances table for dual commission tracking
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
  share_purchase_id UUID NOT NULL REFERENCES aureus_investments(id) ON DELETE CASCADE,
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
  share_purchase_id UUID NOT NULL REFERENCES aureus_investments(id) ON DELETE CASCADE,
  commission_amount_used DECIMAL(15,2) NOT NULL,
  remaining_payment_amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for commission_usage table
CREATE INDEX IF NOT EXISTS idx_commission_usage_user_id ON commission_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_usage_share_purchase_id ON commission_usage(share_purchase_id);

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

-- Indexes for commission_settings table
CREATE INDEX IF NOT EXISTS idx_commission_settings_name ON commission_settings(setting_name);

-- Investment phases table (20-phase system)
CREATE TABLE IF NOT EXISTS investment_phases (
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

-- Indexes for investment_phases table
CREATE INDEX IF NOT EXISTS idx_investment_phases_number ON investment_phases(phase_number);
CREATE INDEX IF NOT EXISTS idx_investment_phases_active ON investment_phases(is_active);

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

-- =====================================================
-- Sample Data (Optional)
-- =====================================================

-- Insert the 8 official investment packages from telegram.md
INSERT INTO investment_packages (name, description, price, shares, roi, annual_dividends, quarter_dividends, bonuses) VALUES
('Shovel', 'Entry-level mining equipment package for new investors', 25.00, 5, 15.00, 3.75, 0.94, '["Welcome bonus", "Mining guide"]'::jsonb),
('Pick', 'Basic mining tools package for steady growth', 50.00, 10, 15.00, 7.50, 1.88, '["Mining guide", "Progress tracking"]'::jsonb),
('Miner', 'Professional miner package with enhanced returns', 75.00, 15, 15.00, 11.25, 2.81, '["Priority support", "Mining reports"]'::jsonb),
('Loader', 'Heavy equipment package for serious investors', 100.00, 20, 15.00, 15.00, 3.75, '["Priority support", "Quarterly reports"]'::jsonb),
('Excavator', 'Industrial excavation package with premium benefits', 250.00, 50, 15.00, 37.50, 9.38, '["VIP support", "Monthly reports", "Direct advisor access"]'::jsonb),
('Crusher', 'Rock crushing equipment for maximum efficiency', 500.00, 100, 15.00, 75.00, 18.75, '["VIP support", "Weekly reports", "Personal advisor"]'::jsonb),
('Refinery', 'Gold refining equipment for premium investors', 750.00, 150, 15.00, 112.50, 28.13, '["24/7 support", "Daily reports", "Dedicated advisor", "Exclusive events"]'::jsonb),
('Aureus', 'Ultimate gold mining package with maximum returns', 1000.00, 200, 15.00, 150.00, 37.50, '["24/7 support", "Real-time reports", "Dedicated advisor", "Exclusive events", "NFT certificate"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Insert default commission settings
INSERT INTO commission_settings (setting_name, setting_value, description) VALUES
('commission_rate_usdt', '15.00', 'USDT commission rate percentage'),
('commission_rate_shares', '15.00', 'Share commission rate percentage'),
('daily_processing_enabled', 'true', 'Enable daily commission processing'),
('minimum_withdrawal_amount', '10.00', 'Minimum USDT withdrawal amount'),
('withdrawal_fee_percentage', '0.00', 'Withdrawal fee percentage'),
('auto_approval_limit', '100.00', 'Auto-approve withdrawals under this amount')
ON CONFLICT (setting_name) DO NOTHING;

-- Insert the 20-phase investment system
INSERT INTO investment_phases (phase_number, phase_name, price_per_share, total_shares_available, is_active) VALUES
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
ON CONFLICT DO NOTHING;

-- Insert sample company wallet addresses
INSERT INTO company_wallets (network, currency, wallet_address, is_active) VALUES
('BSC', 'USDT', '0x742d35Cc6634C0532925a3b8D4C9db96590c6C89', TRUE),
('POL', 'USDT', '0x742d35Cc6634C0532925a3b8D4C9db96590c6C89', TRUE),
('TRON', 'USDT', 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', TRUE)
ON CONFLICT DO NOTHING;

-- Insert test data for test_connection table
INSERT INTO test_connection (name, description) VALUES
('Database Setup Test', 'This record confirms the database setup was successful'),
('Connection Verification', 'This record verifies that CRUD operations are working')
ON CONFLICT DO NOTHING;

-- =====================================================
-- End of Schema
-- =====================================================
