const { db } = require('./src/database/supabase-client');
const fs = require('fs');

async function createEscrowFunctions() {
  try {
    console.log('🔧 Creating missing commission escrow functions...');
    
    // Read the SQL file
    const sqlContent = fs.readFileSync('./create-commission-escrow-function.sql', 'utf8');
    
    // Split by function definitions and execute each one
    const functions = sqlContent.split('CREATE OR REPLACE FUNCTION');
    
    for (let i = 1; i < functions.length; i++) {
      const functionSQL = 'CREATE OR REPLACE FUNCTION' + functions[i];
      
      // Extract function name for logging
      const nameMatch = functionSQL.match(/public\.(\w+)\(/);
      const functionName = nameMatch ? nameMatch[1] : `function_${i}`;
      
      console.log(`📝 Creating function: ${functionName}`);
      
      try {
        const { error } = await db.client.rpc('exec', { sql: functionSQL });
        
        if (error) {
          console.error(`❌ Error creating ${functionName}:`, error);
        } else {
          console.log(`✅ Successfully created function: ${functionName}`);
        }
      } catch (rpcError) {
        // If RPC exec doesn't work, try direct query
        console.log(`🔄 Trying direct query for ${functionName}...`);
        
        try {
          const { error: queryError } = await db.client.from('_').select('*').limit(0);
          // This is just to test connection, the actual function creation needs to be done manually
          console.log(`⚠️ Cannot create functions via bot. Please run the SQL manually.`);
          console.log(`📋 SQL for ${functionName}:`);
          console.log(functionSQL);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } catch (testError) {
          console.error(`❌ Database connection error:`, testError);
        }
      }
    }
    
    console.log('🎯 Function creation process completed.');
    console.log('📋 If functions were not created automatically, please run the SQL manually in your database.');
    
  } catch (error) {
    console.error('❌ Error in createEscrowFunctions:', error);
  }
}

// Run the function
createEscrowFunctions().then(() => {
  console.log('✅ Script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
