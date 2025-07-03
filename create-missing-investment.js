require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createInvestmentForPayment(payment) {
  console.log(`\n💰 Creating investment for payment ${payment.id}...`);

  try {
    // Get the package that matches the payment amount
    const { data: packageData, error: packageError } = await supabase
      .from('investment_packages')
      .select('*')
      .eq('price', payment.amount)
      .single();

    if (packageError) {
      console.error('❌ Error fetching package:', packageError);
      return false;
    }

    console.log(`📦 Found matching package: ${packageData.name}`);

    // Create the investment record with the existing investment_id from payment
    const investmentData = {
      id: payment.investment_id, // Use the existing UUID
      user_id: payment.user_id,
      package_id: packageData.id,
      amount_invested: payment.amount,
      shares_purchased: packageData.shares,
      purchase_date: payment.created_at,
      status: 'active',
      payment_method: 'crypto',
      network: payment.network,
      transaction_hash: payment.transaction_hash
    };

    const { data: investmentRecord, error: investmentError } = await supabase
      .from('aureus_investments')
      .insert([investmentData])
      .select()
      .single();

    if (investmentError) {
      console.error('❌ Investment creation error:', investmentError);
      return false;
    }

    console.log(`✅ Investment record created: ${investmentRecord.id}`);
    return true;

  } catch (error) {
    console.error('❌ Error creating investment:', error);
    return false;
  }
}

async function createMissingInvestment() {
  console.log('💰 Creating Missing Investment Record...');

  try {
    // First, let's check all payments to see what we have
    const { data: allPayments, error: allPaymentsError } = await supabase
      .from('crypto_payment_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (allPaymentsError) {
      console.error('❌ Error fetching all payments:', allPaymentsError);
      return;
    }

    console.log(`📋 Found ${allPayments.length} total payments:`);
    allPayments.forEach(p => {
      console.log(`   ID: ${p.id}, Status: ${p.status}, Amount: $${p.amount}, Investment ID: ${p.investment_id}`);
    });

    // Get the approved payment that doesn't have an investment
    const { data: payments, error: paymentError } = await supabase
      .from('crypto_payment_transactions')
      .select('*')
      .eq('status', 'approved')
      .is('investment_id', null);

    if (paymentError) {
      console.error('❌ Error fetching payments:', paymentError);
      return;
    }

    if (!payments || payments.length === 0) {
      console.log('✅ No approved payments found without investments');

      // Check if there are any approved payments at all
      const { data: approvedPayments } = await supabase
        .from('crypto_payment_transactions')
        .select('*')
        .eq('status', 'approved');

      console.log(`📊 Total approved payments: ${approvedPayments?.length || 0}`);

      // Let's check if the investment records actually exist
      if (approvedPayments && approvedPayments.length > 0) {
        console.log('\n🔍 Checking if investment records exist...');

        for (const payment of approvedPayments) {
          if (payment.investment_id) {
            const { data: investment, error: invError } = await supabase
              .from('aureus_investments')
              .select('*')
              .eq('id', payment.investment_id)
              .single();

            if (invError || !investment) {
              console.log(`❌ Investment record ${payment.investment_id} NOT FOUND for payment ${payment.id}`);
              console.log('   This payment needs an investment record created!');

              // Create the missing investment
              await createInvestmentForPayment(payment);
            } else {
              console.log(`✅ Investment record ${payment.investment_id} exists for payment ${payment.id}`);
            }
          }
        }
      }

      return;
    }

    const payment = payments[0]; // Take the first one

    console.log(`💳 Found approved payment: ${payment.id}`);
    console.log(`   Amount: $${payment.amount} ${payment.currency}`);
    console.log(`   User ID: ${payment.user_id}`);

    // Get the package that matches the payment amount
    const { data: packageData, error: packageError } = await supabase
      .from('investment_packages')
      .select('*')
      .eq('price', payment.amount)
      .single();
    
    if (packageError) {
      console.error('❌ Error fetching package:', packageError);
      return;
    }

    console.log(`📦 Found matching package: ${packageData.name}`);
    console.log(`   Shares: ${packageData.shares}`);
    console.log(`   Annual Dividends: $${packageData.annual_dividends}`);

    // Create the investment record
    const investmentData = {
      user_id: payment.user_id,
      package_id: packageData.id,
      amount_invested: payment.amount,
      shares_purchased: packageData.shares,
      purchase_date: payment.created_at,
      status: 'active',
      payment_method: 'crypto',
      network: payment.network,
      transaction_hash: payment.transaction_hash
    };

    const { data: investmentRecord, error: investmentError } = await supabase
      .from('aureus_investments')
      .insert([investmentData])
      .select()
      .single();
    
    if (investmentError) {
      console.error('❌ Investment creation error:', investmentError);
      return;
    }

    console.log(`✅ Investment record created: ${investmentRecord.id}`);

    // Link the payment to the investment
    const { error: linkError } = await supabase
      .from('crypto_payment_transactions')
      .update({ investment_id: investmentRecord.id })
      .eq('id', payment.id);
    
    if (linkError) {
      console.error('❌ Payment linking error:', linkError);
      return;
    }

    console.log('🔗 Payment linked to investment successfully');

    // Verify the complete setup
    console.log('\n🧪 Verifying complete setup...');
    
    const { data: verifyPayment, error: verifyError } = await supabase
      .from('crypto_payment_transactions')
      .select('*, aureus_investments(*)')
      .eq('id', payment.id)
      .single();
    
    if (verifyError) {
      console.error('❌ Verification error:', verifyError);
    } else {
      console.log('✅ Verification successful:');
      console.log(`   Payment Status: ${verifyPayment.status}`);
      console.log(`   Investment ID: ${verifyPayment.investment_id}`);
      console.log(`   Investment Status: ${verifyPayment.aureus_investments?.status}`);
    }

    // Check user portfolio
    const { data: userInvestments, error: portfolioError } = await supabase
      .from('aureus_investments')
      .select(`
        *,
        investment_packages (
          name,
          price,
          shares,
          annual_dividends
        )
      `)
      .eq('user_id', payment.user_id);
    
    if (portfolioError) {
      console.error('❌ Portfolio check error:', portfolioError);
    } else {
      console.log(`\n📊 User Portfolio Summary:`);
      console.log(`   Total Investments: ${userInvestments.length}`);
      let totalAmount = 0;
      let totalShares = 0;
      userInvestments.forEach(inv => {
        totalAmount += parseFloat(inv.amount_invested || 0);
        totalShares += parseInt(inv.shares_purchased || 0);
        console.log(`   - ${inv.investment_packages?.name}: $${inv.amount_invested}, ${inv.shares_purchased} shares`);
      });
      console.log(`   Total Amount: $${totalAmount}`);
      console.log(`   Total Shares: ${totalShares}`);
    }

    console.log('\n🎉 Investment creation completed successfully!');
    console.log('📱 User can now view their portfolio with real data.');
    
  } catch (error) {
    console.error('❌ Creation error:', error);
  }
}

createMissingInvestment();
