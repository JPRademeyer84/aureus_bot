console.log('🚀 Generating Aureus Telegram Bot Database Schema SQL...\n');

const databaseSchema = `
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

-- Investment packages table
CREATE TABLE IF NOT EXISTS investment_packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
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

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 5.00,
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

-- =====================================================
-- Sample Data (Optional)
-- =====================================================

-- Insert sample investment packages
INSERT INTO investment_packages (name, description, price, shares, roi, annual_dividends, quarter_dividends, bonuses) VALUES
('Starter Package', 'Perfect for beginners looking to start their investment journey', 1000.00, 100, 12.50, 125.00, 31.25, '["Welcome bonus", "Free consultation"]'::jsonb),
('Growth Package', 'Ideal for investors seeking balanced growth and returns', 5000.00, 500, 15.00, 750.00, 187.50, '["Priority support", "Quarterly reports", "Investment advisor access"]'::jsonb),
('Premium Package', 'For serious investors wanting maximum returns and benefits', 10000.00, 1000, 18.00, 1800.00, 450.00, '["VIP support", "Monthly reports", "Personal advisor", "Exclusive events"]'::jsonb),
('Elite Package', 'Ultimate investment package with highest returns and premium benefits', 25000.00, 2500, 22.00, 5500.00, 1375.00, '["24/7 support", "Weekly reports", "Dedicated advisor", "Exclusive events", "NFT certificate"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Insert test data for test_connection table
INSERT INTO test_connection (name, description) VALUES
('Database Setup Test', 'This record confirms the database setup was successful'),
('Connection Verification', 'This record verifies that CRUD operations are working')
ON CONFLICT DO NOTHING;

-- =====================================================
-- End of Schema
-- =====================================================
`;

console.log('📋 Complete Database Schema:');
console.log('='.repeat(80));
console.log(databaseSchema);
console.log('='.repeat(80));

console.log('\n🎯 Instructions:');
console.log('1. Copy the SQL above');
console.log('2. Go to your Supabase dashboard SQL Editor');
console.log('3. Paste and run the SQL');
console.log('4. All tables and sample data will be created');

console.log('\n📊 Tables that will be created:');
console.log('- test_connection (for testing)');
console.log('- users (main user accounts)');
console.log('- telegram_users (Telegram bot users)');
console.log('- telegram_sessions (bot sessions)');
console.log('- investment_packages (available packages)');
console.log('- aureus_investments (user investments)');
console.log('- payments (payment records)');
console.log('- referrals (referral system)');
console.log('- certificates (NFT certificates)');

console.log('\n✅ Ready to create database schema!');
