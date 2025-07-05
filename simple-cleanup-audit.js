const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://fgubaqoftdeefcakejwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZndWJhcW9mdGRlZWZjYWtland1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMwOTIxMCwiZXhwIjoyMDY2ODg1MjEwfQ.9Dl-TPeiRTZI7NrsbISgl50XYrWxzNx0Ffk-TNXWhOA';

const supabase = createClient(supabaseUrl, supabaseKey);

// Critical tables that MUST NOT be removed (from verifysql.md Section A)
const CRITICAL_TABLES = [
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
  'commission_withdrawals', // Missing but needed
  'user_sessions'
];

// Known tables that might exist from previous versions or setup scripts
const POTENTIAL_TABLES = [
  'test_connection',
  'telegram_sessions',
  'aureus_investments', // Legacy name
  'payments', // Legacy name
  'certificates',
  'investment_packages', // Removed from code
  'packages', // Legacy
  'share_packages', // Legacy
  'commissions', // Old commission table
  'withdrawal_requests', // Legacy
  'user_states', // Legacy
  'bot_sessions', // Legacy
  'nft_certificates', // Legacy
  'mining_operations', // Legacy
  'dividend_payments', // Legacy
  'phase_transitions', // Legacy
];

async function simpleDatabaseCleanupAudit() {
  console.log('🧹 SIMPLE DATABASE CLEANUP AUDIT');
  console.log('=================================');

  const allPotentialTables = [...CRITICAL_TABLES, ...POTENTIAL_TABLES];
  const existingTables = [];
  const missingTables = [];
  const emptyTables = [];
  const tablesWithData = [];

  console.log('\n📊 TESTING TABLE EXISTENCE AND CONTENT');
  console.log('--------------------------------------');

  for (const tableName of allPotentialTables) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.message.includes('does not exist')) {
          missingTables.push(tableName);
          console.log(`   ❌ ${tableName} - DOES NOT EXIST`);
        } else {
          console.log(`   ⚠️ ${tableName} - ERROR: ${error.message}`);
        }
      } else {
        existingTables.push(tableName);
        const recordCount = count || 0;
        
        if (recordCount === 0) {
          emptyTables.push({ name: tableName, count: recordCount });
          console.log(`   📭 ${tableName} - EXISTS (${recordCount} records) - EMPTY`);
        } else {
          tablesWithData.push({ name: tableName, count: recordCount });
          console.log(`   📊 ${tableName} - EXISTS (${recordCount} records) - HAS DATA`);
        }
      }
    } catch (accessError) {
      console.log(`   ❌ ${tableName} - EXCEPTION: ${accessError.message}`);
      missingTables.push(tableName);
    }
  }

  console.log('\n🔍 ANALYSIS RESULTS');
  console.log('-------------------');
  console.log(`Total tables tested: ${allPotentialTables.length}`);
  console.log(`Existing tables: ${existingTables.length}`);
  console.log(`Missing tables: ${missingTables.length}`);
  console.log(`Empty tables: ${emptyTables.length}`);
  console.log(`Tables with data: ${tablesWithData.length}`);

  // Identify unused tables (exist but not critical)
  const unusedTables = existingTables.filter(table => !CRITICAL_TABLES.includes(table));
  
  console.log('\n❓ POTENTIALLY UNUSED TABLES');
  console.log('----------------------------');
  if (unusedTables.length === 0) {
    console.log('✅ No unused tables found - database is clean!');
  } else {
    unusedTables.forEach(table => {
      const tableInfo = [...emptyTables, ...tablesWithData].find(t => t.name === table);
      const recordCount = tableInfo ? tableInfo.count : 'unknown';
      const isEmpty = emptyTables.some(t => t.name === table);
      const status = isEmpty ? '🗑️ SAFE TO REMOVE' : '⚠️ HAS DATA - REVIEW NEEDED';
      console.log(`   ${table} (${recordCount} records) - ${status}`);
    });
  }

  // Generate removal recommendations
  const safeToRemove = unusedTables.filter(table => 
    emptyTables.some(t => t.name === table)
  );

  const requiresReview = unusedTables.filter(table => 
    tablesWithData.some(t => t.name === table)
  );

  console.log('\n🗑️ SAFE REMOVAL CANDIDATES');
  console.log('--------------------------');
  if (safeToRemove.length === 0) {
    console.log('✅ No tables identified as safe for immediate removal');
  } else {
    console.log('The following tables are empty and not used by the bot:');
    safeToRemove.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table}`);
    });

    console.log('\n-- SQL to remove unused empty tables:');
    safeToRemove.forEach(table => {
      console.log(`DROP TABLE IF EXISTS ${table};`);
    });
  }

  console.log('\n⚠️ REQUIRES MANUAL REVIEW');
  console.log('-------------------------');
  if (requiresReview.length === 0) {
    console.log('✅ No tables require manual review');
  } else {
    console.log('The following tables have data and need manual review:');
    requiresReview.forEach(table => {
      const tableInfo = tablesWithData.find(t => t.name === table);
      console.log(`   ${table} - ${tableInfo.count} records`);
    });
  }

  // Check for missing critical tables
  const missingCritical = CRITICAL_TABLES.filter(table => missingTables.includes(table));
  
  console.log('\n🚨 MISSING CRITICAL TABLES');
  console.log('--------------------------');
  if (missingCritical.length === 0) {
    console.log('✅ All critical tables exist');
  } else {
    console.log('❌ The following critical tables are missing:');
    missingCritical.forEach(table => {
      console.log(`   ${table} - NEEDS TO BE CREATED`);
    });
  }

  // Generate summary report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTested: allPotentialTables.length,
      existing: existingTables.length,
      missing: missingTables.length,
      empty: emptyTables.length,
      withData: tablesWithData.length,
      unused: unusedTables.length,
      safeToRemove: safeToRemove.length,
      requiresReview: requiresReview.length,
      missingCritical: missingCritical.length
    },
    tables: {
      existing: existingTables,
      missing: missingTables,
      empty: emptyTables.map(t => t.name),
      withData: tablesWithData,
      unused: unusedTables,
      safeToRemove: safeToRemove,
      requiresReview: requiresReview,
      missingCritical: missingCritical
    }
  };

  // Write report to file
  const fs = require('fs');
  fs.writeFileSync('database-cleanup-report.json', JSON.stringify(report, null, 2));
  
  console.log('\n📊 CLEANUP SUMMARY');
  console.log('==================');
  console.log(`Database status: ${missingCritical.length === 0 ? '✅ HEALTHY' : '❌ MISSING CRITICAL TABLES'}`);
  console.log(`Cleanup potential: ${safeToRemove.length} empty tables can be safely removed`);
  console.log(`Manual review needed: ${requiresReview.length} tables with data`);
  console.log('\n✅ Report saved to database-cleanup-report.json');

  return report;
}

simpleDatabaseCleanupAudit();
