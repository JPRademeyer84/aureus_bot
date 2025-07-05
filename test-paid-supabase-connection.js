const { Client } = require('pg');
require('dotenv').config();

console.log('🔍 Testing Supabase Paid Plan PostgreSQL Connection...\n');

async function testConnectionWithTimeout(config, description, timeoutMs = 10000) {
  console.log(`🧪 Testing: ${description}`);
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}`);
  console.log(`   SSL: ${config.ssl ? 'Enabled' : 'Disabled'}`);
  
  const client = new Client(config);
  
  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => {
      console.log(`   ⏰ Connection timed out after ${timeoutMs}ms`);
      client.end().catch(() => {});
      resolve(false);
    }, timeoutMs);
    
    try {
      console.log('   🔌 Connecting...');
      await client.connect();
      clearTimeout(timeout);
      
      console.log('   ✅ Connection successful!');
      
      // Test a simple query
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      console.log('   ✅ Query test passed');
      console.log('   📅 Server time:', result.rows[0].current_time);
      console.log('   🗄️ PostgreSQL version:', result.rows[0].pg_version.split(' ')[0]);
      
      await client.end();
      resolve(true);
    } catch (error) {
      clearTimeout(timeout);
      console.log('   ❌ Connection failed:', error.message);
      console.log('   🔍 Error code:', error.code);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('   💡 Connection refused - check if external access is enabled');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('   💡 Connection timed out - check firewall/network settings');
      } else if (error.code === '28P01') {
        console.log('   💡 Authentication failed - check username/password');
      } else if (error.code === '3D000') {
        console.log('   💡 Database does not exist - check database name');
      }
      
      try {
        await client.end();
      } catch (e) {
        // Ignore cleanup errors
      }
      resolve(false);
    }
  });
}

async function main() {
  console.log('📋 Current .env configuration:');
  console.log('   SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('   SUPABASE_DB_HOST:', process.env.SUPABASE_DB_HOST);
  console.log('   SUPABASE_DB_PORT:', process.env.SUPABASE_DB_PORT);
  console.log('   SUPABASE_DB_NAME:', process.env.SUPABASE_DB_NAME);
  console.log('   SUPABASE_DB_USER:', process.env.SUPABASE_DB_USER);
  console.log('   SUPABASE_DB_PASSWORD:', process.env.SUPABASE_DB_PASSWORD ? 'Set' : 'Not set');
  console.log('');
  
  const baseConfig = {
    host: process.env.SUPABASE_DB_HOST,
    database: process.env.SUPABASE_DB_NAME,
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
  };
  
  // Test different connection configurations
  const testConfigs = [
    // Standard configuration with SSL
    {
      ...baseConfig,
      port: parseInt(process.env.SUPABASE_DB_PORT) || 5432,
      ssl: { rejectUnauthorized: false }
    },
    
    // Try with different SSL settings
    {
      ...baseConfig,
      port: parseInt(process.env.SUPABASE_DB_PORT) || 5432,
      ssl: { 
        rejectUnauthorized: false,
        require: true 
      }
    },
    
    // Try connection pooler (common for paid plans)
    {
      ...baseConfig,
      host: process.env.SUPABASE_DB_HOST.replace('.supabase.co', '.pooler.supabase.com'),
      port: 5432,
      ssl: { rejectUnauthorized: false }
    },
    
    // Try port 6543 (alternative Supabase port)
    {
      ...baseConfig,
      port: 6543,
      ssl: { rejectUnauthorized: false }
    }
  ];
  
  const descriptions = [
    'Standard configuration with SSL',
    'Standard configuration with required SSL',
    'Connection pooler',
    'Alternative port 6543'
  ];
  
  let successCount = 0;
  
  for (let i = 0; i < testConfigs.length; i++) {
    const success = await testConnectionWithTimeout(testConfigs[i], descriptions[i], 15000);
    if (success) {
      successCount++;
      console.log('   🎉 This configuration works! Use this for your database setup.\n');
      
      // Save working config for reference
      console.log('   📝 Working configuration:');
      console.log('   ```');
      console.log('   SUPABASE_DB_HOST=' + testConfigs[i].host);
      console.log('   SUPABASE_DB_PORT=' + testConfigs[i].port);
      console.log('   SUPABASE_DB_NAME=' + testConfigs[i].database);
      console.log('   SUPABASE_DB_USER=' + testConfigs[i].user);
      console.log('   SUPABASE_DB_PASSWORD=' + testConfigs[i].password);
      console.log('   ```\n');
      
      break; // Stop after first successful connection
    } else {
      console.log('');
    }
  }
  
  console.log(`📊 Results: ${successCount}/${testConfigs.length} configurations worked`);
  
  if (successCount === 0) {
    console.log('\n❌ No direct PostgreSQL connections worked.');
    console.log('\n🔧 Next steps for paid plan:');
    console.log('1. Go to Supabase Dashboard → Settings → Database');
    console.log('2. Look for "Connection Pooling" or "Network Access"');
    console.log('3. Enable external connections or add your IP to allowlist');
    console.log('4. Check if the connection details are correct');
    console.log('5. Verify your plan includes direct database access');
    
    console.log('\n💡 Alternative: Get connection string from dashboard');
    console.log('Look for a connection string like:');
    console.log('postgresql://postgres:[password]@[host]:[port]/postgres');
  } else {
    console.log('\n✅ Connection successful! You can now create tables directly.');
  }
}

main().catch(console.error);
