require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminTables() {
  console.log('🚀 Creating Admin Tables...');
  
  try {
    // First, let's add the missing columns to crypto_payment_transactions
    console.log('📋 Adding admin columns to crypto_payment_transactions...');
    
    // We'll use the existing table structure and just add our admin enhancement columns
    // Since we can't execute DDL directly, let's create the admin_users table data manually
    
    // Check if admin_users table exists by trying to query it
    console.log('🔍 Checking if admin_users table exists...');
    const { data: adminCheck, error: adminCheckError } = await supabase
      .from('admin_users')
      .select('id')
      .limit(1);
    
    if (adminCheckError && adminCheckError.code === '42P01') {
      console.log('❌ admin_users table does not exist');
      console.log('📝 Please create the admin tables manually in Supabase dashboard:');
      console.log('');
      console.log('1. Go to Supabase Dashboard → SQL Editor');
      console.log('2. Run this SQL:');
      console.log('');
      console.log(`-- Admin users table
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_username VARCHAR(255) UNIQUE NOT NULL,
  telegram_id BIGINT UNIQUE,
  full_name VARCHAR(255),
  permission_level VARCHAR(50) DEFAULT 'sub_admin',
  is_active BOOLEAN DEFAULT TRUE,
  created_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin audit logs table
CREATE TABLE admin_audit_logs (
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

-- Payment admin notes table
CREATE TABLE payment_admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  admin_telegram_id BIGINT NOT NULL,
  admin_username VARCHAR(255),
  note_type VARCHAR(50) DEFAULT 'general',
  note_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add admin columns to crypto_payment_transactions
ALTER TABLE crypto_payment_transactions 
ADD COLUMN IF NOT EXISTS approved_by_admin_id BIGINT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejected_by_admin_id BIGINT,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending';

-- Insert main admin user
INSERT INTO admin_users (telegram_username, permission_level, is_active) 
VALUES ('TTTFOUNDER', 'main_admin', TRUE);`);
      console.log('');
      console.log('3. After running the SQL, restart this script to verify');
      
    } else if (adminCheckError) {
      console.error('❌ Error checking admin_users table:', adminCheckError);
    } else {
      console.log('✅ admin_users table exists!');
      
      // Check if TTTFOUNDER admin exists
      const { data: adminUser, error: adminUserError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('telegram_username', 'TTTFOUNDER')
        .single();
      
      if (adminUserError && adminUserError.code === 'PGRST116') {
        console.log('📝 Creating TTTFOUNDER admin user...');
        const { data: newAdmin, error: createError } = await supabase
          .from('admin_users')
          .insert([{
            telegram_username: 'TTTFOUNDER',
            permission_level: 'main_admin',
            is_active: true
          }])
          .select()
          .single();
        
        if (createError) {
          console.error('❌ Error creating admin user:', createError);
        } else {
          console.log('✅ TTTFOUNDER admin user created:', newAdmin);
        }
      } else if (adminUserError) {
        console.error('❌ Error checking admin user:', adminUserError);
      } else {
        console.log('✅ TTTFOUNDER admin user already exists:', adminUser);
      }
    }

    // Test the current system
    console.log('🧪 Testing current system...');
    
    const { data: payments, error: paymentError } = await supabase
      .from('crypto_payment_transactions')
      .select('*')
      .limit(5);
    
    if (paymentError) {
      console.error('❌ Payment transactions test failed:', paymentError);
    } else {
      console.log(`✅ Payment transactions working! Found ${payments.length} payments`);
    }

    const { data: packages, error: packageError } = await supabase
      .from('investment_packages')
      .select('*')
      .order('price');
    
    if (packageError) {
      console.error('❌ Investment packages test failed:', packageError);
    } else {
      console.log(`✅ Investment packages working! Found ${packages.length} packages`);
    }

    console.log('🎉 Admin system setup completed!');
    
  } catch (error) {
    console.error('❌ Setup error:', error);
    process.exit(1);
  }
}

createAdminTables();
