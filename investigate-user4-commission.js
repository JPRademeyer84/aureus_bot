// Investigate User 4 Commission Balance Inconsistency
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigateUser4() {
  console.log('🔍 Investigating User 4 Commission Balance Inconsistency...\n');
  
  // Get user 4 details
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', 4)
    .single();
  
  if (userError) {
    console.log('❌ Error getting user:', userError.message);
    return;
  }
  
  console.log(`👤 User 4: ${user.username} (${user.full_name})`);
  
  // Get current commission balance
  const { data: balance, error: balanceError } = await supabase
    .from('commission_balances')
    .select('*')
    .eq('user_id', 4)
    .single();
  
  if (balanceError) {
    console.log('❌ Error getting balance:', balanceError.message);
    return;
  }
  
  console.log('\n💰 Current Balance Record:');
  console.log(`   Total Earned USDT: $${balance.total_earned_usdt}`);
  console.log(`   Total Earned Shares: ${balance.total_earned_shares}`);
  console.log(`   Current USDT Balance: $${balance.usdt_balance}`);
  console.log(`   Current Share Balance: ${balance.share_balance}`);
  console.log(`   Total Withdrawn: $${balance.total_withdrawn || 0}`);
  console.log(`   Escrowed Amount: $${balance.escrowed_amount || 0}`);
  
  // Get all commission transactions for user 4
  const { data: commissions, error: commError } = await supabase
    .from('commission_transactions')
    .select('*')
    .eq('referrer_id', 4)
    .order('created_at', { ascending: false });
  
  if (commError) {
    console.log('❌ Error getting commissions:', commError.message);
    return;
  }
  
  console.log(`\n📊 Commission Transactions (${commissions.length} total):`);
  
  let totalUSDT = 0;
  let totalShares = 0;
  let approvedUSDT = 0;
  let approvedShares = 0;
  
  commissions.forEach((comm, index) => {
    console.log(`\n${index + 1}. Commission ID: ${comm.id}`);
    console.log(`   Status: ${comm.status}`);
    console.log(`   USDT Commission: $${comm.usdt_commission}`);
    console.log(`   Share Commission: ${comm.share_commission}`);
    console.log(`   Purchase Amount: $${comm.share_purchase_amount}`);
    console.log(`   Commission Rate: ${comm.commission_rate}%`);
    console.log(`   Created: ${comm.created_at}`);
    
    totalUSDT += parseFloat(comm.usdt_commission || 0);
    totalShares += parseFloat(comm.share_commission || 0);
    
    if (comm.status === 'approved') {
      approvedUSDT += parseFloat(comm.usdt_commission || 0);
      approvedShares += parseFloat(comm.share_commission || 0);
    }
  });
  
  console.log('\n📊 CALCULATED TOTALS:');
  console.log(`   Total USDT (all): $${totalUSDT}`);
  console.log(`   Total Shares (all): ${totalShares}`);
  console.log(`   Approved USDT: $${approvedUSDT}`);
  console.log(`   Approved Shares: ${approvedShares}`);
  
  console.log('\n🔍 COMPARISON:');
  console.log(`   Balance Record USDT: $${balance.total_earned_usdt}`);
  console.log(`   Calculated USDT: $${approvedUSDT}`);
  console.log(`   Difference: $${parseFloat(balance.total_earned_usdt) - approvedUSDT}`);
  
  // Check if there are any other sources of commission
  console.log('\n🔍 Checking for other commission sources...');
  
  // Check if user 4 has any referrals
  const { data: referrals, error: refError } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', 4);
  
  if (!refError) {
    console.log(`\n👥 User 4 has ${referrals.length} referrals:`);
    referrals.forEach((ref, index) => {
      console.log(`   ${index + 1}. Referred User ID: ${ref.referred_id}, Status: ${ref.status}`);
    });
  }
  
  // Check if there are any manual commission adjustments
  const { data: adjustments, error: adjError } = await supabase
    .from('commission_adjustments')
    .select('*')
    .eq('user_id', 4);
  
  if (!adjError && adjustments && adjustments.length > 0) {
    console.log(`\n🔧 Found ${adjustments.length} commission adjustments:`);
    adjustments.forEach((adj, index) => {
      console.log(`   ${index + 1}. Amount: $${adj.amount}, Reason: ${adj.reason}, Date: ${adj.created_at}`);
    });
  } else {
    console.log('\n🔧 No commission adjustments found');
  }
  
  // Suggest fix
  console.log('\n💡 SUGGESTED FIX:');
  if (Math.abs(parseFloat(balance.total_earned_usdt) - approvedUSDT) > 0.01) {
    console.log(`   Update total_earned_usdt from $${balance.total_earned_usdt} to $${approvedUSDT}`);
    console.log(`   Update total_earned_shares from ${balance.total_earned_shares} to ${approvedShares}`);
    
    // Calculate correct current balance
    const totalWithdrawn = parseFloat(balance.total_withdrawn || 0);
    const escrowed = parseFloat(balance.escrowed_amount || 0);
    const correctCurrentBalance = Math.max(0, approvedUSDT - totalWithdrawn - escrowed);
    
    console.log(`   Update usdt_balance from $${balance.usdt_balance} to $${correctCurrentBalance}`);
    
    // Ask if user wants to apply the fix
    console.log('\n🔧 Apply this fix? (This would update the database)');
    console.log('   To apply: node -e "require(\'./investigate-user4-commission.js\').applyFix()"');
  } else {
    console.log('   No fix needed - balances are correct');
  }
}

async function applyFix() {
  console.log('🔧 Applying fix for User 4 commission balance...');
  
  // Get approved commissions total
  const { data: commissions, error: commError } = await supabase
    .from('commission_transactions')
    .select('usdt_commission, share_commission')
    .eq('referrer_id', 4)
    .eq('status', 'approved');
  
  if (commError) {
    console.log('❌ Error getting commissions:', commError.message);
    return;
  }
  
  const approvedUSDT = commissions.reduce((sum, c) => sum + parseFloat(c.usdt_commission || 0), 0);
  const approvedShares = commissions.reduce((sum, c) => sum + parseFloat(c.share_commission || 0), 0);
  
  // Get current balance to calculate correct current balance
  const { data: balance, error: balanceError } = await supabase
    .from('commission_balances')
    .select('*')
    .eq('user_id', 4)
    .single();
  
  if (balanceError) {
    console.log('❌ Error getting balance:', balanceError.message);
    return;
  }
  
  const totalWithdrawn = parseFloat(balance.total_withdrawn || 0);
  const escrowed = parseFloat(balance.escrowed_amount || 0);
  const correctCurrentBalance = Math.max(0, approvedUSDT - totalWithdrawn - escrowed);
  
  // Apply the fix
  const { error: updateError } = await supabase
    .from('commission_balances')
    .update({
      total_earned_usdt: approvedUSDT,
      total_earned_shares: approvedShares,
      usdt_balance: correctCurrentBalance,
      share_balance: approvedShares,
      last_updated: new Date().toISOString()
    })
    .eq('user_id', 4);
  
  if (updateError) {
    console.log('❌ Error applying fix:', updateError.message);
  } else {
    console.log('✅ Fix applied successfully!');
    console.log(`   Updated total_earned_usdt to: $${approvedUSDT}`);
    console.log(`   Updated total_earned_shares to: ${approvedShares}`);
    console.log(`   Updated usdt_balance to: $${correctCurrentBalance}`);
  }
}

// Run investigation
if (require.main === module) {
  investigateUser4().catch(console.error);
}

module.exports = { investigateUser4, applyFix };
