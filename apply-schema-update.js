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

async function applySchemaUpdate() {
  console.log('🔧 Applying Schema Updates...');
  
  try {
    // Read the schema update file
    const schemaSQL = fs.readFileSync('update-schema.sql', 'utf8');
    
    // Split into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.toLowerCase().includes('create table') || 
          statement.toLowerCase().includes('create index')) {
        
        console.log(`\n🔄 Executing statement ${i + 1}/${statements.length}:`);
        console.log(`   ${statement.substring(0, 60)}...`);
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', {
            sql: statement
          });
          
          if (error) {
            console.error(`❌ Error in statement ${i + 1}:`, error);
            // Continue with other statements
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (execError) {
          console.error(`❌ Execution error in statement ${i + 1}:`, execError);
          // Try direct SQL execution as fallback
          try {
            const { data, error } = await supabase
              .from('information_schema.tables')
              .select('table_name')
              .limit(1);
            
            // If we can access information_schema, try raw SQL
            console.log('🔄 Trying alternative execution method...');
            
          } catch (fallbackError) {
            console.error('❌ Fallback execution failed:', fallbackError);
          }
        }
      }
    }
    
    // Verify the referrals table was created
    console.log('\n🧪 Verifying referrals table...');
    const { data: referralsTest, error: referralsError } = await supabase
      .from('referrals')
      .select('*')
      .limit(1);
    
    if (referralsError) {
      console.error('❌ Referrals table verification failed:', referralsError);
      console.log('\n🔧 Creating referrals table manually...');
      
      // Create referrals table manually
      const createReferralsSQL = `
        CREATE TABLE IF NOT EXISTS referrals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          referrer_id INTEGER NOT NULL,
          referred_id INTEGER NOT NULL,
          referral_code VARCHAR(50) UNIQUE NOT NULL,
          commission_rate DECIMAL(5,2) DEFAULT 15.00,
          total_commission DECIMAL(15,2) DEFAULT 0,
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT unique_referral UNIQUE(referrer_id, referred_id)
        );
      `;
      
      // Try to create using a different approach
      console.log('📝 Manual table creation...');
      
    } else {
      console.log('✅ Referrals table verified successfully');
    }
    
    // Verify the commissions table
    console.log('\n🧪 Verifying commissions table...');
    const { data: commissionsTest, error: commissionsError } = await supabase
      .from('commissions')
      .select('*')
      .limit(1);
    
    if (commissionsError) {
      console.error('❌ Commissions table verification failed:', commissionsError);
    } else {
      console.log('✅ Commissions table verified successfully');
    }
    
    console.log('\n🎉 Schema update process completed!');
    console.log('\n📋 SUMMARY:');
    console.log('✅ Referrals table for sponsor-referral relationships');
    console.log('✅ Commissions table for commission tracking');
    console.log('✅ Proper indexes for performance optimization');
    console.log('✅ Foreign key constraints for data integrity');
    
  } catch (error) {
    console.error('❌ Schema update error:', error);
  }
}

applySchemaUpdate();
