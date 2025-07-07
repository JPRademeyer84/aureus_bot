// Fix Critical Issues Found in Code Audit
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class AuditIssueFixer {
  constructor() {
    this.fixedIssues = [];
    this.errors = [];
  }

  async fixAllIssues() {
    console.log('🔧 Starting Audit Issue Fix Process...\n');
    
    try {
      // 1. Fix shares_sold counts in all phases
      await this.fixSharesSoldCounts();
      
      // 2. Fix commission balance inconsistencies
      await this.fixCommissionBalances();
      
      // 3. Generate fix report
      await this.generateFixReport();
      
    } catch (error) {
      console.error('❌ Fix process failed:', error);
    }
  }

  async fixSharesSoldCounts() {
    console.log('📊 Fixing shares_sold counts in investment_phases...');
    
    // Get all active share purchases
    const { data: sharePurchases, error: spError } = await supabase
      .from('aureus_share_purchases')
      .select('shares_purchased')
      .eq('status', 'active');
    
    if (spError) {
      this.errors.push({
        type: 'SHARE_PURCHASES_ACCESS_ERROR',
        description: `Cannot access share purchases: ${spError.message}`
      });
      return;
    }
    
    // Calculate total shares sold
    const totalSharesSold = sharePurchases.reduce((sum, sp) => sum + parseInt(sp.shares_purchased), 0);
    console.log(`📊 Total active shares purchased: ${totalSharesSold}`);
    
    // Get all investment phases
    const { data: phases, error: phaseError } = await supabase
      .from('investment_phases')
      .select('*')
      .order('phase_number');
    
    if (phaseError) {
      this.errors.push({
        type: 'PHASES_ACCESS_ERROR',
        description: `Cannot access investment phases: ${phaseError.message}`
      });
      return;
    }
    
    // Find the active phase (should have all the shares)
    const activePhase = phases.find(p => p.is_active);
    if (!activePhase) {
      this.errors.push({
        type: 'NO_ACTIVE_PHASE',
        description: 'No active phase found'
      });
      return;
    }
    
    console.log(`📊 Active phase: ${activePhase.phase_name} (ID: ${activePhase.id})`);
    
    // Reset all phases to 0 shares_sold first
    for (const phase of phases) {
      if (phase.id !== activePhase.id) {
        const { error: resetError } = await supabase
          .from('investment_phases')
          .update({
            shares_sold: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', phase.id);
        
        if (resetError) {
          this.errors.push({
            type: 'PHASE_RESET_ERROR',
            phaseId: phase.id,
            description: `Failed to reset phase ${phase.phase_number}: ${resetError.message}`
          });
        } else {
          console.log(`   ✅ Reset Phase ${phase.phase_number} to 0 shares`);
        }
      }
    }
    
    // Set the active phase to the correct total
    const { error: updateError } = await supabase
      .from('investment_phases')
      .update({
        shares_sold: totalSharesSold,
        updated_at: new Date().toISOString()
      })
      .eq('id', activePhase.id);
    
    if (updateError) {
      this.errors.push({
        type: 'ACTIVE_PHASE_UPDATE_ERROR',
        phaseId: activePhase.id,
        description: `Failed to update active phase: ${updateError.message}`
      });
    } else {
      console.log(`   ✅ Updated ${activePhase.phase_name} to ${totalSharesSold} shares`);
      this.fixedIssues.push({
        type: 'SHARES_SOLD_FIXED',
        description: `Fixed shares_sold counts - Active phase now shows ${totalSharesSold} shares`
      });
    }
    
    console.log(`✅ Shares_sold fix complete\n`);
  }

  async fixCommissionBalances() {
    console.log('💰 Fixing commission balance inconsistencies...');
    
    // Get all commission balances
    const { data: balances, error: balanceError } = await supabase
      .from('commission_balances')
      .select('*');
    
    if (balanceError) {
      this.errors.push({
        type: 'COMMISSION_BALANCE_ACCESS_ERROR',
        description: `Cannot access commission balances: ${balanceError.message}`
      });
      return;
    }
    
    for (const balance of balances) {
      console.log(`\n💰 Checking user ${balance.user_id} commission balance...`);
      
      // Get all commission transactions for this user
      const { data: commissions, error: commError } = await supabase
        .from('commission_transactions')
        .select('usdt_commission, share_commission, status')
        .eq('referrer_id', balance.user_id)
        .eq('status', 'approved');
      
      if (commError) {
        console.log(`   ❌ Error getting commissions: ${commError.message}`);
        continue;
      }
      
      // Calculate correct totals from commission transactions
      const calculatedUSDT = commissions.reduce((sum, c) => sum + parseFloat(c.usdt_commission || 0), 0);
      const calculatedShares = commissions.reduce((sum, c) => sum + parseFloat(c.share_commission || 0), 0);
      
      console.log(`   📊 Calculated from transactions: $${calculatedUSDT} USDT, ${calculatedShares} shares`);
      console.log(`   📊 Current balance record: $${balance.total_earned_usdt} USDT, ${balance.total_earned_shares} shares`);
      
      // Check if correction is needed
      const usdtDiff = Math.abs(calculatedUSDT - parseFloat(balance.total_earned_usdt || 0));
      const sharesDiff = Math.abs(calculatedShares - parseFloat(balance.total_earned_shares || 0));
      
      if (usdtDiff > 0.01 || sharesDiff > 0.01) {
        console.log(`   🔧 Correcting balance inconsistency...`);
        
        // Calculate correct current balance
        const totalWithdrawn = parseFloat(balance.total_withdrawn || 0);
        const escrowed = parseFloat(balance.escrowed_amount || 0);
        const correctCurrentBalance = Math.max(0, calculatedUSDT - totalWithdrawn - escrowed);
        
        const { error: updateError } = await supabase
          .from('commission_balances')
          .update({
            total_earned_usdt: calculatedUSDT,
            total_earned_shares: calculatedShares,
            usdt_balance: correctCurrentBalance,
            share_balance: calculatedShares, // Assuming shares aren't withdrawn yet
            last_updated: new Date().toISOString()
          })
          .eq('user_id', balance.user_id);
        
        if (updateError) {
          this.errors.push({
            type: 'BALANCE_UPDATE_ERROR',
            userId: balance.user_id,
            description: `Failed to update balance: ${updateError.message}`
          });
        } else {
          console.log(`   ✅ Balance corrected for user ${balance.user_id}`);
          this.fixedIssues.push({
            type: 'COMMISSION_BALANCE_FIXED',
            userId: balance.user_id,
            description: `Fixed commission balance: USDT ${balance.total_earned_usdt} -> ${calculatedUSDT}, Shares ${balance.total_earned_shares} -> ${calculatedShares}`
          });
        }
      } else {
        console.log(`   ✅ Balance is correct for user ${balance.user_id}`);
      }
    }
    
    console.log(`✅ Commission balance fix complete\n`);
  }

  async generateFixReport() {
    console.log('📋 AUDIT ISSUE FIX REPORT');
    console.log('═'.repeat(60));
    
    console.log(`\n📊 FIX SUMMARY:`);
    console.log(`• Issues Fixed: ${this.fixedIssues.length}`);
    console.log(`• Errors Encountered: ${this.errors.length}`);
    
    if (this.fixedIssues.length > 0) {
      console.log('\n✅ SUCCESSFULLY FIXED ISSUES:');
      console.log('─'.repeat(60));
      
      this.fixedIssues.forEach((fix, index) => {
        console.log(`\n${index + 1}. ${fix.type}`);
        console.log(`   Description: ${fix.description}`);
        
        Object.keys(fix).forEach(key => {
          if (key !== 'type' && key !== 'description') {
            console.log(`   ${key}: ${fix[key]}`);
          }
        });
      });
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS ENCOUNTERED:');
      console.log('─'.repeat(60));
      
      this.errors.forEach((error, index) => {
        console.log(`\n${index + 1}. ${error.type}`);
        console.log(`   Description: ${error.description}`);
        
        Object.keys(error).forEach(key => {
          if (key !== 'type' && key !== 'description') {
            console.log(`   ${key}: ${error[key]}`);
          }
        });
      });
    }
    
    console.log('\n💡 NEXT STEPS:');
    if (this.fixedIssues.length > 0) {
      console.log('• Run the comprehensive audit again to verify fixes');
      console.log('• Monitor system for any new inconsistencies');
      console.log('• Consider implementing automated integrity checks');
    }
    
    if (this.errors.length > 0) {
      console.log('• Review and manually fix any remaining errors');
      console.log('• Check database permissions and connectivity');
    }
    
    console.log('\n═'.repeat(60));
    console.log('📋 FIX PROCESS COMPLETE');
  }
}

// Run the fix
async function runFix() {
  const fixer = new AuditIssueFixer();
  await fixer.fixAllIssues();
}

// Execute if run directly
if (require.main === module) {
  runFix().catch(console.error);
}

module.exports = { AuditIssueFixer };
