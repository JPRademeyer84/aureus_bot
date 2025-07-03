const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🚀 Creating Test Table in Supabase...');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestTable() {
  try {
    console.log('\n🏗️ Creating test_connection table...');
    
    // Create table using SQL
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS test_connection (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    // Execute the SQL using a direct query
    const { data, error } = await supabase
      .from('test_connection')
      .select('*')
      .limit(0); // This will fail if table doesn't exist
    
    if (error && error.code === '42P01') {
      // Table doesn't exist, let's create it
      console.log('📋 Table does not exist, creating it...');
      
      // We need to use the REST API directly for DDL operations
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({
          query: createTableSQL
        })
      });
      
      if (!response.ok) {
        // Let's try a different approach - create table manually
        console.log('ℹ️ Direct SQL execution not available. Creating table via Supabase client...');
        
        // Since we can't execute DDL directly, let's just test with an existing table
        // or create it through the dashboard
        console.log('📝 Please create the table manually in Supabase dashboard with this SQL:');
        console.log(createTableSQL);
        
        return false;
      }
      
      console.log('✅ Table created successfully!');
    } else if (error) {
      console.error('❌ Error checking table:', error);
      return false;
    } else {
      console.log('✅ Table already exists!');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error creating table:', error);
    return false;
  }
}

async function testTableOperations() {
  try {
    console.log('\n🧪 Testing table operations...');
    
    // Insert test data
    const { data: insertData, error: insertError } = await supabase
      .from('test_connection')
      .insert([
        { name: 'Test Record 1', description: 'First test record' },
        { name: 'Test Record 2', description: 'Second test record' }
      ])
      .select();
    
    if (insertError) {
      console.error('❌ Failed to insert test data:', insertError);
      return false;
    }
    
    console.log('✅ Test data inserted:', insertData);
    
    // Query test data
    const { data: queryData, error: queryError } = await supabase
      .from('test_connection')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (queryError) {
      console.error('❌ Failed to query test data:', queryError);
      return false;
    }
    
    console.log('✅ Test data queried:', queryData);
    
    // Update test data
    if (queryData && queryData.length > 0) {
      const { data: updateData, error: updateError } = await supabase
        .from('test_connection')
        .update({ description: 'Updated description' })
        .eq('id', queryData[0].id)
        .select();
      
      if (updateError) {
        console.error('❌ Failed to update test data:', updateError);
        return false;
      }
      
      console.log('✅ Test data updated:', updateData);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error in table operations:', error);
    return false;
  }
}

async function main() {
  console.log('🎯 Starting table creation and testing...\n');
  
  // Create table
  const tableCreated = await createTestTable();
  if (!tableCreated) {
    console.log('\n📝 Manual table creation required. Please run this SQL in your Supabase dashboard:');
    console.log(`
CREATE TABLE IF NOT EXISTS test_connection (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
    `);
    console.log('\nThen run this script again to test operations.');
    return;
  }
  
  // Test operations
  const operationsOk = await testTableOperations();
  if (!operationsOk) {
    console.log('❌ Table operations failed.');
    return;
  }
  
  console.log('\n🎉 All tests passed! Table created and operations working.');
}

main().catch(console.error);
