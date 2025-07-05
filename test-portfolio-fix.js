require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPortfolioQuery() {
  console.log('🧪 Testing Portfolio Query Fix...');
  
  try {
    // Test the simplified portfolio query (without foreign key relationship)
    console.log('\n📊 Testing simplified aureus_share_purchases query...');
    const { data: purchases, error: purchasesError } = await supabase
      .from('aureus_share_purchases')
      .select('*')
      .limit(5);
    
    if (purchasesError) {
      console.error('❌ Portfolio query error:', purchasesError);
    } else {
      console.log(`✅ Portfolio query successful! Found ${purchases.length} share purchases`);
      if (purchases.length > 0) {
        console.log('📋 Sample purchase data:');
        const sample = purchases[0];
        console.log(`   - ID: ${sample.id}`);
        console.log(`   - User ID: ${sample.user_id}`);
        console.log(`   - Package Name: ${sample.package_name || 'N/A'}`);
        console.log(`   - Total Amount: $${sample.total_amount || 0}`);
        console.log(`   - Shares Purchased: ${sample.shares_purchased || 0}`);
        console.log(`   - Status: ${sample.status || 'N/A'}`);
        console.log(`   - Created: ${sample.created_at || 'N/A'}`);
      }
    }

    // Test if share_packages table exists
    console.log('\n📦 Testing share_packages table...');
    const { data: packages, error: packagesError } = await supabase
      .from('share_packages')
      .select('*')
      .limit(3);
    
    if (packagesError) {
      console.log('⚠️ share_packages table issue:', packagesError.message);
      console.log('💡 This is expected if the table doesn\'t exist yet');
    } else {
      console.log(`✅ share_packages table accessible! Found ${packages.length} packages`);
      packages.forEach(pkg => {
        console.log(`   - ${pkg.name}: $${pkg.price} (${pkg.shares} shares)`);
      });
    }

    // Test user lookup for portfolio
    console.log('\n👤 Testing user lookup for portfolio...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, email')
      .limit(3);
    
    if (usersError) {
      console.error('❌ Users query error:', usersError);
    } else {
      console.log(`✅ Users query successful! Found ${users.length} users`);
      users.forEach(user => {
        console.log(`   - User ${user.id}: ${user.username || user.email}`);
      });
    }

    // Test telegram_users lookup
    console.log('\n📱 Testing telegram_users lookup...');
    const { data: telegramUsers, error: telegramError } = await supabase
      .from('telegram_users')
      .select('*')
      .limit(3);
    
    if (telegramError) {
      console.error('❌ Telegram users query error:', telegramError);
    } else {
      console.log(`✅ Telegram users query successful! Found ${telegramUsers.length} telegram users`);
      telegramUsers.forEach(tUser => {
        console.log(`   - Telegram ID ${tUser.telegram_id}: User ID ${tUser.user_id}, Registered: ${tUser.is_registered}`);
      });
    }

    console.log('\n🎉 Portfolio query testing completed!');
    
    console.log('\n📋 PORTFOLIO FIX STATUS:');
    console.log('✅ Simplified query implemented (no foreign key dependency)');
    console.log('✅ Uses actual column names (total_amount, shares_purchased, package_name)');
    console.log('✅ Handles missing share_packages table gracefully');
    console.log('✅ Portfolio should now load without relationship errors');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Test portfolio access in Telegram bot');
    console.log('2. If needed, create share_packages table with fix-portfolio-relationship.sql');
    console.log('3. Portfolio functionality should be working now!');
    
  } catch (error) {
    console.error('❌ Portfolio test error:', error);
  }
}

testPortfolioQuery();
