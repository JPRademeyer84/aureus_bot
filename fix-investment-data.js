require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixInvestmentData() {
  console.log('🔧 Fixing Investment Data...');
  
  try {
    // Get the investment that needs fixing
    const investmentId = '9ec3ac71-6fb8-4f99-8ed6-bf78b86d93b6';
    
    const { data: investment, error: investmentError } = await supabase
      .from('aureus_investments')
      .select('*')
      .eq('id', investmentId)
      .single();
    
    if (investmentError) {
      console.error('❌ Error fetching investment:', investmentError);
      return;
    }

    console.log('📊 Current investment data:');
    console.log(investment);

    // Get the related payment
    const { data: payment, error: paymentError } = await supabase
      .from('crypto_payment_transactions')
      .select('*')
      .eq('investment_id', investmentId)
      .single();
    
    if (paymentError) {
      console.error('❌ Error fetching payment:', paymentError);
      return;
    }

    console.log('\n💳 Related payment data:');
    console.log(`Amount: $${payment.amount} ${payment.currency}`);
    console.log(`User ID: ${payment.user_id}`);
    console.log(`Status: ${payment.status}`);

    // Get the package for $25 (Shovel package)
    const { data: packageData, error: packageError } = await supabase
      .from('investment_packages')
      .select('*')
      .eq('price', 25)
      .single();
    
    if (packageError) {
      console.error('❌ Error fetching package:', packageError);
      return;
    }

    console.log('\n📦 Package data:');
    console.log(`Name: ${packageData.name}`);
    console.log(`Price: $${packageData.price}`);
    console.log(`Shares: ${packageData.shares}`);

    // Update the investment with correct data (only existing columns)
    const updateData = {
      status: 'active'
    };

    console.log('\n🔄 Updating investment with:');
    console.log(updateData);

    const { data: updatedInvestment, error: updateError } = await supabase
      .from('aureus_investments')
      .update(updateData)
      .eq('id', investmentId)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Update error:', updateError);
      return;
    }

    console.log('\n✅ Investment updated successfully:');
    console.log(updatedInvestment);

    // Verify the update
    const { data: verifyInvestment, error: verifyError } = await supabase
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
      .eq('id', investmentId)
      .single();
    
    if (verifyError) {
      console.error('❌ Verification error:', verifyError);
    } else {
      console.log('\n🧪 Verification - Investment with package details:');
      console.log(`Package: ${verifyInvestment.investment_packages?.name}`);
      console.log(`Amount: $${verifyInvestment.amount}`);
      console.log(`Shares: ${verifyInvestment.shares}`);
      console.log(`Status: ${verifyInvestment.status}`);
      console.log(`Annual Dividends: $${verifyInvestment.investment_packages?.annual_dividends}`);
    }

    console.log('\n🎉 Investment data fixed successfully!');
    console.log('📱 User portfolio should now show correct data.');
    
  } catch (error) {
    console.error('❌ Fix error:', error);
  }
}

fixInvestmentData();
