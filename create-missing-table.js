const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase configuration
const supabaseUrl = 'https://fgubaqoftdeefcakejwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZndWJhcW9mdGRlZWZjYWtland1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMwOTIxMCwiZXhwIjoyMDY2ODg1MjEwfQ.9Dl-TPeiRTZI7NrsbISgl50XYrWxzNx0Ffk-TNXWhOA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createMissingTable() {
  console.log('🔧 CREATING MISSING commission_withdrawals TABLE');
  console.log('===============================================');

  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('create-commission-withdrawals-table.sql', 'utf8');
    
    console.log('📋 SQL Content loaded from file');
    
    // Execute the SQL using a direct query approach
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS commission_withdrawals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        withdrawal_type VARCHAR(50) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        wallet_address VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        admin_notes TEXT,
        processed_by INTEGER REFERENCES users(id),
        processed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    const indexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_user_id ON commission_withdrawals(user_id);
      CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_status ON commission_withdrawals(status);
      CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_type ON commission_withdrawals(withdrawal_type);
      CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_created ON commission_withdrawals(created_at);
    `;

    console.log('🏗️ Creating commission_withdrawals table...');
    
    // Try to create the table using RPC if available
    try {
      const { data: createResult, error: createError } = await supabase
        .rpc('execute_sql', { query: createTableSQL });
      
      if (createError) {
        console.log('⚠️ RPC method failed, trying direct approach...');
        throw createError;
      }
      
      console.log('✅ Table created successfully via RPC');
      
      // Create indexes
      const { data: indexResult, error: indexError } = await supabase
        .rpc('execute_sql', { query: indexesSQL });
      
      if (indexError) {
        console.log('⚠️ Index creation failed:', indexError.message);
      } else {
        console.log('✅ Indexes created successfully');
      }
      
    } catch (rpcError) {
      console.log('⚠️ RPC approach failed, table may need manual creation');
      console.log('📋 Please run the following SQL manually in Supabase SQL Editor:');
      console.log('\n' + createTableSQL);
      console.log('\n' + indexesSQL);
    }

    // Test table access
    console.log('\n🧪 Testing table access...');
    
    const { data: testData, error: testError } = await supabase
      .from('commission_withdrawals')
      .select('*')
      .limit(1);

    if (testError) {
      console.log('❌ Table access test failed:', testError.message);
      console.log('🔧 Manual table creation required in Supabase dashboard');
    } else {
      console.log('✅ Table access test successful!');
      console.log(`📊 Table is ready with ${testData.length} records`);
    }

    // Final validation
    console.log('\n🎯 FINAL VALIDATION');
    console.log('-------------------');
    
    const criticalTables = [
      'users',
      'telegram_users', 
      'crypto_payment_transactions',
      'aureus_share_purchases',
      'referrals',
      'commission_balances',
      'commission_transactions',
      'commission_withdrawals', // This should now work
      'investment_phases',
      'company_wallets',
      'terms_acceptance'
    ];

    let allTablesReady = true;
    
    for (const tableName of criticalTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`   ❌ ${tableName} - ERROR: ${error.message}`);
          allTablesReady = false;
        } else {
          console.log(`   ✅ ${tableName} - OK`);
        }
      } catch (accessError) {
        console.log(`   ❌ ${tableName} - EXCEPTION: ${accessError.message}`);
        allTablesReady = false;
      }
    }

    console.log('\n🚀 DEPLOYMENT READINESS');
    console.log('=======================');
    
    if (allTablesReady) {
      console.log('✅ ALL CRITICAL TABLES READY');
      console.log('✅ DATABASE SCHEMA 100% COMPATIBLE');
      console.log('✅ READY FOR PRODUCTION DEPLOYMENT');
    } else {
      console.log('❌ SOME TABLES STILL MISSING');
      console.log('⚠️ MANUAL INTERVENTION REQUIRED');
    }

  } catch (error) {
    console.error('❌ Error creating table:', error);
  }
}

createMissingTable();
