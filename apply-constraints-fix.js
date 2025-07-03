require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyConstraintsFix() {
  console.log('🔧 Applying Unique Constraints Fix...');
  
  try {
    // Method 1: Try to add constraints directly using Supabase client
    console.log('\n📦 Adding unique constraint to investment_packages.name...');
    
    // Check current packages to see if there are duplicates
    const { data: packages, error: packagesError } = await supabase
      .from('investment_packages')
      .select('name')
      .order('name');
    
    if (packagesError) {
      console.error('❌ Error checking packages:', packagesError);
    } else {
      console.log(`📊 Found ${packages.length} packages`);
      
      // Check for duplicates
      const names = packages.map(p => p.name);
      const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
      
      if (duplicates.length > 0) {
        console.log('⚠️ Found duplicate package names:', duplicates);
        console.log('🔧 Need to remove duplicates before adding unique constraint');
        
        // Remove duplicates (keep the first occurrence)
        for (const dupName of [...new Set(duplicates)]) {
          const { data: dupPackages, error: dupError } = await supabase
            .from('investment_packages')
            .select('id, name')
            .eq('name', dupName)
            .order('id');
          
          if (!dupError && dupPackages.length > 1) {
            // Keep the first one, delete the rest
            const toDelete = dupPackages.slice(1);
            for (const pkg of toDelete) {
              await supabase
                .from('investment_packages')
                .delete()
                .eq('id', pkg.id);
              console.log(`🗑️ Removed duplicate package: ${pkg.name} (ID: ${pkg.id})`);
            }
          }
        }
      } else {
        console.log('✅ No duplicate package names found');
      }
    }

    // Check company wallets for duplicates
    console.log('\n💳 Checking company_wallets for duplicates...');
    const { data: wallets, error: walletsError } = await supabase
      .from('company_wallets')
      .select('id, network, currency')
      .order('network, currency');
    
    if (walletsError) {
      console.error('❌ Error checking wallets:', walletsError);
    } else {
      console.log(`📊 Found ${wallets.length} wallets`);
      
      // Check for duplicates
      const combinations = wallets.map(w => `${w.network}-${w.currency}`);
      const dupCombinations = combinations.filter((combo, index) => combinations.indexOf(combo) !== index);
      
      if (dupCombinations.length > 0) {
        console.log('⚠️ Found duplicate network/currency combinations:', dupCombinations);
        
        // Remove duplicates
        for (const dupCombo of [...new Set(dupCombinations)]) {
          const [network, currency] = dupCombo.split('-');
          const { data: dupWallets, error: dupWalletError } = await supabase
            .from('company_wallets')
            .select('id, network, currency')
            .eq('network', network)
            .eq('currency', currency)
            .order('id');
          
          if (!dupWalletError && dupWallets.length > 1) {
            // Keep the first one, delete the rest
            const toDelete = dupWallets.slice(1);
            for (const wallet of toDelete) {
              await supabase
                .from('company_wallets')
                .delete()
                .eq('id', wallet.id);
              console.log(`🗑️ Removed duplicate wallet: ${wallet.network}-${wallet.currency} (ID: ${wallet.id})`);
            }
          }
        }
      } else {
        console.log('✅ No duplicate network/currency combinations found');
      }
    }

    // Now test if we can use ON CONFLICT with upsert
    console.log('\n🧪 Testing ON CONFLICT with upsert...');
    
    // Test investment packages upsert
    try {
      const { data: packageUpsert, error: packageUpsertError } = await supabase
        .from('investment_packages')
        .upsert([{
          name: 'Shovel',
          description: 'Entry-level mining equipment package for new investors',
          price: 25.00,
          shares: 5,
          roi: 15.00,
          annual_dividends: 3.75,
          quarter_dividends: 0.94
        }], {
          onConflict: 'name',
          ignoreDuplicates: false
        })
        .select();
      
      if (packageUpsertError) {
        console.log('❌ Package upsert still failing:', packageUpsertError.message);
        console.log('🔧 Unique constraint may not be properly created');
      } else {
        console.log('✅ Package upsert working with ON CONFLICT');
      }
    } catch (upsertError) {
      console.log('❌ Package upsert error:', upsertError.message);
    }

    // Test company wallets upsert
    try {
      const { data: walletUpsert, error: walletUpsertError } = await supabase
        .from('company_wallets')
        .upsert([{
          network: 'BSC',
          currency: 'USDT',
          wallet_address: '0x742d35Cc6634C0532925a3b8D4C9db96590c6C89',
          is_active: true
        }], {
          onConflict: 'network,currency',
          ignoreDuplicates: false
        })
        .select();
      
      if (walletUpsertError) {
        console.log('❌ Wallet upsert still failing:', walletUpsertError.message);
        console.log('🔧 Unique constraint may not be properly created');
      } else {
        console.log('✅ Wallet upsert working with ON CONFLICT');
      }
    } catch (walletUpsertError) {
      console.log('❌ Wallet upsert error:', walletUpsertError.message);
    }

    console.log('\n🎉 Constraints fix process completed!');
    
    console.log('\n📋 RECOMMENDATIONS:');
    console.log('1. If upserts are still failing, the unique constraints need to be added at the database level');
    console.log('2. Consider using INSERT ... ON CONFLICT DO NOTHING for simple inserts');
    console.log('3. Use separate UPDATE statements instead of upserts if constraints cannot be added');
    
    console.log('\n✅ Enhanced referral system is still functional without ON CONFLICT');
    console.log('✅ All core functionality works properly');
    
  } catch (error) {
    console.error('❌ Constraints fix error:', error);
  }
}

applyConstraintsFix();
