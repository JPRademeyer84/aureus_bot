const { Client } = require('pg');
require('dotenv').config();

console.log('🚀 Setting up Aureus Telegram Bot Database Schema...');

// Database configuration using Supabase connection string
const dbConfig = {
  host: process.env.SUPABASE_DB_HOST,
  port: parseInt(process.env.SUPABASE_DB_PORT) || 5432,
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

console.log('📋 Database configuration:');
console.log(`Host: ${dbConfig.host}`);
console.log(`Port: ${dbConfig.port}`);
console.log(`Database: ${dbConfig.database}`);
console.log(`User: ${dbConfig.user}`);

async function createDatabaseSchema() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL database!');
    
    // Create tables in order (respecting foreign key dependencies)
    await createTestTable(client);
    await createUsersTable(client);
    await createTelegramUsersTable(client);
    await createTelegramSessionsTable(client);
    await createTermsAcceptanceTable(client);
    // Investment packages table removed - using custom amounts only
    await createInvestmentsTable(client);
    await createPaymentsTable(client);
    await createReferralsTable(client);
    await createCertificatesTable(client);
    
    console.log('🎉 Database schema created successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function createUsersTable(client) {
  console.log('🏗️ Creating users table...');
  
  const createUsersSQL = `
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
    
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `;
  
  await client.query(createUsersSQL);
  console.log('✅ Users table created');
}

async function createTelegramUsersTable(client) {
  console.log('🏗️ Creating telegram_users table...');
  
  const createTelegramUsersSQL = `
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
    
    CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON telegram_users(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id ON telegram_users(user_id);
  `;
  
  await client.query(createTelegramUsersSQL);
  console.log('✅ Telegram users table created');
}

async function createTelegramSessionsTable(client) {
  console.log('🏗️ Creating telegram_sessions table...');

  const createTelegramSessionsSQL = `
    CREATE TABLE IF NOT EXISTS telegram_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      telegram_id BIGINT NOT NULL,
      session_data TEXT,
      expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_telegram_sessions_telegram_id ON telegram_sessions(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_sessions_expires_at ON telegram_sessions(expires_at);
  `;

  await client.query(createTelegramSessionsSQL);
  console.log('✅ Telegram sessions table created');
}

async function createTermsAcceptanceTable(client) {
  console.log('🏗️ Creating terms_acceptance table...');

  const createTermsAcceptanceSQL = `
    CREATE TABLE IF NOT EXISTS terms_acceptance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      telegram_id BIGINT REFERENCES telegram_users(telegram_id) ON DELETE CASCADE,
      terms_type VARCHAR(100) NOT NULL,
      version VARCHAR(20) DEFAULT '1.0',
      accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT unique_user_terms UNIQUE(user_id, terms_type),
      CONSTRAINT unique_telegram_terms UNIQUE(telegram_id, terms_type)
    );

    CREATE INDEX IF NOT EXISTS idx_terms_acceptance_user_id ON terms_acceptance(user_id);
    CREATE INDEX IF NOT EXISTS idx_terms_acceptance_telegram_id ON terms_acceptance(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_terms_acceptance_terms_type ON terms_acceptance(terms_type);
  `;

  await client.query(createTermsAcceptanceSQL);
  console.log('✅ Terms acceptance table created');
}

// Investment packages table removed - using custom amounts only

async function createInvestmentsTable(client) {
  console.log('🏗️ Creating aureus_investments table...');
  
  const createInvestmentsSQL = `
    CREATE TABLE IF NOT EXISTS aureus_investments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    
    CREATE INDEX IF NOT EXISTS idx_investments_user_id ON aureus_investments(user_id);
    CREATE INDEX IF NOT EXISTS idx_investments_package_id ON aureus_investments(package_id);
    CREATE INDEX IF NOT EXISTS idx_investments_status ON aureus_investments(status);
    CREATE INDEX IF NOT EXISTS idx_investments_created_at ON aureus_investments(created_at);
  `;
  
  await client.query(createInvestmentsSQL);
  console.log('✅ Investments table created');
}

async function createPaymentsTable(client) {
  console.log('🏗️ Creating payments table...');

  const createPaymentsSQL = `
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

    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_investment_id ON payments(investment_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  `;

  await client.query(createPaymentsSQL);
  console.log('✅ Payments table created');
}

async function createReferralsTable(client) {
  console.log('🏗️ Creating referrals table...');

  const createReferralsSQL = `
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

    CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
    CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
    CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
  `;

  await client.query(createReferralsSQL);
  console.log('✅ Referrals table created');
}

async function createCertificatesTable(client) {
  console.log('🏗️ Creating certificates table...');

  const createCertificatesSQL = `
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

    CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
    CREATE INDEX IF NOT EXISTS idx_certificates_investment_id ON certificates(investment_id);
    CREATE INDEX IF NOT EXISTS idx_certificates_number ON certificates(certificate_number);
    CREATE INDEX IF NOT EXISTS idx_certificates_nft_token ON certificates(nft_token_id);
  `;

  await client.query(createCertificatesSQL);
  console.log('✅ Certificates table created');
}

// Test table for connection verification
async function createTestTable(client) {
  console.log('🏗️ Creating test_connection table...');

  const createTestSQL = `
    CREATE TABLE IF NOT EXISTS test_connection (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await client.query(createTestSQL);
  console.log('✅ Test connection table created');
}

// Export the setup function
module.exports = {
  createDatabaseSchema,
  createTestTable,
  dbConfig
};
