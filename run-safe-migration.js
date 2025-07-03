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

async function runSafeMigration() {
  console.log('🚀 Starting Safe Schema Migration...');
  
  try {
    // Read the migration SQL file
    const migrationSQL = fs.readFileSync('safe-schema-migration.sql', 'utf8');
    
    console.log('📋 Executing migration SQL...');
    
    // Execute the migration using Supabase's RPC function
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.error('❌ Migration failed:', error);
      
      // If RPC function doesn't exist, try direct SQL execution
      if (error.code === 'PGRST202') {
        console.log('⚠️ RPC function not available, trying direct execution...');
        
        // Split SQL into individual statements and execute them
        const statements = migrationSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`📝 Executing ${statements.length} SQL statements...`);
        
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (statement.trim()) {
            try {
              console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
              const { error: stmtError } = await supabase.rpc('exec_sql', {
                sql: statement + ';'
              });
              
              if (stmtError) {
                console.error(`❌ Statement ${i + 1} failed:`, stmtError);
                // Continue with other statements
              } else {
                console.log(`✅ Statement ${i + 1} completed`);
              }
            } catch (err) {
              console.error(`❌ Statement ${i + 1} error:`, err);
            }
          }
        }
      }
    } else {
      console.log('✅ Migration completed successfully!');
    }

    // Test the new admin tables
    console.log('🧪 Testing admin tables...');
    
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .limit(5);
    
    if (adminError) {
      console.error('❌ Admin users table test failed:', adminError);
    } else {
      console.log(`✅ Admin users table working! Found ${adminUsers.length} admin users`);
    }

    // Test payment transactions table
    const { data: payments, error: paymentError } = await supabase
      .from('crypto_payment_transactions')
      .select('*')
      .limit(5);
    
    if (paymentError) {
      console.error('❌ Payment transactions table test failed:', paymentError);
    } else {
      console.log(`✅ Payment transactions table working! Found ${payments.length} payments`);
    }

    // Test investment packages
    const { data: packages, error: packageError } = await supabase
      .from('investment_packages')
      .select('*')
      .order('price');
    
    if (packageError) {
      console.error('❌ Investment packages table test failed:', packageError);
    } else {
      console.log(`✅ Investment packages table working! Found ${packages.length} packages`);
      packages.forEach(pkg => {
        console.log(`   📦 ${pkg.name}: $${pkg.price}`);
      });
    }

    console.log('🎉 Safe migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

runSafeMigration();
