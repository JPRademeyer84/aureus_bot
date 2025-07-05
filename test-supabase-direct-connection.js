const { Client } = require('pg');
require('dotenv').config();

console.log('🔍 Testing Supabase Direct PostgreSQL Connection...\n');

async function testConnection(config, description) {
  console.log(`🧪 Testing: ${description}`);
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}`);
  
  const client = new Client(config);
  
  try {
    console.log('   Connecting...');
    await client.connect();
    console.log('   ✅ Connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('   ✅ Query test passed:', result.rows[0].current_time);
    
    await client.end();
    return true;
  } catch (error) {
    console.log('   ❌ Connection failed:', error.message);
    try {
      await client.end();
    } catch (e) {
      // Ignore cleanup errors
    }
    return false;
  }
}

async function main() {
  const baseConfig = {
    host: process.env.SUPABASE_DB_HOST,
    database: process.env.SUPABASE_DB_NAME,
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
  };
  
  console.log('📋 Base configuration from .env:');
  console.log('   SUPABASE_DB_HOST:', process.env.SUPABASE_DB_HOST);
  console.log('   SUPABASE_DB_PORT:', process.env.SUPABASE_DB_PORT);
  console.log('   SUPABASE_DB_NAME:', process.env.SUPABASE_DB_NAME);
  console.log('   SUPABASE_DB_USER:', process.env.SUPABASE_DB_USER);
  console.log('   SUPABASE_DB_PASSWORD:', process.env.SUPABASE_DB_PASSWORD ? 'Set' : 'Not set');
  console.log('');
  
  const testConfigs = [
    // Standard port with SSL
    {
      ...baseConfig,
      port: 5432,
      ssl: { rejectUnauthorized: false }
    },
    
    // Standard port without SSL (unlikely to work)
    {
      ...baseConfig,
      port: 5432,
      ssl: false
    },
    
    // Alternative port 6543 (sometimes used by Supabase)
    {
      ...baseConfig,
      port: 6543,
      ssl: { rejectUnauthorized: false }
    },
    
    // Connection pooler port (if available)
    {
      ...baseConfig,
      host: `aws-0-us-east-1.pooler.supabase.com`, // This might not be correct for your region
      port: 5432,
      ssl: { rejectUnauthorized: false }
    }
  ];
  
  const descriptions = [
    'Standard port 5432 with SSL',
    'Standard port 5432 without SSL',
    'Alternative port 6543 with SSL',
    'Connection pooler (example)'
  ];
  
  let successCount = 0;
  
  for (let i = 0; i < testConfigs.length; i++) {
    const success = await testConnection(testConfigs[i], descriptions[i]);
    if (success) {
      successCount++;
      console.log('   🎉 This configuration works!\n');
    } else {
      console.log('');
    }
  }
  
  console.log(`📊 Results: ${successCount}/${testConfigs.length} configurations worked`);
  
  if (successCount === 0) {
    console.log('\n❌ No direct PostgreSQL connections worked.');
    console.log('\n💡 Possible reasons:');
    console.log('1. Supabase project might not allow direct connections');
    console.log('2. Your network/firewall might be blocking port 5432');
    console.log('3. The database credentials might be incorrect');
    console.log('4. Supabase might require connection pooling');
    
    console.log('\n🔧 Alternative solutions:');
    console.log('1. Use Supabase REST API instead of direct PostgreSQL');
    console.log('2. Check Supabase dashboard for correct connection details');
    console.log('3. Enable direct connections in Supabase settings (if available)');
    console.log('4. Use Supabase CLI to create tables');
    
    console.log('\n📝 Let\'s try the REST API approach instead...');
  }
}

main().catch(console.error);
