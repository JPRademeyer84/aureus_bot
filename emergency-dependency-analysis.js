const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://fgubaqoftdeefcakejwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZndWJhcW9mdGRlZWZjYWtland1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMwOTIxMCwiZXhwIjoyMDY2ODg1MjEwfQ.9Dl-TPeiRTZI7NrsbISgl50XYrWxzNx0Ffk-TNXWhOA';

const supabase = createClient(supabaseUrl, supabaseKey);

// Tables that failed to drop due to dependencies
const FAILED_TABLES = [
  'aureus_investments',
  'payments', 
  'certificates',
  'commissions'
];

async function emergencyDependencyAnalysis() {
  console.log('🚨 EMERGENCY FOREIGN KEY DEPENDENCY ANALYSIS');
  console.log('============================================');

  try {
    // Check foreign key constraints for each failed table
    for (const tableName of FAILED_TABLES) {
      console.log(`\n🔍 Analyzing dependencies for: ${tableName}`);
      console.log('-------------------------------------------');

      // Check what tables reference this table
      try {
        const { data: referencingConstraints, error: refError } = await supabase
          .from('information_schema.referential_constraints')
          .select(`
            constraint_name,
            unique_constraint_name,
            constraint_schema,
            unique_constraint_schema
          `)
          .eq('unique_constraint_schema', 'public');

        if (!refError && referencingConstraints) {
          console.log(`Found ${referencingConstraints.length} referential constraints`);
        }

        // Get foreign key details
        const { data: foreignKeys, error: fkError } = await supabase
          .from('information_schema.key_column_usage')
          .select(`
            table_name,
            column_name,
            constraint_name,
            referenced_table_name,
            referenced_column_name
          `)
          .eq('referenced_table_schema', 'public')
          .eq('referenced_table_name', tableName);

        if (fkError) {
          console.log(`   ❌ Error getting foreign keys: ${fkError.message}`);
        } else if (foreignKeys && foreignKeys.length > 0) {
          console.log(`   🔗 Tables that reference ${tableName}:`);
          foreignKeys.forEach(fk => {
            console.log(`      - ${fk.table_name}.${fk.column_name} → ${fk.referenced_table_name}.${fk.referenced_column_name}`);
            console.log(`        Constraint: ${fk.constraint_name}`);
          });
        } else {
          console.log(`   ✅ No foreign key references found for ${tableName}`);
        }

        // Check if the table has data
        const { data: records, error: countError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        const recordCount = countError ? 'ERROR' : (records?.length || 0);
        console.log(`   📊 Record count: ${recordCount}`);

        // Check what this table references
        const { data: outgoingFKs, error: outError } = await supabase
          .from('information_schema.key_column_usage')
          .select(`
            table_name,
            column_name,
            constraint_name,
            referenced_table_name,
            referenced_column_name
          `)
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .not('referenced_table_name', 'is', null);

        if (!outError && outgoingFKs && outgoingFKs.length > 0) {
          console.log(`   🔗 ${tableName} references:`);
          outgoingFKs.forEach(fk => {
            console.log(`      - ${fk.table_name}.${fk.column_name} → ${fk.referenced_table_name}.${fk.referenced_column_name}`);
          });
        }

      } catch (error) {
        console.log(`   ❌ Analysis error for ${tableName}: ${error.message}`);
      }
    }

    // Check critical table dependencies
    console.log('\n🎯 CRITICAL TABLE DEPENDENCY CHECK');
    console.log('----------------------------------');

    const criticalTables = ['crypto_payment_transactions', 'aureus_share_purchases'];
    
    for (const criticalTable of criticalTables) {
      console.log(`\n🔍 Checking ${criticalTable} dependencies:`);
      
      try {
        // Get all foreign keys for this critical table
        const { data: criticalFKs, error: criticalError } = await supabase
          .from('information_schema.key_column_usage')
          .select(`
            table_name,
            column_name,
            constraint_name,
            referenced_table_name,
            referenced_column_name
          `)
          .eq('table_schema', 'public')
          .eq('table_name', criticalTable)
          .not('referenced_table_name', 'is', null);

        if (criticalError) {
          console.log(`   ❌ Error: ${criticalError.message}`);
        } else if (criticalFKs && criticalFKs.length > 0) {
          console.log(`   🔗 ${criticalTable} depends on:`);
          criticalFKs.forEach(fk => {
            const isProblematic = FAILED_TABLES.includes(fk.referenced_table_name);
            const status = isProblematic ? '🚨 PROBLEMATIC' : '✅ OK';
            console.log(`      - ${fk.referenced_table_name}.${fk.referenced_column_name} ${status}`);
          });
        } else {
          console.log(`   ✅ No foreign key dependencies`);
        }

        // Sample some data to see what's actually being used
        const { data: sampleData, error: sampleError } = await supabase
          .from(criticalTable)
          .select('*')
          .limit(3);

        if (!sampleError && sampleData && sampleData.length > 0) {
          console.log(`   📊 Sample data from ${criticalTable}:`);
          sampleData.forEach((record, index) => {
            console.log(`      ${index + 1}. ID: ${record.id}, User: ${record.user_id}`);
            // Check for investment_id column
            if (record.investment_id) {
              console.log(`         🚨 Has investment_id: ${record.investment_id}`);
            }
          });
        }

      } catch (error) {
        console.log(`   ❌ Critical table analysis error: ${error.message}`);
      }
    }

    // Generate safe cleanup strategy
    console.log('\n🛡️ SAFE CLEANUP STRATEGY');
    console.log('------------------------');
    
    console.log('IMMEDIATE ACTIONS REQUIRED:');
    console.log('1. 🚨 STOP all table drops immediately');
    console.log('2. 🔍 Analyze foreign key constraints properly');
    console.log('3. 🛠️ Remove foreign key constraints first, then drop tables');
    console.log('4. ✅ Only drop tables that are truly unused');
    
    console.log('\nSAFE TABLES TO DROP (no dependencies detected):');
    const safeTables = [
      'telegram_sessions',
      'user_states', 
      'bot_sessions',
      'investment_packages',
      'packages',
      'share_packages',
      'withdrawal_requests',
      'nft_certificates',
      'mining_operations',
      'dividend_payments',
      'phase_transitions'
    ];
    
    safeTables.forEach(table => {
      console.log(`   ✅ ${table}`);
    });

    console.log('\nTABLES REQUIRING CONSTRAINT REMOVAL FIRST:');
    FAILED_TABLES.forEach(table => {
      console.log(`   ⚠️ ${table} - Remove foreign key constraints first`);
    });

  } catch (error) {
    console.error('❌ Emergency analysis error:', error);
  }
}

emergencyDependencyAnalysis();
