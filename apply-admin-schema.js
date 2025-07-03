const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyAdminSchema() {
  console.log('🔧 Applying enhanced admin schema...');

  try {
    // Create admin_users table
    console.log('📋 Creating admin_users table...');
    const { error: adminUsersError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS admin_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          telegram_username VARCHAR(255) UNIQUE NOT NULL,
          telegram_id BIGINT UNIQUE,
          full_name VARCHAR(255),
          permission_level VARCHAR(50) DEFAULT 'sub_admin',
          is_active BOOLEAN DEFAULT TRUE,
          created_by_admin_id UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(telegram_username);
        CREATE INDEX IF NOT EXISTS idx_admin_users_telegram_id ON admin_users(telegram_id);
        CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
      `
    });

    if (adminUsersError) {
      console.error('❌ Error creating admin_users table:', adminUsersError);
    } else {
      console.log('✅ admin_users table created successfully');
    }

    // Create admin_audit_logs table
    console.log('📋 Creating admin_audit_logs table...');
    const { error: auditLogsError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          admin_telegram_id BIGINT NOT NULL,
          admin_username VARCHAR(255),
          action VARCHAR(100) NOT NULL,
          target_type VARCHAR(50),
          target_id VARCHAR(255),
          details JSONB DEFAULT '{}'::jsonb,
          ip_address INET,
          user_agent TEXT,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_telegram_id);
        CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_timestamp ON admin_audit_logs(timestamp);
      `
    });

    if (auditLogsError) {
      console.error('❌ Error creating admin_audit_logs table:', auditLogsError);
    } else {
      console.log('✅ admin_audit_logs table created successfully');
    }

    // Create payment_admin_notes table
    console.log('📋 Creating payment_admin_notes table...');
    const { error: notesError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS payment_admin_notes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payment_id UUID NOT NULL,
          admin_telegram_id BIGINT NOT NULL,
          admin_username VARCHAR(255),
          note_type VARCHAR(50) DEFAULT 'general',
          note_text TEXT NOT NULL,
          is_internal BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_payment_admin_notes_payment_id ON payment_admin_notes(payment_id);
        CREATE INDEX IF NOT EXISTS idx_payment_admin_notes_admin_id ON payment_admin_notes(admin_telegram_id);
      `
    });

    if (notesError) {
      console.error('❌ Error creating payment_admin_notes table:', notesError);
    } else {
      console.log('✅ payment_admin_notes table created successfully');
    }

    // Add columns to crypto_payment_transactions table
    console.log('📋 Adding columns to crypto_payment_transactions table...');
    const { error: alterError } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE crypto_payment_transactions
        ADD COLUMN IF NOT EXISTS approved_by_admin_id BIGINT,
        ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS rejected_by_admin_id BIGINT,
        ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS admin_notes TEXT,
        ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending';
      `
    });

    if (alterError) {
      console.error('❌ Error altering crypto_payment_transactions table:', alterError);
    } else {
      console.log('✅ crypto_payment_transactions table updated successfully');
    }

    // Insert main admin user
    console.log('📋 Inserting main admin user...');
    const { error: insertError } = await supabase
      .from('admin_users')
      .upsert([{
        telegram_username: 'TTTFOUNDER',
        permission_level: 'main_admin',
        is_active: true
      }], {
        onConflict: 'telegram_username'
      });

    if (insertError) {
      console.error('❌ Error inserting main admin user:', insertError);
    } else {
      console.log('✅ Main admin user created successfully');
    }

    console.log('🎉 Admin schema application completed!');
    
    // Test the new tables
    console.log('🔍 Testing new tables...');
    
    // Test admin_users table
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .limit(1);
    
    if (adminError) {
      console.error('❌ Error testing admin_users table:', adminError);
    } else {
      console.log('✅ admin_users table is working');
    }
    
    // Test admin_audit_logs table
    const { data: auditLogs, error: auditError } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .limit(1);
    
    if (auditError) {
      console.error('❌ Error testing admin_audit_logs table:', auditError);
    } else {
      console.log('✅ admin_audit_logs table is working');
    }
    
    // Test payment_admin_notes table
    const { data: paymentNotes, error: notesError } = await supabase
      .from('payment_admin_notes')
      .select('*')
      .limit(1);
    
    if (notesError) {
      console.error('❌ Error testing payment_admin_notes table:', notesError);
    } else {
      console.log('✅ payment_admin_notes table is working');
    }
    
    console.log('🚀 Enhanced admin system is ready!');
    
  } catch (error) {
    console.error('❌ Failed to apply admin schema:', error);
  }
}

// Run the schema application
applyAdminSchema().then(() => {
  console.log('✅ Schema application completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Schema application failed:', error);
  process.exit(1);
});
