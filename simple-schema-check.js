const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://fgubaqoftdeefcakejwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZndWJhcW9mdGRlZWZjYWtland1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMwOTIxMCwiZXhwIjoyMDY2ODg1MjEwfQ.9Dl-TPeiRTZI7NrsbISgl50XYrWxzNx0Ffk-TNXWhOA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseSchema() {
  console.log('🔍 DATABASE SCHEMA VALIDATION');
  console.log('=============================');

  // Critical tables that the bot uses
  const criticalTables = [
    'users',
    'telegram_users', 
    'crypto_payment_transactions',
    'aureus_share_purchases',
    'referrals',
    'commission_balances',
    'commission_transactions',
    'investment_phases',
    'company_wallets',
    'terms_acceptance',
    'admin_audit_logs',
    'commission_withdrawals',
    'user_sessions'
  ];

  console.log('\n📋 Testing critical table access:');
  
  for (const tableName of criticalTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`   ❌ ${tableName} - ERROR: ${error.message}`);
      } else {
        console.log(`   ✅ ${tableName} - OK (${data.length} sample records)`);
      }
    } catch (accessError) {
      console.log(`   ❌ ${tableName} - EXCEPTION: ${accessError.message}`);
    }
  }

  // Test specific queries used in the bot
  console.log('\n🧪 Testing specific bot queries:');

  // Test 1: User lookup
  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, full_name')
      .limit(3);
    
    if (usersError) {
      console.log('   ❌ Users query failed:', usersError.message);
    } else {
      console.log(`   ✅ Users query OK - ${users.length} users found`);
    }
  } catch (error) {
    console.log('   ❌ Users query exception:', error.message);
  }

  // Test 2: Telegram users lookup
  try {
    const { data: telegramUsers, error: telegramError } = await supabase
      .from('telegram_users')
      .select('telegram_id, user_id, username')
      .limit(3);
    
    if (telegramError) {
      console.log('   ❌ Telegram users query failed:', telegramError.message);
    } else {
      console.log(`   ✅ Telegram users query OK - ${telegramUsers.length} users found`);
    }
  } catch (error) {
    console.log('   ❌ Telegram users query exception:', error.message);
  }

  // Test 3: Commission balances
  try {
    const { data: commissions, error: commissionsError } = await supabase
      .from('commission_balances')
      .select('user_id, usdt_balance, share_balance, total_earned_usdt, total_earned_shares')
      .limit(3);
    
    if (commissionsError) {
      console.log('   ❌ Commission balances query failed:', commissionsError.message);
    } else {
      console.log(`   ✅ Commission balances query OK - ${commissions.length} records found`);
      if (commissions.length > 0) {
        console.log('      Sample commission balance:', commissions[0]);
      }
    }
  } catch (error) {
    console.log('   ❌ Commission balances query exception:', error.message);
  }

  // Test 4: Referrals with foreign key join
  try {
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select(`
        id,
        referrer_id,
        referred_id,
        status,
        users!referrals_referred_id_fkey (
          username,
          full_name
        )
      `)
      .limit(3);
    
    if (referralsError) {
      console.log('   ❌ Referrals with join query failed:', referralsError.message);
    } else {
      console.log(`   ✅ Referrals with join query OK - ${referrals.length} records found`);
    }
  } catch (error) {
    console.log('   ❌ Referrals with join query exception:', error.message);
  }

  // Test 5: Payment transactions
  try {
    const { data: payments, error: paymentsError } = await supabase
      .from('crypto_payment_transactions')
      .select('id, user_id, amount, status, network, created_at')
      .limit(3);
    
    if (paymentsError) {
      console.log('   ❌ Payment transactions query failed:', paymentsError.message);
    } else {
      console.log(`   ✅ Payment transactions query OK - ${payments.length} records found`);
    }
  } catch (error) {
    console.log('   ❌ Payment transactions query exception:', error.message);
  }

  // Test 6: Share purchases
  try {
    const { data: shares, error: sharesError } = await supabase
      .from('aureus_share_purchases')
      .select('id, user_id, total_amount, shares_purchased, status')
      .limit(3);
    
    if (sharesError) {
      console.log('   ❌ Share purchases query failed:', sharesError.message);
    } else {
      console.log(`   ✅ Share purchases query OK - ${shares.length} records found`);
    }
  } catch (error) {
    console.log('   ❌ Share purchases query exception:', error.message);
  }

  console.log('\n🎯 SCHEMA VALIDATION COMPLETE');
  console.log('=============================');
}

checkDatabaseSchema();
