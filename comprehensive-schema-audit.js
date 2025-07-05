const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://fgubaqoftdeefcakejwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZndWJhcW9mdGRlZWZjYWtland1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMwOTIxMCwiZXhwIjoyMDY2ODg1MjEwfQ.9Dl-TPeiRTZI7NrsbISgl50XYrWxzNx0Ffk-TNXWhOA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function comprehensiveSchemaAudit() {
  console.log('🔍 COMPREHENSIVE DATABASE SCHEMA AUDIT');
  console.log('=====================================');

  try {
    // 1. Get all tables in the public schema
    console.log('\n📊 PHASE 1: DISCOVERING ALL TABLES');
    console.log('----------------------------------');
    
    const { data: allTables, error: tablesError } = await supabase
      .rpc('execute_sql', {
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

    console.log(`✅ Found ${allTables.length} tables in database:`);
    allTables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.table_name}`);
    });

    // 2. Get detailed schema for each table
    console.log('\n📋 PHASE 2: DETAILED SCHEMA ANALYSIS');
    console.log('------------------------------------');

    const tableSchemas = {};

    for (const table of allTables) {
      const tableName = table.table_name;
      console.log(`\n🔍 Analyzing table: ${tableName}`);

      // Get column information
      const { data: columns, error: columnsError } = await supabase
        .rpc('execute_sql', {
          query: `
            SELECT 
              column_name,
              data_type,
              is_nullable,
              column_default,
              character_maximum_length,
              numeric_precision,
              numeric_scale
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = '${tableName}'
            ORDER BY ordinal_position;
          `
        });

      if (columnsError) {
        console.error(`❌ Error fetching columns for ${tableName}:`, columnsError);
        continue;
      }

      tableSchemas[tableName] = columns;
      console.log(`   ✅ ${columns.length} columns found`);
      
      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`      - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
      });

      // Get foreign key constraints
      const { data: foreignKeys, error: fkError } = await supabase
        .rpc('execute_sql', {
          query: `
            SELECT
              kcu.column_name,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = '${tableName}';
          `
        });

      if (!fkError && foreignKeys.length > 0) {
        console.log(`   🔗 Foreign Keys:`);
        foreignKeys.forEach(fk => {
          console.log(`      - ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
        });
      }

      // Test table accessibility
      try {
        const { data: testData, error: testError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (testError) {
          console.log(`   ⚠️ Table access test failed: ${testError.message}`);
        } else {
          console.log(`   ✅ Table accessible, ${testData.length} sample records`);
        }
      } catch (accessError) {
        console.log(`   ❌ Table access error: ${accessError.message}`);
      }
    }

    // 3. Critical system validation
    console.log('\n🎯 PHASE 3: CRITICAL SYSTEM VALIDATION');
    console.log('--------------------------------------');

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

    console.log('\n📋 Checking critical tables:');
    for (const tableName of criticalTables) {
      if (tableSchemas[tableName]) {
        console.log(`   ✅ ${tableName} - EXISTS (${tableSchemas[tableName].length} columns)`);
      } else {
        console.log(`   ❌ ${tableName} - MISSING`);
      }
    }

    // 4. Generate comprehensive documentation
    console.log('\n📝 PHASE 4: GENERATING DOCUMENTATION');
    console.log('------------------------------------');

    let documentation = '# AUREUS TELEGRAM BOT - DATABASE SCHEMA AUDIT\n\n';
    documentation += `Generated: ${new Date().toISOString()}\n\n`;

    // Section A: Database Tables & Columns
    documentation += '## SECTION A: DATABASE TABLES & COLUMNS\n\n';
    for (const [tableName, columns] of Object.entries(tableSchemas)) {
      documentation += `### Table: ${tableName}\n`;
      documentation += `Columns: ${columns.length}\n\n`;
      documentation += '| Column | Type | Nullable | Default |\n';
      documentation += '|--------|------|----------|----------|\n';
      
      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'YES' : 'NO';
        const defaultVal = col.column_default || '-';
        documentation += `| ${col.column_name} | ${col.data_type} | ${nullable} | ${defaultVal} |\n`;
      });
      documentation += '\n';
    }

    // Section B: Critical Tables Status
    documentation += '## SECTION B: CRITICAL TABLES STATUS\n\n';
    documentation += '| Table | Status | Columns | Notes |\n';
    documentation += '|-------|--------|---------|-------|\n';
    
    for (const tableName of criticalTables) {
      if (tableSchemas[tableName]) {
        documentation += `| ${tableName} | ✅ EXISTS | ${tableSchemas[tableName].length} | Ready |\n`;
      } else {
        documentation += `| ${tableName} | ❌ MISSING | 0 | **NEEDS CREATION** |\n`;
      }
    }

    // Write documentation to file
    const fs = require('fs');
    fs.writeFileSync('database-schema-audit.md', documentation);
    console.log('✅ Documentation written to database-schema-audit.md');

    console.log('\n🎉 COMPREHENSIVE SCHEMA AUDIT COMPLETE');
    console.log('=====================================');

  } catch (error) {
    console.error('❌ Audit error:', error);
  }
}

comprehensiveSchemaAudit();
