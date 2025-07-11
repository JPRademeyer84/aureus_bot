// Check Commission Usage for User 4
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCommissionUsage() {
  console.log('🔍 Checking Commission Usage for User 4...\n');
  
  // Check commission_usage table
  const { data: usageRecords, error: usageError } = await supabase
    .from('commission_usage')
    .select('*')
    .eq('user_id', 4);
  
  if (usageError) {
    console.log('❌ Error accessing commission_usage:', usageError.message);
  } else {
    console.log(`📊 Found ${usageRecords.length} commission usage records for User 4:`);
    
    let totalUsed = 0;
    usageRecords.forEach((usage, index) => {
      console.log(`\n${index + 1}. Usage ID: ${usage.id}`);
      console.log(`   Share Purchase ID: ${usage.share_purchase_id}`);
      console.log(`   Commission Used: $${usage.commission_amount_used}`);
      console.log(`   Remaining Payment: $${usage.remaining_payment_amount}`);
      console.log(`   Created: ${usage.created_at}`);
      
      totalUsed += parseFloat(usage.commission_amount_used);
    });
    
    console.log(`\n💰 Total Commission Used: $${totalUsed}`);
  }
  
  // Check commission_conversions table
  const { data: conversions, error: convError } = await supabase
    .from('commission_conversions')
    .select('*')
    .eq('user_id', 4);
  
  if (convError) {
    console.log('\n❌ Error accessing commission_conversions:', convError.message);
  } else {
    console.log(`\n🔄 Found ${conversions.length} commission conversions for User 4:`);
    
    let totalConverted = 0;
    conversions.forEach((conv, index) => {
      console.log(`\n${index + 1}. Conversion ID: ${conv.id}`);
      console.log(`   Status: ${conv.status}`);
      console.log(`   USDT Amount: $${conv.usdt_amount}`);
      console.log(`   Shares Requested: ${conv.shares_requested}`);
      console.log(`   Created: ${conv.created_at}`);
      
      if (conv.status === 'approved') {
        totalConverted += parseFloat(conv.usdt_amount);
      }
    });
    
    console.log(`\n💰 Total Commission Converted: $${totalConverted}`);
  }
  
  // Check share purchases with commission_used > 0
  const { data: sharePurchases, error: spError } = await supabase
    .from('aureus_share_purchases')
    .select('*')
    .eq('user_id', 4)
    .gt('commission_used', 0);
  
  if (spError) {
    console.log('\n❌ Error accessing share purchases:', spError.message);
  } else {
    console.log(`\n📊 Found ${sharePurchases.length} share purchases with commission used for User 4:`);
    
    let totalCommissionInPurchases = 0;
    sharePurchases.forEach((purchase, index) => {
      console.log(`\n${index + 1}. Purchase ID: ${purchase.id}`);
      console.log(`   Total Amount: $${purchase.total_amount}`);
      console.log(`   Commission Used: $${purchase.commission_used}`);
      console.log(`   Remaining Payment: $${purchase.remaining_payment}`);
      console.log(`   Shares: ${purchase.shares_purchased}`);
      console.log(`   Created: ${purchase.created_at}`);
      
      totalCommissionInPurchases += parseFloat(purchase.commission_used);
    });
    
    console.log(`\n💰 Total Commission in Share Purchases: $${totalCommissionInPurchases}`);
  }
  
  // Now let's calculate the correct balance
  console.log('\n🧮 BALANCE CALCULATION:');
  
  // Get current balance record
  const { data: balance, error: balanceError } = await supabase
    .from('commission_balances')
    .select('*')
    .eq('user_id', 4)
    .single();
  
  if (!balanceError && balance) {
    const totalEarned = parseFloat(balance.total_earned_usdt);
    const currentBalance = parseFloat(balance.usdt_balance);
    const totalWithdrawn = parseFloat(balance.total_withdrawn || 0);
    const escrowed = parseFloat(balance.escrowed_amount || 0);
    
    console.log(`📊 Balance Record:`);
    console.log(`   Total Earned: $${totalEarned}`);
    console.log(`   Current Balance: $${currentBalance}`);
    console.log(`   Total Withdrawn: $${totalWithdrawn}`);
    console.log(`   Escrowed: $${escrowed}`);
    
    // Calculate what the balance should be
    const totalUsedFromUsage = usageRecords ? usageRecords.reduce((sum, u) => sum + parseFloat(u.commission_amount_used), 0) : 0;
    const totalUsedFromConversions = conversions ? conversions.filter(c => c.status === 'approved').reduce((sum, c) => sum + parseFloat(c.usdt_amount), 0) : 0;
    const totalUsedFromPurchases = sharePurchases ? sharePurchases.reduce((sum, p) => sum + parseFloat(p.commission_used), 0) : 0;
    
    console.log(`\n💸 Commission Spending:`);
    console.log(`   From usage table: $${totalUsedFromUsage}`);
    console.log(`   From conversions: $${totalUsedFromConversions}`);
    console.log(`   From purchases: $${totalUsedFromPurchases}`);
    
    const totalSpent = Math.max(totalUsedFromUsage, totalUsedFromConversions, totalUsedFromPurchases);
    const expectedBalance = totalEarned - totalWithdrawn - escrowed - totalSpent;
    
    console.log(`\n🎯 EXPECTED CALCULATION:`);
    console.log(`   Total Earned: $${totalEarned}`);
    console.log(`   - Withdrawn: $${totalWithdrawn}`);
    console.log(`   - Escrowed: $${escrowed}`);
    console.log(`   - Spent on purchases: $${totalSpent}`);
    console.log(`   = Expected Balance: $${expectedBalance}`);
    console.log(`   Actual Balance: $${currentBalance}`);
    console.log(`   Difference: $${currentBalance - expectedBalance}`);
    
    if (Math.abs(currentBalance - expectedBalance) > 0.01) {
      console.log(`\n⚠️ Balance inconsistency detected!`);
    } else {
      console.log(`\n✅ Balance is correct when accounting for commission spending`);
    }
  }
}

checkCommissionUsage().catch(console.error);
