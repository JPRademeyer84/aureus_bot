const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTermsTable() {
  console.log('🏗️ Creating terms_acceptance table...');
  
  try {
    const { data, error } = await supabase.rpc('create_terms_table');
    
    if (error) {
      console.error('❌ Error creating table:', error);
      
      // Try direct SQL approach
      console.log('🔄 Trying direct SQL approach...');
      
      const createSQL = `
        CREATE TABLE IF NOT EXISTS terms_acceptance (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id INTEGER,
          telegram_id BIGINT,
          terms_type VARCHAR(100) NOT NULL,
          version VARCHAR(20) DEFAULT '1.0',
          accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_terms_acceptance_telegram_id ON terms_acceptance(telegram_id);
        CREATE INDEX IF NOT EXISTS idx_terms_acceptance_terms_type ON terms_acceptance(terms_type);
      `;
      
      const { data: sqlData, error: sqlError } = await supabase.rpc('exec_sql', { sql: createSQL });
      
      if (sqlError) {
        console.error('❌ SQL Error:', sqlError);
        console.log('📝 Manual SQL to run in Supabase dashboard:');
        console.log(createSQL);
      } else {
        console.log('✅ Terms acceptance table created successfully!');
      }
    } else {
      console.log('✅ Terms acceptance table created successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    console.log('\n📝 MANUAL STEPS:');
    console.log('1. Go to Supabase dashboard');
    console.log('2. Open SQL Editor');
    console.log('3. Run this SQL:');
    console.log(`
CREATE TABLE IF NOT EXISTS terms_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER,
  telegram_id BIGINT,
  terms_type VARCHAR(100) NOT NULL,
  version VARCHAR(20) DEFAULT '1.0',
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptance_telegram_id ON terms_acceptance(telegram_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_terms_type ON terms_acceptance(terms_type);
    `);
  }
}

createTermsTable();
