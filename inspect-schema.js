// Database Schema Inspector
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectSchema() {
  console.log('🔍 Inspecting Database Schema...\n');
  
  // Check aureus_share_purchases table
  console.log('📋 Checking aureus_share_purchases table:');
  const { data: sharePurchases, error: spError } = await supabase
    .from('aureus_share_purchases')
    .select('*')
    .limit(1);
  
  if (spError) {
    console.log('❌ Error accessing aureus_share_purchases:', spError.message);
  } else if (sharePurchases && sharePurchases.length > 0) {
    console.log('✅ Columns in aureus_share_purchases:');
    Object.keys(sharePurchases[0]).forEach(col => console.log(`   - ${col}`));
    console.log('\n📋 Sample record:');
    console.log(JSON.stringify(sharePurchases[0], null, 2));
  } else {
    console.log('⚠️ Table exists but is empty');

    // Try to get all records to see what exists
    const { data: allRecords, error: allError } = await supabase
      .from('aureus_share_purchases')
      .select('*');

    if (!allError && allRecords) {
      console.log(`📊 Total records in table: ${allRecords.length}`);
      if (allRecords.length > 0) {
        console.log('✅ Sample record:');
        console.log(JSON.stringify(allRecords[0], null, 2));
      }
    }
  }
  
  console.log('\n📋 Checking aureus_investments table:');
  const { data: investments, error: invError } = await supabase
    .from('aureus_investments')
    .select('*')
    .limit(1);
  
  if (invError) {
    console.log('❌ Error accessing aureus_investments:', invError.message);
  } else if (investments && investments.length > 0) {
    console.log('✅ Columns in aureus_investments:');
    Object.keys(investments[0]).forEach(col => console.log(`   - ${col}`));
  } else {
    console.log('⚠️ Table exists but is empty');
  }
  
  console.log('\n📋 Checking investment_phases table:');
  const { data: phases, error: phaseError } = await supabase
    .from('investment_phases')
    .select('*')
    .limit(1);
  
  if (phaseError) {
    console.log('❌ Error accessing investment_phases:', phaseError.message);
  } else if (phases && phases.length > 0) {
    console.log('✅ Columns in investment_phases:');
    Object.keys(phases[0]).forEach(col => console.log(`   - ${col}`));
  } else {
    console.log('⚠️ Table exists but is empty');
  }
  
  console.log('\n📋 Checking commission_transactions table:');
  const { data: commissions, error: commError } = await supabase
    .from('commission_transactions')
    .select('*')
    .limit(1);
  
  if (commError) {
    console.log('❌ Error accessing commission_transactions:', commError.message);
  } else if (commissions && commissions.length > 0) {
    console.log('✅ Columns in commission_transactions:');
    Object.keys(commissions[0]).forEach(col => console.log(`   - ${col}`));
  } else {
    console.log('⚠️ Table exists but is empty');
  }
}

inspectSchema().catch(console.error);
