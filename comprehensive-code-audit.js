// Comprehensive Code Audit for Aureus Bot Payment Flow
// This script analyzes the entire payment approval workflow for potential issues

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class CodeAuditor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.recommendations = [];
    this.flowAnalysis = {};
  }

  async runComprehensiveAudit() {
    console.log('🔍 Starting Comprehensive Code Audit...\n');
    
    try {
      // 1. Analyze payment flow integrity
      await this.analyzePaymentFlow();
      
      // 2. Check database consistency
      await this.checkDatabaseConsistency();
      
      // 3. Validate commission calculations
      await this.validateCommissionLogic();
      
      // 4. Test error handling scenarios
      await this.testErrorHandling();
      
      // 5. Check for race conditions
      await this.checkRaceConditions();
      
      // 6. Validate data integrity constraints
      await this.validateDataIntegrity();
      
      // 7. Generate comprehensive report
      await this.generateAuditReport();
      
    } catch (error) {
      console.error('❌ Audit failed:', error);
    }
  }

  async analyzePaymentFlow() {
    console.log('🔄 Analyzing Payment Flow Integrity...');
    
    // Check payment creation to approval flow
    const { data: payments, error } = await supabase
      .from('crypto_payment_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      this.issues.push({
        type: 'DATABASE_ACCESS_ERROR',
        severity: 'HIGH',
        description: `Cannot access payment transactions: ${error.message}`
      });
      return;
    }
    
    console.log(`📊 Analyzing ${payments.length} recent payments...`);
    
    // Analyze payment status distribution
    const statusCounts = payments.reduce((acc, payment) => {
      acc[payment.status] = (acc[payment.status] || 0) + 1;
      return acc;
    }, {});
    
    this.flowAnalysis.paymentStatusDistribution = statusCounts;
    
    // Check for orphaned payments (approved but no share purchase)
    let orphanedPayments = 0;
    let linkedPayments = 0;
    
    for (const payment of payments.filter(p => p.status === 'approved')) {
      if (payment.investment_id) {
        // Check if share purchase exists
        const { data: sharePurchase, error: spError } = await supabase
          .from('aureus_share_purchases')
          .select('id')
          .eq('id', payment.investment_id)
          .single();
        
        if (spError || !sharePurchase) {
          orphanedPayments++;
          this.issues.push({
            type: 'ORPHANED_PAYMENT',
            severity: 'HIGH',
            paymentId: payment.id,
            description: `Approved payment ${payment.id} has investment_id but no corresponding share purchase`
          });
        } else {
          linkedPayments++;
        }
      } else {
        orphanedPayments++;
        this.issues.push({
          type: 'UNLINKED_PAYMENT',
          severity: 'HIGH',
          paymentId: payment.id,
          description: `Approved payment ${payment.id} has no investment_id link`
        });
      }
    }
    
    this.flowAnalysis.approvedPayments = {
      total: payments.filter(p => p.status === 'approved').length,
      linked: linkedPayments,
      orphaned: orphanedPayments
    };
    
    console.log(`✅ Payment flow analysis complete\n`);
  }

  async checkDatabaseConsistency() {
    console.log('🗄️ Checking Database Consistency...');
    
    // Check for missing required fields
    const { data: paymentsWithNulls, error } = await supabase
      .from('crypto_payment_transactions')
      .select('id, user_id, amount, status')
      .or('user_id.is.null,amount.is.null,status.is.null');
    
    if (!error && paymentsWithNulls.length > 0) {
      this.issues.push({
        type: 'NULL_REQUIRED_FIELDS',
        severity: 'HIGH',
        count: paymentsWithNulls.length,
        description: `Found ${paymentsWithNulls.length} payments with null required fields`
      });
    }
    
    // Check commission balance consistency (accounting for commission spending)
    const { data: commissionBalances, error: cbError } = await supabase
      .from('commission_balances')
      .select('*');

    if (!cbError) {
      for (const balance of commissionBalances) {
        const totalEarned = parseFloat(balance.total_earned_usdt || 0);
        const currentBalance = parseFloat(balance.usdt_balance || 0);
        const totalWithdrawn = parseFloat(balance.total_withdrawn || 0);
        const escrowed = parseFloat(balance.escrowed_amount || 0);

        // Get commission spending from share purchases
        const { data: sharePurchases, error: spError } = await supabase
          .from('aureus_share_purchases')
          .select('commission_used')
          .eq('user_id', balance.user_id)
          .gt('commission_used', 0);

        let totalSpent = 0;
        if (!spError && sharePurchases) {
          totalSpent = sharePurchases.reduce((sum, sp) => sum + parseFloat(sp.commission_used || 0), 0);
        }

        // Check if: total_earned = current_balance + total_withdrawn + escrowed + total_spent
        const expectedTotal = currentBalance + totalWithdrawn + escrowed + totalSpent;

        if (Math.abs(totalEarned - expectedTotal) > 0.01) {
          this.issues.push({
            type: 'COMMISSION_BALANCE_INCONSISTENCY',
            severity: 'MEDIUM',
            userId: balance.user_id,
            description: `Commission balance inconsistency for user ${balance.user_id}: earned=${totalEarned}, calculated=${expectedTotal} (balance=${currentBalance} + withdrawn=${totalWithdrawn} + escrowed=${escrowed} + spent=${totalSpent})`
          });
        }
      }
    }
    
    console.log(`✅ Database consistency check complete\n`);
  }

  async validateCommissionLogic() {
    console.log('💰 Validating Commission Logic...');
    
    // Get recent commission transactions
    const { data: commissions, error } = await supabase
      .from('commission_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      this.issues.push({
        type: 'COMMISSION_ACCESS_ERROR',
        severity: 'HIGH',
        description: `Cannot access commission transactions: ${error.message}`
      });
      return;
    }
    
    for (const commission of commissions) {
      const purchaseAmount = parseFloat(commission.share_purchase_amount);
      const commissionRate = parseFloat(commission.commission_rate) / 100;
      const actualUSDT = parseFloat(commission.usdt_commission);
      const actualShares = parseFloat(commission.share_commission);
      
      // Validate USDT commission calculation
      const expectedUSDT = purchaseAmount * commissionRate;
      if (Math.abs(actualUSDT - expectedUSDT) > 0.01) {
        this.issues.push({
          type: 'COMMISSION_CALCULATION_ERROR',
          severity: 'HIGH',
          commissionId: commission.id,
          description: `USDT commission calculation error: expected ${expectedUSDT}, got ${actualUSDT}`
        });
      }
      
      // Validate share commission (need to get actual shares purchased)
      if (commission.share_purchase_id) {
        const { data: sharePurchase, error: spError } = await supabase
          .from('aureus_share_purchases')
          .select('shares_purchased')
          .eq('id', commission.share_purchase_id)
          .single();
        
        if (!spError && sharePurchase) {
          const expectedShareCommission = parseInt(sharePurchase.shares_purchased) * commissionRate;
          if (Math.abs(actualShares - expectedShareCommission) > 0.01) {
            this.issues.push({
              type: 'SHARE_COMMISSION_ERROR',
              severity: 'HIGH',
              commissionId: commission.id,
              description: `Share commission calculation error: expected ${expectedShareCommission}, got ${actualShares}`
            });
          }
        }
      }
    }
    
    console.log(`✅ Commission logic validation complete\n`);
  }

  async testErrorHandling() {
    console.log('⚠️ Testing Error Handling Scenarios...');
    
    // Check for proper error handling patterns in recent transactions
    // This is more of a code review than runtime testing
    
    // Check if there are any payments stuck in processing states
    const { data: stuckPayments, error } = await supabase
      .from('crypto_payment_transactions')
      .select('id, status, created_at, updated_at')
      .eq('status', 'pending')
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Older than 24 hours
    
    if (!error && stuckPayments.length > 0) {
      this.warnings.push({
        type: 'STUCK_PAYMENTS',
        severity: 'MEDIUM',
        count: stuckPayments.length,
        description: `Found ${stuckPayments.length} payments pending for more than 24 hours`
      });
    }
    
    console.log(`✅ Error handling analysis complete\n`);
  }

  async checkRaceConditions() {
    console.log('🏃 Checking for Race Conditions...');

    // Check for potential race conditions in shares_sold updates
    const { data: phases, error } = await supabase
      .from('investment_phases')
      .select('*');

    if (!error) {
      // Get total shares sold across all active purchases
      const { data: allSharePurchases, error: spError } = await supabase
        .from('aureus_share_purchases')
        .select('shares_purchased')
        .eq('status', 'active');

      if (!spError) {
        const totalSharesSold = allSharePurchases.reduce((sum, sp) => sum + parseInt(sp.shares_purchased), 0);

        // Check if the total matches the sum of all phase shares_sold
        const totalRecordedShares = phases.reduce((sum, phase) => sum + parseInt(phase.shares_sold || 0), 0);

        if (Math.abs(totalSharesSold - totalRecordedShares) > 0) {
          this.warnings.push({
            type: 'TOTAL_SHARES_MISMATCH',
            severity: 'MEDIUM',
            description: `Total shares mismatch: purchases=${totalSharesSold}, phases_total=${totalRecordedShares}`
          });
        }

        // Check if only the active phase should have shares
        const activePhase = phases.find(p => p.is_active);
        if (activePhase) {
          const nonActiveWithShares = phases.filter(p => !p.is_active && parseInt(p.shares_sold || 0) > 0);

          if (nonActiveWithShares.length > 0) {
            this.warnings.push({
              type: 'INACTIVE_PHASES_WITH_SHARES',
              severity: 'LOW',
              count: nonActiveWithShares.length,
              description: `${nonActiveWithShares.length} inactive phases have shares_sold > 0`
            });
          }

          // Check if active phase has correct total
          if (Math.abs(parseInt(activePhase.shares_sold || 0) - totalSharesSold) > 0) {
            this.warnings.push({
              type: 'ACTIVE_PHASE_SHARES_MISMATCH',
              severity: 'MEDIUM',
              phaseId: activePhase.id,
              description: `Active phase shares_sold mismatch: recorded=${activePhase.shares_sold}, expected=${totalSharesSold}`
            });
          }
        }
      }
    }

    console.log(`✅ Race condition analysis complete\n`);
  }

  async validateDataIntegrity() {
    console.log('🔒 Validating Data Integrity...');
    
    // Check foreign key relationships
    const { data: paymentsWithInvalidUsers, error } = await supabase
      .from('crypto_payment_transactions')
      .select('id, user_id')
      .not('user_id', 'is', null);
    
    if (!error) {
      for (const payment of paymentsWithInvalidUsers.slice(0, 10)) { // Sample check
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('id', payment.user_id)
          .single();
        
        if (userError || !user) {
          this.issues.push({
            type: 'INVALID_USER_REFERENCE',
            severity: 'HIGH',
            paymentId: payment.id,
            description: `Payment ${payment.id} references non-existent user ${payment.user_id}`
          });
        }
      }
    }
    
    console.log(`✅ Data integrity validation complete\n`);
  }

  async generateAuditReport() {
    console.log('📋 COMPREHENSIVE CODE AUDIT REPORT');
    console.log('═'.repeat(80));
    
    console.log('\n🎯 AUDIT SUMMARY:');
    console.log(`• Critical Issues: ${this.issues.filter(i => i.severity === 'HIGH').length}`);
    console.log(`• Warnings: ${this.issues.filter(i => i.severity === 'MEDIUM').length + this.warnings.length}`);
    console.log(`• Total Issues Found: ${this.issues.length + this.warnings.length}`);
    
    console.log('\n📊 PAYMENT FLOW ANALYSIS:');
    if (this.flowAnalysis.paymentStatusDistribution) {
      Object.entries(this.flowAnalysis.paymentStatusDistribution).forEach(([status, count]) => {
        console.log(`• ${status}: ${count} payments`);
      });
    }
    
    if (this.flowAnalysis.approvedPayments) {
      const ap = this.flowAnalysis.approvedPayments;
      console.log(`\n💳 APPROVED PAYMENTS INTEGRITY:`);
      console.log(`• Total Approved: ${ap.total}`);
      console.log(`• Properly Linked: ${ap.linked}`);
      console.log(`• Orphaned/Unlinked: ${ap.orphaned}`);
      console.log(`• Integrity Score: ${ap.total > 0 ? ((ap.linked / ap.total) * 100).toFixed(1) : 100}%`);
    }
    
    if (this.issues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      console.log('─'.repeat(80));
      
      this.issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.type} [${issue.severity}]`);
        console.log(`   Description: ${issue.description}`);
        
        Object.keys(issue).forEach(key => {
          if (!['type', 'severity', 'description'].includes(key)) {
            console.log(`   ${key}: ${issue[key]}`);
          }
        });
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      console.log('─'.repeat(80));
      
      this.warnings.forEach((warning, index) => {
        console.log(`\n${index + 1}. ${warning.type} [${warning.severity}]`);
        console.log(`   Description: ${warning.description}`);
        
        Object.keys(warning).forEach(key => {
          if (!['type', 'severity', 'description'].includes(key)) {
            console.log(`   ${key}: ${warning[key]}`);
          }
        });
      });
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (this.issues.filter(i => i.type === 'ORPHANED_PAYMENT').length > 0) {
      console.log('• Fix orphaned payments by creating missing share purchase records');
    }
    
    if (this.issues.filter(i => i.type === 'COMMISSION_CALCULATION_ERROR').length > 0) {
      console.log('• Review and fix commission calculation logic');
    }
    
    if (this.warnings.filter(w => w.type === 'SHARES_SOLD_MISMATCH').length > 0) {
      console.log('• Recalculate and fix shares_sold counts in investment_phases');
    }
    
    if (this.warnings.filter(w => w.type === 'STUCK_PAYMENTS').length > 0) {
      console.log('• Review and process stuck pending payments');
    }
    
    console.log('• Implement database transactions for atomic operations');
    console.log('• Add comprehensive error logging and monitoring');
    console.log('• Set up automated integrity checks');
    console.log('• Consider implementing payment approval timeouts');
    
    console.log('\n🔧 CODE QUALITY ASSESSMENT:');
    
    const totalIssues = this.issues.length + this.warnings.length;
    let qualityScore = 100;
    
    if (totalIssues === 0) {
      qualityScore = 100;
      console.log('✅ EXCELLENT - No issues found');
    } else if (totalIssues <= 3) {
      qualityScore = 85;
      console.log('🟢 GOOD - Minor issues that should be addressed');
    } else if (totalIssues <= 10) {
      qualityScore = 70;
      console.log('🟡 FAIR - Several issues need attention');
    } else {
      qualityScore = 50;
      console.log('🔴 POOR - Many issues require immediate attention');
    }
    
    console.log(`\n📊 OVERALL QUALITY SCORE: ${qualityScore}/100`);
    
    console.log('\n═'.repeat(80));
    console.log('📋 AUDIT COMPLETE');
  }
}

// Run the audit
async function runAudit() {
  const auditor = new CodeAuditor();
  await auditor.runComprehensiveAudit();
}

// Execute if run directly
if (require.main === module) {
  runAudit().catch(console.error);
}

module.exports = { CodeAuditor };
