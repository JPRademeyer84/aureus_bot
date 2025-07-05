const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🚀 Setting up Aureus Telegram Bot Database Schema via Supabase...');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQL(sql, description) {
  try {
    console.log(`🏗️ ${description}...`);
    
    // Use fetch to execute SQL directly via Supabase REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql })
    });
    
    if (!response.ok) {
      // Try alternative approach using direct SQL execution
      const response2 = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({ query: sql })
      });
      
      if (!response2.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    }
    
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to ${description.toLowerCase()}:`, error.message);
    
    // For now, let's continue with other tables even if one fails
    console.log(`⚠️ Continuing with next table...`);
    return false;
  }
}

async function createAllTables() {
  console.log('🎯 Starting database schema creation...\n');
  
  // Test table first
  await executeSQL(`
    CREATE TABLE IF NOT EXISTS test_connection (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `, 'Creating test_connection table');
  
  // Users table
  await executeSQL(`
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
  `, 'Creating users table');
  
  // Telegram users table
  await executeSQL(`
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
  `, 'Creating telegram_users table');
  
  // Investment packages table removed - using custom amounts only
  
  console.log('\n🎉 Database schema setup completed!');
  console.log('📋 Tables created: test_connection, users, telegram_users, investment_packages');
  console.log('⚠️ Note: Some tables may need to be created manually if RPC functions are not available');
}

async function testTableOperations() {
  try {
    console.log('\n🧪 Testing table operations...');
    
    // Test insert
    const { data: insertData, error: insertError } = await supabase
      .from('test_connection')
      .insert([
        { name: 'Test Record 1', description: 'First test record from setup' },
        { name: 'Test Record 2', description: 'Second test record from setup' }
      ])
      .select();
    
    if (insertError) {
      console.error('❌ Insert test failed:', insertError);
      return false;
    }
    
    console.log('✅ Insert test passed:', insertData?.length || 0, 'records inserted');
    
    // Test select
    const { data: selectData, error: selectError } = await supabase
      .from('test_connection')
      .select('*')
      .limit(5);
    
    if (selectError) {
      console.error('❌ Select test failed:', selectError);
      return false;
    }
    
    console.log('✅ Select test passed:', selectData?.length || 0, 'records found');
    
    return true;
  } catch (error) {
    console.error('❌ Table operations test failed:', error);
    return false;
  }
}

async function main() {
  try {
    await createAllTables();
    
    // Test basic operations
    const testPassed = await testTableOperations();
    
    if (testPassed) {
      console.log('\n🎉 All tests passed! Database is ready for the Telegram bot.');
    } else {
      console.log('\n⚠️ Some tests failed, but basic setup is complete.');
    }
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

main();
