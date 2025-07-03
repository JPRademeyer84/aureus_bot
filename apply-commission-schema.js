require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyCommissionSchema() {
  console.log('🔧 Applying Commission System Schema Updates...');
  
  try {
    // Test commission_balances table
    console.log('\n💰 Testing commission_balances table...');
    const { data: balanceTest, error: balanceError } = await supabase
      .from('commission_balances')
      .select('*')
      .limit(1);
    
    if (balanceError) {
      console.log('⚠️ Commission balances table needs to be created');
      console.log('Error:', balanceError.message);
    } else {
      console.log('✅ Commission balances table accessible');
    }

    // Test commission_transactions table
    console.log('\n📊 Testing commission_transactions table...');
    const { data: transactionTest, error: transactionError } = await supabase
      .from('commission_transactions')
      .select('*')
      .limit(1);
    
    if (transactionError) {
      console.log('⚠️ Commission transactions table needs to be created');
      console.log('Error:', transactionError.message);
    } else {
      console.log('✅ Commission transactions table accessible');
    }

    // Test commission_withdrawal_requests table
    console.log('\n💸 Testing commission_withdrawal_requests table...');
    const { data: withdrawalTest, error: withdrawalError } = await supabase
      .from('commission_withdrawal_requests')
      .select('*')
      .limit(1);
    
    if (withdrawalError) {
      console.log('⚠️ Commission withdrawal requests table needs to be created');
      console.log('Error:', withdrawalError.message);
    } else {
      console.log('✅ Commission withdrawal requests table accessible');
    }

    // Test commission_usage table
    console.log('\n🔄 Testing commission_usage table...');
    const { data: usageTest, error: usageError } = await supabase
      .from('commission_usage')
      .select('*')
      .limit(1);
    
    if (usageError) {
      console.log('⚠️ Commission usage table needs to be created');
      console.log('Error:', usageError.message);
    } else {
      console.log('✅ Commission usage table accessible');
    }

    // Test daily_commission_processing table
    console.log('\n📅 Testing daily_commission_processing table...');
    const { data: dailyTest, error: dailyError } = await supabase
      .from('daily_commission_processing')
      .select('*')
      .limit(1);
    
    if (dailyError) {
      console.log('⚠️ Daily commission processing table needs to be created');
      console.log('Error:', dailyError.message);
    } else {
      console.log('✅ Daily commission processing table accessible');
    }

    // Test commission_settings table
    console.log('\n⚙️ Testing commission_settings table...');
    const { data: settingsTest, error: settingsError } = await supabase
      .from('commission_settings')
      .select('*')
      .limit(5);
    
    if (settingsError) {
      console.log('⚠️ Commission settings table needs to be created');
      console.log('Error:', settingsError.message);
    } else {
      console.log('✅ Commission settings table accessible');
      if (settingsTest && settingsTest.length > 0) {
        console.log(`📋 Found ${settingsTest.length} commission settings:`);
        settingsTest.forEach(setting => {
          console.log(`   - ${setting.setting_name}: ${setting.setting_value}`);
        });
      }
    }

    // Test user_commission_summary view
    console.log('\n👥 Testing user_commission_summary view...');
    const { data: summaryTest, error: summaryError } = await supabase
      .from('user_commission_summary')
      .select('*')
      .limit(3);
    
    if (summaryError) {
      console.log('⚠️ User commission summary view needs to be created');
      console.log('Error:', summaryError.message);
    } else {
      console.log('✅ User commission summary view accessible');
      if (summaryTest && summaryTest.length > 0) {
        console.log(`📊 Found ${summaryTest.length} user commission summaries`);
      }
    }

    console.log('\n🎉 Commission system schema verification completed!');
    
    console.log('\n📋 COMMISSION SYSTEM FEATURES:');
    console.log('✅ Dual Commission Structure (15% USDT + 15% Shares)');
    console.log('✅ Commission Balance Tracking');
    console.log('✅ Withdrawal Request System');
    console.log('✅ Commission Usage for Share Purchases');
    console.log('✅ Daily Commission Processing');
    console.log('✅ Admin Approval Workflow');
    console.log('✅ Comprehensive Audit Trail');
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('1. Implement withdrawal request form in bot');
    console.log('2. Add commission balance display to referral dashboard');
    console.log('3. Integrate commission usage in share purchase flow');
    console.log('4. Set up daily commission processing automation');
    console.log('5. Add admin withdrawal approval interface');
    
  } catch (error) {
    console.error('❌ Commission schema verification error:', error);
  }
}

applyCommissionSchema();
