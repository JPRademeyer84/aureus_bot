require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPortfolio() {
  console.log('📊 Testing Portfolio Data...');
  
  try {
    // Get all users with investments
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name');
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    console.log(`👥 Found ${users.length} users`);

    for (const user of users) {
      console.log(`\n👤 User: ${user.full_name} (${user.email})`);
      
      // Get user investments
      const { data: investments, error: investmentError } = await supabase
        .from('aureus_investments')
        .select(`
          *,
          investment_packages (
            name,
            price,
            shares,
            annual_dividends,
            quarter_dividends
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (investmentError) {
        console.error('❌ Investment fetch error:', investmentError);
        continue;
      }

      if (!investments || investments.length === 0) {
        console.log('   📋 No investments found');
        continue;
      }

      console.log(`   📈 Found ${investments.length} investments:`);
      
      let totalInvestment = 0;
      let totalShares = 0;
      let totalAnnualDividends = 0;

      investments.forEach((inv, index) => {
        const packageName = inv.investment_packages?.name || 'Unknown Package';
        const amount = parseFloat(inv.amount || 0);
        const shares = parseInt(inv.shares || 0);
        const annualDividends = parseFloat(inv.investment_packages?.annual_dividends || 0);

        totalInvestment += amount;
        totalShares += shares;
        totalAnnualDividends += annualDividends;
        
        console.log(`   ${index + 1}. ${packageName}`);
        console.log(`      💰 Amount: $${amount.toFixed(2)}`);
        console.log(`      📊 Shares: ${shares.toLocaleString()}`);
        console.log(`      📅 Date: ${new Date(inv.created_at).toLocaleDateString()}`);
        console.log(`      🔄 Status: ${inv.status}`);
        console.log(`      💵 Annual Dividends: $${annualDividends.toFixed(2)}`);
      });

      console.log(`   📊 PORTFOLIO SUMMARY:`);
      console.log(`      💰 Total Investment: $${totalInvestment.toFixed(2)}`);
      console.log(`      📊 Total Shares: ${totalShares.toLocaleString()}`);
      console.log(`      💵 Annual Dividends: $${totalAnnualDividends.toFixed(2)}`);
      console.log(`      💰 Quarterly Dividends: $${(totalAnnualDividends / 4).toFixed(2)}`);

      // Check if user has Telegram account
      const { data: telegramUser, error: telegramError } = await supabase
        .from('telegram_users')
        .select('telegram_id')
        .eq('user_id', user.id)
        .single();
      
      if (!telegramError && telegramUser) {
        console.log(`   📱 Telegram ID: ${telegramUser.telegram_id}`);
      } else {
        console.log(`   📱 No Telegram account linked`);
      }
    }

    // Check payment status
    console.log('\n💳 Payment Status Check:');
    const { data: payments, error: paymentsError } = await supabase
      .from('crypto_payment_transactions')
      .select(`
        *,
        users (full_name, email),
        aureus_investments (*)
      `)
      .order('created_at', { ascending: false });
    
    if (paymentsError) {
      console.error('❌ Payments fetch error:', paymentsError);
    } else {
      payments.forEach(payment => {
        console.log(`   💳 Payment ${payment.id.substring(0, 8)}...`);
        console.log(`      👤 User: ${payment.users?.full_name}`);
        console.log(`      💰 Amount: $${payment.amount} ${payment.currency}`);
        console.log(`      🔄 Status: ${payment.status}`);
        console.log(`      🔗 Investment ID: ${payment.investment_id}`);
        if (payment.aureus_investments) {
          console.log(`      💎 Investment Status: ${payment.aureus_investments.status}`);
          console.log(`      📊 Shares: ${payment.aureus_investments.shares}`);
          console.log(`      💰 Investment Amount: $${payment.aureus_investments.amount}`);
        } else {
          console.log(`      ❌ No investment record found`);
        }
        console.log('');
      });
    }

    console.log('✅ Portfolio test completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testPortfolio();
