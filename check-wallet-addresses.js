const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🔍 Checking company wallet addresses in database...');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkWallets() {
  try {
    console.log('📊 Fetching all company wallets...\n');
    
    const { data: wallets, error } = await supabase
      .from('company_wallets')
      .select('*')
      .order('network');

    if (error) {
      console.error('❌ Error fetching wallets:', error);
      return;
    }

    if (!wallets || wallets.length === 0) {
      console.log('⚠️ No company wallets found in database!');
      console.log('🔧 You need to insert wallet addresses into company_wallets table');
      return;
    }

    console.log(`✅ Found ${wallets.length} company wallets:\n`);
    
    wallets.forEach(wallet => {
      console.log(`🏦 ${wallet.network} ${wallet.currency}:`);
      console.log(`   Address: ${wallet.wallet_address}`);
      console.log(`   Active: ${wallet.is_active ? '✅' : '❌'}`);
      console.log(`   Created: ${new Date(wallet.created_at).toLocaleString()}`);
      console.log('');
    });

    // Check specifically for TRON USDT (what the bot uses)
    const tronWallet = wallets.find(w => w.network === 'TRON' && w.currency === 'USDT' && w.is_active);
    
    if (tronWallet) {
      console.log('🎯 TRON USDT wallet found (bot will use this):');
      console.log(`   ${tronWallet.wallet_address}`);
    } else {
      console.log('❌ No active TRON USDT wallet found!');
      console.log('🔧 Bot will fail when creating payments');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkWallets();
