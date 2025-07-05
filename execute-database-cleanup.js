const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://fgubaqoftdeefcakejwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZndWJhcW9mdGRlZWZjYWtland1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMwOTIxMCwiZXhwIjoyMDY2ODg1MjEwfQ.9Dl-TPeiRTZI7NrsbISgl50XYrWxzNx0Ffk-TNXWhOA';

const supabase = createClient(supabaseUrl, supabaseKey);

// Tables identified as safe to remove (empty and unused)
const SAFE_TO_REMOVE = [
  'telegram_sessions',
  'aureus_investments',
  'payments',
  'certificates',
  'investment_packages',
  'packages',
  'share_packages',
  'commissions',
  'withdrawal_requests',
  'user_states',
  'bot_sessions',
  'nft_certificates',
  'mining_operations',
  'dividend_payments',
  'phase_transitions'
];

async function executeDatabaseCleanup() {
  console.log('🧹 EXECUTING DATABASE CLEANUP');
  console.log('=============================');

  try {
    // First, check test_connection table content
    console.log('\n🔍 REVIEWING test_connection TABLE');
    console.log('----------------------------------');
    
    const { data: testData, error: testError } = await supabase
      .from('test_connection')
      .select('*')
      .limit(10);

    if (testError) {
      console.log('❌ Error checking test_connection:', testError.message);
    } else {
      console.log(`📊 test_connection has ${testData.length} records:`);
      testData.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.name} - ${record.description}`);
      });
      
      // Check if these are just test records
      const isTestData = testData.every(record => 
        record.name && (
          record.name.includes('Test') || 
          record.name.includes('test') ||
          record.description?.includes('test')
        )
      );
      
      if (isTestData) {
        console.log('✅ test_connection contains only test data - safe to remove');
        SAFE_TO_REMOVE.push('test_connection');
      } else {
        console.log('⚠️ test_connection contains non-test data - keeping for safety');
      }
    }

    // Execute cleanup for safe tables
    console.log('\n🗑️ REMOVING UNUSED EMPTY TABLES');
    console.log('-------------------------------');

    const removalResults = [];
    let successCount = 0;
    let errorCount = 0;

    for (const tableName of SAFE_TO_REMOVE) {
      try {
        console.log(`🗑️ Removing table: ${tableName}`);
        
        // Note: Supabase doesn't allow DROP TABLE via client
        // We'll generate the SQL and provide instructions
        const result = {
          table: tableName,
          status: 'PENDING_MANUAL_REMOVAL',
          sql: `DROP TABLE IF EXISTS ${tableName};`
        };
        
        removalResults.push(result);
        console.log(`   ✅ ${tableName} - SQL generated for manual removal`);
        successCount++;
        
      } catch (error) {
        console.log(`   ❌ ${tableName} - Error: ${error.message}`);
        removalResults.push({
          table: tableName,
          status: 'ERROR',
          error: error.message
        });
        errorCount++;
      }
    }

    // Generate comprehensive cleanup SQL
    console.log('\n📋 CLEANUP SQL STATEMENTS');
    console.log('-------------------------');
    console.log('-- Execute the following SQL in Supabase SQL Editor:');
    console.log('-- WARNING: This will permanently delete these tables!');
    console.log('');
    
    SAFE_TO_REMOVE.forEach(table => {
      console.log(`DROP TABLE IF EXISTS ${table};`);
    });

    console.log('');
    console.log('-- Verification query (should return 0 rows after cleanup):');
    const tableList = SAFE_TO_REMOVE.map(t => `'${t}'`).join(', ');
    console.log(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (${tableList});`);

    // Generate rollback plan
    console.log('\n🔄 ROLLBACK PLAN');
    console.log('---------------');
    console.log('-- If you need to recreate any of these tables, you would need:');
    console.log('-- 1. The original CREATE TABLE statements');
    console.log('-- 2. Any data backups (though these tables were empty)');
    console.log('-- 3. Foreign key constraints and indexes');
    console.log('-- Note: Since these tables were empty, rollback mainly involves recreating structure');

    // Test critical tables after cleanup simulation
    console.log('\n🧪 VERIFYING CRITICAL TABLES REMAIN INTACT');
    console.log('------------------------------------------');
    
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
      'terms_acceptance'
    ];

    let allCriticalOk = true;
    for (const table of criticalTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`   ❌ ${table} - ERROR: ${error.message}`);
          allCriticalOk = false;
        } else {
          console.log(`   ✅ ${table} - OK (${data?.length || 0} records)`);
        }
      } catch (error) {
        console.log(`   ❌ ${table} - EXCEPTION: ${error.message}`);
        allCriticalOk = false;
      }
    }

    // Generate final report
    const cleanupReport = {
      timestamp: new Date().toISOString(),
      action: 'DATABASE_CLEANUP_AUDIT',
      summary: {
        tablesIdentifiedForRemoval: SAFE_TO_REMOVE.length,
        successfullyProcessed: successCount,
        errors: errorCount,
        criticalTablesIntact: allCriticalOk
      },
      removedTables: SAFE_TO_REMOVE,
      removalResults: removalResults,
      sqlStatements: SAFE_TO_REMOVE.map(table => `DROP TABLE IF EXISTS ${table};`),
      criticalTablesStatus: allCriticalOk ? 'ALL_OK' : 'SOME_ISSUES'
    };

    // Write cleanup report
    const fs = require('fs');
    fs.writeFileSync('database-cleanup-execution-report.json', JSON.stringify(cleanupReport, null, 2));

    console.log('\n📊 CLEANUP EXECUTION SUMMARY');
    console.log('============================');
    console.log(`Tables identified for removal: ${SAFE_TO_REMOVE.length}`);
    console.log(`SQL statements generated: ${successCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log(`Critical tables status: ${allCriticalOk ? '✅ ALL OK' : '❌ ISSUES DETECTED'}`);
    console.log('\n⚠️ MANUAL ACTION REQUIRED:');
    console.log('Execute the generated SQL statements in Supabase SQL Editor to complete cleanup');
    console.log('\n✅ Execution report saved to database-cleanup-execution-report.json');

    return cleanupReport;

  } catch (error) {
    console.error('❌ Cleanup execution error:', error);
  }
}

executeDatabaseCleanup();
