// Fix Missing Share Purchase Records
// This script creates missing share purchase records for approved payments

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class SharePurchaseFixer {
  constructor() {
    this.fixedRecords = [];
    this.errors = [];
  }

  async fixMissingSharePurchases() {
    console.log('🔧 Starting Share Purchase Fix Process...\n');
    
    try {
      // Get current phase for pricing
      const { data: currentPhase, error: phaseError } = await supabase
        .from('investment_phases')
        .select('*')
        .eq('is_active', true)
        .single();
      
      if (phaseError || !currentPhase) {
        throw new Error('Failed to get current phase');
      }
      
      console.log(`📊 Current Phase: ${currentPhase.phase_name} - $${currentPhase.price_per_share}/share\n`);
      
      // Get all approved payments without share purchases
      const { data: payments, error: paymentsError } = await supabase
        .from('crypto_payment_transactions')
        .select(`
          id,
          user_id,
          amount,
          currency,
          created_at,
          investment_id,
          users!inner(username, full_name)
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      
      if (paymentsError) {
        throw new Error(`Failed to get payments: ${paymentsError.message}`);
      }
      
      console.log(`📋 Found ${payments.length} approved payments to check\n`);
      
      for (const payment of payments) {
        await this.processPayment(payment, currentPhase);
      }
      
      await this.generateReport();
      
    } catch (error) {
      console.error('❌ Fix process failed:', error);
    }
  }

  async processPayment(payment, currentPhase) {
    const amount = parseFloat(payment.amount);
    const sharePrice = parseFloat(currentPhase.price_per_share);
    const sharesAmount = Math.floor(amount / sharePrice);
    
    console.log(`\n🔍 Processing payment ${payment.id}`);
    console.log(`   User: ${payment.users.username} (ID: ${payment.user_id})`);
    console.log(`   Amount: $${amount}`);
    console.log(`   Expected shares: ${sharesAmount} at $${sharePrice}/share`);
    
    // Check if share purchase already exists
    let existingPurchase = null;
    
    if (payment.investment_id) {
      // Check aureus_share_purchases
      const { data: sp1, error: e1 } = await supabase
        .from('aureus_share_purchases')
        .select('*')
        .eq('id', payment.investment_id)
        .single();
      
      if (!e1 && sp1) {
        existingPurchase = sp1;
        console.log(`   ✅ Share purchase already exists in aureus_share_purchases`);
        return;
      }
      
      // Check aureus_investments
      const { data: sp2, error: e2 } = await supabase
        .from('aureus_investments')
        .select('*')
        .eq('id', payment.investment_id)
        .single();
      
      if (!e2 && sp2) {
        existingPurchase = sp2;
        console.log(`   ✅ Investment record already exists in aureus_investments`);
        return;
      }
    }
    
    // Create missing share purchase record
    console.log(`   🔧 Creating missing share purchase record...`);
    
    const sharePurchaseData = {
      id: payment.investment_id || uuidv4(), // Use existing ID or generate new UUID
      user_id: payment.user_id,
      package_id: null, // Will be set based on package mapping
      package_name: this.getPackageName(amount),
      shares_purchased: sharesAmount,
      total_amount: amount,
      commission_used: 0, // No commission used for these payments
      remaining_payment: amount, // Full amount paid
      payment_method: 'crypto',
      status: 'active',
      created_at: payment.created_at,
      updated_at: new Date().toISOString()
    };
    
    const { data: newPurchase, error: insertError } = await supabase
      .from('aureus_share_purchases')
      .insert([sharePurchaseData])
      .select()
      .single();
    
    if (insertError) {
      console.log(`   ❌ Failed to create share purchase: ${insertError.message}`);
      this.errors.push({
        paymentId: payment.id,
        userId: payment.user_id,
        username: payment.users.username,
        error: insertError.message
      });
      return;
    }
    
    console.log(`   ✅ Created share purchase record: ${newPurchase.id}`);
    
    // Update payment to link to share purchase
    if (!payment.investment_id) {
      const { error: updateError } = await supabase
        .from('crypto_payment_transactions')
        .update({ investment_id: newPurchase.id })
        .eq('id', payment.id);
      
      if (updateError) {
        console.log(`   ⚠️ Warning: Failed to link payment to share purchase: ${updateError.message}`);
      } else {
        console.log(`   🔗 Linked payment to share purchase`);
      }
    }
    
    // Update phase shares sold count
    const { error: phaseUpdateError } = await supabase
      .from('investment_phases')
      .update({ 
        shares_sold: currentPhase.shares_sold + sharesAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentPhase.id);
    
    if (phaseUpdateError) {
      console.log(`   ⚠️ Warning: Failed to update phase shares sold: ${phaseUpdateError.message}`);
    } else {
      console.log(`   📊 Updated phase shares sold count (+${sharesAmount})`);
    }
    
    this.fixedRecords.push({
      paymentId: payment.id,
      sharePurchaseId: newPurchase.id,
      userId: payment.user_id,
      username: payment.users.username,
      amount: amount,
      shares: sharesAmount,
      packageName: sharePurchaseData.package_name
    });
  }

  getPackageName(amount) {
    // Define package mapping based on amount
    const packageMapping = {
      25: 'Shovel Package',
      75: 'Miner Package', 
      250: 'Excavator Package',
      500: 'Crusher Package',
      750: 'Refinery Package',
      1000: 'Aureus Package',
      2500: 'Titan Package',
      5000: 'Empire Package'
    };
    
    return packageMapping[amount] || `Custom Package ($${amount})`;
  }

  async generateReport() {
    console.log('\n📋 SHARE PURCHASE FIX REPORT');
    console.log('═'.repeat(60));
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`• Records Fixed: ${this.fixedRecords.length}`);
    console.log(`• Errors Encountered: ${this.errors.length}`);
    
    if (this.fixedRecords.length > 0) {
      console.log('\n✅ SUCCESSFULLY FIXED RECORDS:');
      console.log('─'.repeat(60));
      
      this.fixedRecords.forEach((record, index) => {
        console.log(`\n${index + 1}. ${record.username} (User ID: ${record.userId})`);
        console.log(`   Payment ID: ${record.paymentId}`);
        console.log(`   Share Purchase ID: ${record.sharePurchaseId}`);
        console.log(`   Amount: $${record.amount}`);
        console.log(`   Shares: ${record.shares}`);
        console.log(`   Package: ${record.packageName}`);
      });
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS ENCOUNTERED:');
      console.log('─'.repeat(60));
      
      this.errors.forEach((error, index) => {
        console.log(`\n${index + 1}. ${error.username} (User ID: ${error.userId})`);
        console.log(`   Payment ID: ${error.paymentId}`);
        console.log(`   Error: ${error.error}`);
      });
    }
    
    console.log('\n💡 NEXT STEPS:');
    if (this.fixedRecords.length > 0) {
      console.log('• Run the financial audit again to verify all issues are resolved');
      console.log('• Check commission calculations for the fixed records');
      console.log('• Verify phase shares_sold counts are accurate');
    }
    
    console.log('\n═'.repeat(60));
    console.log('📋 FIX PROCESS COMPLETE');
  }
}

// Run the fix
async function runFix() {
  const fixer = new SharePurchaseFixer();
  await fixer.fixMissingSharePurchases();
}

// Execute if run directly
if (require.main === module) {
  runFix().catch(console.error);
}

module.exports = { SharePurchaseFixer };
