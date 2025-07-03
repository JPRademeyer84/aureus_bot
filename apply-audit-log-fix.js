require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyAuditLogFix() {
  console.log('🔧 Applying audit log database field size fixes...');
  
  try {
    // Check current column sizes
    console.log('\n📊 Checking current column sizes...');
    
    const { data: columnInfo, error: columnError } = await supabase
      .rpc('exec', {
        sql: `
          SELECT 
            column_name, 
            data_type, 
            character_maximum_length 
          FROM information_schema.columns 
          WHERE table_name = 'admin_audit_logs' 
            AND column_name IN ('action', 'target_id')
          ORDER BY column_name;
        `
      });

    if (columnError) {
      console.error('❌ Error checking column info:', columnError);
    } else {
      console.log('📋 Current column sizes:');
      columnInfo.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type}(${col.character_maximum_length || 'unlimited'})`);
      });
    }

    // Apply the fixes
    console.log('\n🔧 Applying column size fixes...');
    
    // Fix admin_audit_logs table
    const { error: auditLogError } = await supabase
      .rpc('exec', {
        sql: `
          ALTER TABLE admin_audit_logs 
          ALTER COLUMN action TYPE VARCHAR(255),
          ALTER COLUMN target_id TYPE VARCHAR(500);
        `
      });

    if (auditLogError) {
      console.error('❌ Error fixing admin_audit_logs:', auditLogError);
    } else {
      console.log('✅ admin_audit_logs columns updated successfully');
    }

    // Fix payment_admin_notes table if it exists
    const { error: notesError } = await supabase
      .rpc('exec', {
        sql: `
          DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_admin_notes') THEN
              ALTER TABLE payment_admin_notes
              ALTER COLUMN payment_id TYPE VARCHAR(500);
              RAISE NOTICE 'payment_admin_notes table updated';
            ELSE
              RAISE NOTICE 'payment_admin_notes table does not exist, skipping';
            END IF;
          END $$;
        `
      });

    if (notesError) {
      console.error('❌ Error fixing payment_admin_notes:', notesError);
    } else {
      console.log('✅ payment_admin_notes check completed');
    }

    // Verify the changes
    console.log('\n✅ Verifying changes...');
    
    const { data: updatedColumnInfo, error: verifyError } = await supabase
      .rpc('exec', {
        sql: `
          SELECT 
            column_name, 
            data_type, 
            character_maximum_length 
          FROM information_schema.columns 
          WHERE table_name = 'admin_audit_logs' 
            AND column_name IN ('action', 'target_id')
          ORDER BY column_name;
        `
      });

    if (verifyError) {
      console.error('❌ Error verifying changes:', verifyError);
    } else {
      console.log('📋 Updated column sizes:');
      updatedColumnInfo.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type}(${col.character_maximum_length || 'unlimited'})`);
      });
    }

    console.log('\n🎉 Audit log database fixes completed successfully!');
    
  } catch (error) {
    console.error('❌ Error applying audit log fixes:', error);
  }
}

applyAuditLogFix();
