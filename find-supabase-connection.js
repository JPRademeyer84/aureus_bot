require('dotenv').config();

console.log('🔍 Checking Supabase Connection Details...\n');

console.log('📋 Current .env configuration:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_DB_HOST:', process.env.SUPABASE_DB_HOST);
console.log('SUPABASE_DB_PORT:', process.env.SUPABASE_DB_PORT);
console.log('SUPABASE_DB_NAME:', process.env.SUPABASE_DB_NAME);
console.log('SUPABASE_DB_USER:', process.env.SUPABASE_DB_USER);
console.log('SUPABASE_DB_PASSWORD:', process.env.SUPABASE_DB_PASSWORD ? 'Set' : 'Not set');

console.log('\n🎯 To find the correct database connection details:');
console.log('1. Go to your Supabase dashboard');
console.log('2. Click on "Settings" in the left sidebar');
console.log('3. Click on "Database"');
console.log('4. Look for "Connection info" or "Connection string"');
console.log('5. The host should be something like:');
console.log('   - aws-0-[region].pooler.supabase.com');
console.log('   - or db.[project-ref].supabase.co');

console.log('\n🔧 Alternative approach - Extract from SUPABASE_URL:');
if (process.env.SUPABASE_URL) {
  const url = new URL(process.env.SUPABASE_URL);
  const projectRef = url.hostname.split('.')[0];
  
  console.log('Project reference:', projectRef);
  console.log('Suggested database host:', `db.${projectRef}.supabase.co`);
  
  console.log('\n📝 Try updating your .env file with:');
  console.log(`SUPABASE_DB_HOST=db.${projectRef}.supabase.co`);
}

console.log('\n🌐 You can also try these alternative connection methods:');
console.log('1. Connection pooler (recommended for production):');
console.log('   Host: aws-0-[region].pooler.supabase.com');
console.log('   Port: 5432');
console.log('');
console.log('2. Direct connection:');
console.log('   Host: db.[project-ref].supabase.co');
console.log('   Port: 5432');
console.log('');
console.log('3. IPv6 connection (if available):');
console.log('   Host: [project-ref].supabase.co');
console.log('   Port: 5432');

console.log('\n💡 If the hostname is still not working:');
console.log('1. Check if your network/firewall blocks port 5432');
console.log('2. Try using the connection pooler instead');
console.log('3. Verify the project is active in Supabase dashboard');
console.log('4. Check if the database password is correct');

console.log('\n🔐 Security note:');
console.log('Make sure you are using the postgres user password, not the service role key for direct DB connections.');
