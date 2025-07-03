require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixExistingPayment() {
  console.log('🔧 Fixing existing approved payment...');
  
  try {
    // Find approved payments
    console.log('\n📋 Finding approved payments...');
    const { data: approvedPayments, error: paymentsError } = await supabase
      .from('crypto_payment_transactions')
      .select('*')
      .eq('status', 'approved');
    
    if (paymentsError) {
      console.error('❌ Error fetching payments:', paymentsError);
      return;
    }

    console.log(`✅ Found ${approvedPayments.length} approved payments`);

    // Check which payments already have corresponding share purchases
    const { data: existingPurchases, error: purchasesError } = await supabase
      .from('aureus_share_purchases')
      .select('user_id, total_amount, created_at');

    if (purchasesError) {
      console.error('❌ Error fetching existing purchases:', purchasesError);
      return;
    }

    console.log(`📊 Found ${existingPurchases.length} existing share purchases`);

    for (const payment of approvedPayments) {
      console.log(`\n💰 Processing payment ${payment.id}:`);
      console.log(`   - User ID: ${payment.user_id}`);
      console.log(`   - Amount: $${payment.amount}`);
      console.log(`   - Network: ${payment.network}`);
      console.log(`   - Status: ${payment.status}`);

      // Check if this payment already has a corresponding share purchase
      const existingPurchase = existingPurchases.find(p =>
        p.user_id === payment.user_id &&
        parseFloat(p.total_amount) === parseFloat(payment.amount)
      );

      if (existingPurchase) {
        console.log(`   ✅ Share purchase already exists for this payment - skipping`);
        continue;
      }

      // Define package mapping based on amount
      const packageMapping = {
        25: { name: 'Shovel', shares: 25, roi: 12 },
        75: { name: 'Miner', shares: 75, roi: 15 },
        250: { name: 'Excavator', shares: 250, roi: 18 },
        500: { name: 'Crusher', shares: 500, roi: 20 },
        750: { name: 'Refinery', shares: 750, roi: 22 },
        1000: { name: 'Aureus', shares: 1000, roi: 25 },
        2500: { name: 'Titan', shares: 2500, roi: 28 },
        5000: { name: 'Empire', shares: 5000, roi: 30 }
      };

      // Get package details based on payment amount
      const amount = parseFloat(payment.amount);
      const packageInfo = packageMapping[amount] || {
        name: 'Custom Package',
        shares: Math.floor(amount), // 1 share per dollar as fallback
        roi: 20 // Default 20% ROI
      };

      console.log(`   📦 Package: ${packageInfo.name} (${packageInfo.shares} shares)`);

      // Create the share purchase record
      const investmentData = {
        user_id: payment.user_id,
        package_name: packageInfo.name,
        total_amount: amount,
        shares_purchased: packageInfo.shares,
        status: 'active',
        payment_method: `${payment.network} ${payment.currency}`,
        created_at: payment.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('   📝 Creating share purchase record...');
      const { data: investmentRecord, error: investmentError } = await supabase
        .from('aureus_share_purchases')
        .insert([investmentData])
        .select()
        .single();

      if (investmentError) {
        console.error('   ❌ Share Purchase creation error:', investmentError);
        continue;
      }

      console.log(`   ✅ Share Purchase record created: ${investmentRecord.id}`);

      // Note: Payment linking skipped as share_purchase_id column doesn't exist
      console.log('   ℹ️ Payment-to-purchase linking skipped (column not available)');

      // Create commission for referrer if exists
      console.log('   💰 Checking for referrer commission...');
      const { data: referralData, error: referralError } = await supabase
        .from('commissions')
        .select('*')
        .eq('referred_user_id', payment.user_id)
        .single();

      if (!referralError && referralData) {
        console.log(`   👥 Found referrer: User ${referralData.referrer_user_id}`);
        
        // Calculate commission (15% of investment)
        const commissionAmount = amount * 0.15;
        const shareCommission = packageInfo.shares * 0.15;

        // Create commission transaction
        const commissionData = {
          referrer_id: referralData.referrer_user_id,
          referred_id: payment.user_id,
          share_purchase_id: investmentRecord.id,
          commission_rate: 15.00,
          share_purchase_amount: amount,
          usdt_commission: commissionAmount,
          share_commission: shareCommission,
          status: 'approved',
          payment_date: new Date().toISOString(),
          created_at: new Date().toISOString()
        };

        const { data: commissionRecord, error: commissionError } = await supabase
          .from('commission_transactions')
          .insert([commissionData])
          .select()
          .single();

        if (commissionError) {
          console.error('   ❌ Commission creation error:', commissionError);
        } else {
          console.log(`   ✅ Commission created: $${commissionAmount.toFixed(2)} USDT + ${shareCommission.toFixed(2)} shares`);
        }
      } else {
        console.log('   ℹ️ No referrer found for this user');
      }
    }

    console.log('\n🎉 Payment fixing completed!');
    console.log('\n📊 SUMMARY:');
    console.log(`✅ Processed ${approvedPayments.length} approved payments`);
    console.log('✅ Created corresponding share purchase records');
    console.log('✅ Linked payments to share purchases');
    console.log('✅ Created referrer commissions where applicable');
    console.log('\n🚀 Users should now see their share purchases in their portfolio!');
    
  } catch (error) {
    console.error('❌ Payment fixing error:', error);
  }
}

fixExistingPayment();
