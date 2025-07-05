const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🚀 Creating Tables via Supabase API...\n');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// First, let's create a custom SQL execution function in Supabase
async function createSQLExecutionFunction() {
  console.log('🔧 Creating SQL execution function...');
  
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION execute_sql(query_text TEXT)
    RETURNS TEXT
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE query_text;
      RETURN 'SUCCESS';
    EXCEPTION
      WHEN OTHERS THEN
        RETURN 'ERROR: ' || SQLERRM;
    END;
    $$;
  `;
  
  try {
    // Try to create the function using a direct API call
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        query_text: createFunctionSQL
      })
    });
    
    if (response.ok) {
      console.log('✅ SQL execution function created');
      return true;
    } else {
      console.log('⚠️ Could not create SQL function via API');
      return false;
    }
  } catch (error) {
    console.log('⚠️ Could not create SQL function:', error.message);
    return false;
  }
}

async function executeSQL(sql, description) {
  console.log(`🏗️ ${description}...`);
  
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query_text: sql
    });
    
    if (error) {
      console.log(`❌ Failed: ${error.message}`);
      return false;
    }
    
    if (data && data.startsWith('ERROR:')) {
      console.log(`❌ SQL Error: ${data}`);
      return false;
    }
    
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    return false;
  }
}

async function createTablesDirectly() {
  console.log('📝 Creating tables using direct SQL execution...\n');
  
  const tables = [
    {
      name: 'test_connection',
      sql: `
        CREATE TABLE IF NOT EXISTS test_connection (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'users',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(255),
          phone VARCHAR(50),
          address TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          is_verified BOOLEAN DEFAULT FALSE,
          verification_token VARCHAR(255),
          reset_token VARCHAR(255),
          reset_token_expires TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      `
    },
    {
      name: 'telegram_users',
      sql: `
        CREATE TABLE IF NOT EXISTS telegram_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          telegram_id BIGINT UNIQUE NOT NULL,
          username VARCHAR(255),
          first_name VARCHAR(255),
          last_name VARCHAR(255),
          is_registered BOOLEAN DEFAULT FALSE,
          registration_step VARCHAR(50) DEFAULT 'start',
          registration_mode VARCHAR(20) DEFAULT 'login',
          temp_email VARCHAR(255),
          temp_password VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON telegram_users(telegram_id);
        CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id ON telegram_users(user_id);
      `
    },
    // Investment packages table removed - using custom amounts only
  ];
  
  let successCount = 0;
  
  for (const table of tables) {
    const success = await executeSQL(table.sql, `Creating ${table.name} table`);
    if (success) {
      successCount++;
    }
  }
  
  console.log(`\n📊 Results: ${successCount}/${tables.length} tables created successfully`);
  return successCount === tables.length;
}

async function insertSampleData() {
  console.log('\n📝 Inserting sample data...\n');
  
  const sampleDataQueries = [
    // Sample investment packages removed - using custom amounts only
        ('Premium Package', 'For serious investors wanting maximum returns and benefits', 10000.00, 1000, 18.00, 1800.00, 450.00, '["VIP support", "Monthly reports", "Personal advisor", "Exclusive events"]'::jsonb),
        ('Elite Package', 'Ultimate investment package with highest returns and premium benefits', 25000.00, 2500, 22.00, 5500.00, 1375.00, '["24/7 support", "Weekly reports", "Dedicated advisor", "Exclusive events", "NFT certificate"]'::jsonb)
        ON CONFLICT DO NOTHING;
      `
    },
    {
      description: 'Test connection data',
      sql: `
        INSERT INTO test_connection (name, description) VALUES
        ('Database Setup Test', 'This record confirms the database setup was successful'),
        ('Connection Verification', 'This record verifies that CRUD operations are working')
        ON CONFLICT DO NOTHING;
      `
    }
  ];
  
  let successCount = 0;
  
  for (const query of sampleDataQueries) {
    const success = await executeSQL(query.sql, `Inserting ${query.description}`);
    if (success) {
      successCount++;
    }
  }
  
  console.log(`\n📊 Sample data: ${successCount}/${sampleDataQueries.length} queries executed successfully`);
  return successCount === sampleDataQueries.length;
}

async function testTableOperations() {
  console.log('\n🧪 Testing table operations...\n');
  
  try {
    // Test reading from investment_packages
    const { data: packages, error: packagesError } = await supabase
      .from('investment_packages')
      .select('*')
      .limit(3);
    
    if (packagesError) {
      console.log('❌ Failed to read investment packages:', packagesError.message);
      return false;
    }
    
    console.log(`✅ Successfully read ${packages.length} investment packages`);
    
    // Test reading from test_connection
    const { data: testData, error: testError } = await supabase
      .from('test_connection')
      .select('*');
    
    if (testError) {
      console.log('❌ Failed to read test_connection:', testError.message);
      return false;
    }
    
    console.log(`✅ Successfully read ${testData.length} test records`);
    
    return true;
  } catch (error) {
    console.log('❌ Table operations test failed:', error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🎯 Starting table creation via Supabase API...\n');
    
    // Try to create the SQL execution function first
    const functionCreated = await createSQLExecutionFunction();
    
    if (!functionCreated) {
      console.log('\n📝 SQL execution function not available.');
      console.log('Please create the tables manually in Supabase SQL Editor using the schema from database-schema.sql');
      console.log('\nAlternatively, enable external PostgreSQL access in your Supabase settings.');
      return;
    }
    
    // Create tables
    const tablesCreated = await createTablesDirectly();
    
    if (!tablesCreated) {
      console.log('\n❌ Some tables failed to create. Check the errors above.');
      return;
    }
    
    // Insert sample data
    const dataInserted = await insertSampleData();
    
    // Test operations
    const operationsWork = await testTableOperations();
    
    if (tablesCreated && operationsWork) {
      console.log('\n🎉 Success! All tables created and working properly.');
      console.log('\n🚀 You can now run the bot: node aureus-bot-supabase.js');
    } else {
      console.log('\n⚠️ Tables created but some operations failed. Check the errors above.');
    }
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
  }
}

main();
