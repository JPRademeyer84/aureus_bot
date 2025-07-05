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

async function comprehensiveDatabaseCleanupAudit() {
  console.log('🧹 COMPREHENSIVE DATABASE CLEANUP AUDIT');
  console.log('=======================================');

  try {
    // PHASE 1: Get complete table inventory
    console.log('\n📊 PHASE 1: COMPLETE TABLE INVENTORY');
    console.log('------------------------------------');

    // Get all tables in public schema using direct SQL query
    const { data: allTables, error: tablesError } = await supabase
      .rpc('sql', {
        query: `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name;
        `
      });

    if (tablesError) {
      console.error('❌ Error fetching tables:', tablesError);
      return;
    }

    console.log(`✅ Found ${allTables.length} total tables in database:`);
    const allTableNames = allTables.map(t => t.table_name);
    allTableNames.forEach((table, index) => {
      const isCritical = CRITICAL_TABLES.includes(table);
      const status = isCritical ? '🔒 CRITICAL' : '❓ UNKNOWN';
      console.log(`   ${index + 1}. ${table} - ${status}`);
    });

    // Identify potentially unused tables
    const potentiallyUnused = allTableNames.filter(table => !CRITICAL_TABLES.includes(table));
    
    console.log(`\n🔍 POTENTIALLY UNUSED TABLES: ${potentiallyUnused.length}`);
    potentiallyUnused.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table}`);
    });

    // PHASE 2: Analyze each potentially unused table
    console.log('\n📋 PHASE 2: DETAILED ANALYSIS OF POTENTIALLY UNUSED TABLES');
    console.log('----------------------------------------------------------');

    const unusedTableAnalysis = [];

    for (const tableName of potentiallyUnused) {
      console.log(`\n🔍 Analyzing: ${tableName}`);
      
      try {
        // Get table structure
        const { data: columns, error: columnsError } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable')
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .order('ordinal_position');

        if (columnsError) {
          console.log(`   ❌ Error getting columns: ${columnsError.message}`);
          continue;
        }

        // Get record count
        const { data: records, error: countError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        const recordCount = countError ? 'ERROR' : (records?.length || 0);

        // Check for foreign key constraints
        const { data: foreignKeys, error: fkError } = await supabase
          .from('information_schema.table_constraints')
          .select(`
            constraint_name,
            constraint_type,
            table_name
          `)
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .eq('constraint_type', 'FOREIGN KEY');

        const hasForeignKeys = !fkError && foreignKeys && foreignKeys.length > 0;

        // Check if other tables reference this table
        const { data: referencingTables, error: refError } = await supabase
          .from('information_schema.key_column_usage')
          .select(`
            table_name,
            column_name,
            referenced_table_name,
            referenced_column_name
          `)
          .eq('referenced_table_schema', 'public')
          .eq('referenced_table_name', tableName);

        const isReferenced = !refError && referencingTables && referencingTables.length > 0;

        const analysis = {
          tableName,
          columnCount: columns.length,
          recordCount,
          hasForeignKeys,
          isReferenced,
          referencingTables: isReferenced ? referencingTables.map(r => r.table_name) : [],
          columns: columns.map(c => c.column_name),
          safeToRemove: recordCount === 0 && !isReferenced && !hasForeignKeys
        };

        unusedTableAnalysis.push(analysis);

        console.log(`   📊 Columns: ${analysis.columnCount}`);
        console.log(`   📈 Records: ${analysis.recordCount}`);
        console.log(`   🔗 Has Foreign Keys: ${analysis.hasForeignKeys ? 'YES' : 'NO'}`);
        console.log(`   👥 Referenced by others: ${analysis.isReferenced ? 'YES' : 'NO'}`);
        if (analysis.isReferenced) {
          console.log(`      Referenced by: ${analysis.referencingTables.join(', ')}`);
        }
        console.log(`   ✅ Safe to remove: ${analysis.safeToRemove ? 'YES' : 'NO'}`);

      } catch (error) {
        console.log(`   ❌ Analysis error: ${error.message}`);
      }
    }

    // PHASE 3: Generate removal recommendations
    console.log('\n🎯 PHASE 3: REMOVAL RECOMMENDATIONS');
    console.log('-----------------------------------');

    const safeToRemove = unusedTableAnalysis.filter(t => t.safeToRemove);
    const requiresReview = unusedTableAnalysis.filter(t => !t.safeToRemove);

    console.log(`\n✅ SAFE TO REMOVE (${safeToRemove.length} tables):`);
    safeToRemove.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.tableName} - Empty table, no dependencies`);
    });

    console.log(`\n⚠️ REQUIRES REVIEW (${requiresReview.length} tables):`);
    requiresReview.forEach((table, index) => {
      const reasons = [];
      if (table.recordCount > 0) reasons.push(`${table.recordCount} records`);
      if (table.hasForeignKeys) reasons.push('has foreign keys');
      if (table.isReferenced) reasons.push('referenced by other tables');
      
      console.log(`   ${index + 1}. ${table.tableName} - ${reasons.join(', ')}`);
    });

    // PHASE 4: Generate DROP statements for safe tables
    console.log('\n🗑️ PHASE 4: SAFE REMOVAL SQL STATEMENTS');
    console.log('---------------------------------------');

    if (safeToRemove.length > 0) {
      console.log('\n-- SQL to remove unused tables (SAFE):');
      safeToRemove.forEach(table => {
        console.log(`DROP TABLE IF EXISTS ${table.tableName};`);
      });

      console.log('\n-- Rollback SQL (to recreate if needed):');
      console.log('-- Note: You would need the original CREATE TABLE statements');
      console.log('-- These tables appear to be empty and unused');
    } else {
      console.log('✅ No tables identified as safe for immediate removal');
    }

    // Generate comprehensive report
    const report = {
      totalTables: allTableNames.length,
      criticalTables: CRITICAL_TABLES.length,
      potentiallyUnused: potentiallyUnused.length,
      safeToRemove: safeToRemove.length,
      requiresReview: requiresReview.length,
      safeRemovalList: safeToRemove.map(t => t.tableName),
      reviewRequiredList: requiresReview.map(t => ({
        name: t.tableName,
        records: t.recordCount,
        hasForeignKeys: t.hasForeignKeys,
        isReferenced: t.isReferenced
      }))
    };

    console.log('\n📊 CLEANUP AUDIT SUMMARY');
    console.log('========================');
    console.log(`Total tables in database: ${report.totalTables}`);
    console.log(`Critical tables (protected): ${report.criticalTables}`);
    console.log(`Potentially unused: ${report.potentiallyUnused}`);
    console.log(`Safe to remove: ${report.safeToRemove}`);
    console.log(`Requires manual review: ${report.requiresReview}`);

    // Write detailed report to file
    const fs = require('fs');
    const detailedReport = `# DATABASE CLEANUP AUDIT REPORT

Generated: ${new Date().toISOString()}

## SUMMARY
- Total tables: ${report.totalTables}
- Critical tables (protected): ${report.criticalTables}
- Potentially unused: ${report.potentiallyUnused}
- Safe to remove: ${report.safeToRemove}
- Requires review: ${report.requiresReview}

## SAFE TO REMOVE
${safeToRemove.map(t => `- ${t.tableName} (${t.recordCount} records, no dependencies)`).join('\n')}

## REQUIRES REVIEW
${requiresReview.map(t => `- ${t.tableName} (${t.recordCount} records, FK: ${t.hasForeignKeys}, Referenced: ${t.isReferenced})`).join('\n')}

## DETAILED ANALYSIS
${JSON.stringify(unusedTableAnalysis, null, 2)}
`;

    fs.writeFileSync('database-cleanup-report.md', detailedReport);
    console.log('\n✅ Detailed report written to database-cleanup-report.md');

    return report;

  } catch (error) {
    console.error('❌ Cleanup audit error:', error);
  }
}

comprehensiveDatabaseCleanupAudit();
