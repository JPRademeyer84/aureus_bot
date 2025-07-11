// Comprehensive Financial Audit Script for Aureus Bot
// This script analyzes all financial transactions and identifies discrepancies

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for full access
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class FinancialAuditor {
  constructor() {
    this.discrepancies = [];
    this.summary = {
      totalPaymentsAnalyzed: 0,
      totalCommissionsAnalyzed: 0,
      shareCalculationErrors: 0,
      commissionCalculationErrors: 0,
      missingCommissions: 0,
      duplicateCommissions: 0,
      totalApprovedPaymentAmount: 0,
      totalCommissionsPaid: 0
    };
  }

  async runFullAudit() {
    console.log('🔍 Starting Comprehensive Financial Audit...\n');
    
    try {
      // 1. Get current phase information
      await this.getCurrentPhaseInfo();
      
      // 2. Analyze payment transactions
      await this.analyzePaymentTransactions();
      
      // 3. Audit commission calculations
      await this.auditCommissionCalculations();
      
      // 4. Check for missing commissions
      await this.checkMissingCommissions();
      
      // 5. Identify duplicate commissions
      await this.identifyDuplicateCommissions();
      
      // 6. Verify share calculations
      await this.verifyShareCalculations();
      
      // 7. Generate comprehensive report
      await this.generateReport();
      
    } catch (error) {
      console.error('❌ Audit failed:', error);
    }
  }

  async getCurrentPhaseInfo() {
    console.log('📊 Getting current phase information...');
    
    const { data: phases, error } = await supabase
      .from('investment_phases')
      .select('*')
      .order('phase_number');
    
    if (error) {
      throw new Error(`Failed to get phases: ${error.message}`);
    }
    
    this.phases = phases;
    this.currentPhase = phases.find(p => p.is_active) || phases[0];
    
    console.log(`✅ Current Phase: ${this.currentPhase.phase_name} - $${this.currentPhase.price_per_share}/share\n`);
  }

  async analyzePaymentTransactions() {
    console.log('💳 Analyzing payment transactions...');

    // First, let's check what columns exist in crypto_payment_transactions
    const { data: schemaCheck, error: schemaError } = await supabase
      .from('crypto_payment_transactions')
      .select('*')
      .limit(1);

    if (schemaError) {
      console.log('Schema check error:', schemaError);
    } else if (schemaCheck && schemaCheck.length > 0) {
      console.log('Available columns:', Object.keys(schemaCheck[0]));
    }

    // Get all approved payments from crypto_payment_transactions
    const { data: payments, error } = await supabase
      .from('crypto_payment_transactions')
      .select(`
        id,
        user_id,
        amount,
        currency,
        status,
        created_at,
        investment_id,
        users!inner(username, full_name)
      `)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get payments: ${error.message}`);
    }
    
    console.log(`📋 Found ${payments.length} approved payments`);
    this.summary.totalPaymentsAnalyzed = payments.length;
    
    for (const payment of payments) {
      await this.analyzePayment(payment);
      this.summary.totalApprovedPaymentAmount += parseFloat(payment.amount);
    }
    
    console.log(`✅ Payment analysis complete\n`);
  }

  async analyzePayment(payment) {
    const amount = parseFloat(payment.amount);
    
    // Find the phase that was active when this payment was made
    const paymentDate = new Date(payment.created_at);
    let applicablePhase = this.currentPhase; // Default to current phase
    
    // For now, we'll use current phase pricing, but this should ideally
    // check historical phase data based on payment date
    const expectedShares = Math.floor(amount / parseFloat(applicablePhase.price_per_share));
    
    // Check if there's a corresponding share purchase (try both table names)
    let sharePurchase = null;
    let sharePurchaseError = null;

    if (payment.investment_id) {
      // Try aureus_share_purchases first
      const { data: sp1, error: e1 } = await supabase
        .from('aureus_share_purchases')
        .select('shares_purchased, total_amount, package_name')
        .eq('id', payment.investment_id)
        .single();

      if (!e1 && sp1) {
        sharePurchase = sp1;
      } else {
        // Try aureus_investments table
        const { data: sp2, error: e2 } = await supabase
          .from('aureus_investments')
          .select('shares, amount, package_id')
          .eq('id', payment.investment_id)
          .single();

        if (!e2 && sp2) {
          sharePurchase = {
            shares_purchased: sp2.shares,
            total_amount: sp2.amount,
            package_name: 'Investment'
          };
        } else {
          sharePurchaseError = e2 || e1;
        }
      }

      if (!sharePurchaseError && sharePurchase) {
        const actualShares = parseInt(sharePurchase.shares_purchased);

        if (actualShares !== expectedShares) {
          this.discrepancies.push({
            type: 'SHARE_CALCULATION_ERROR',
            paymentId: payment.id,
            userId: payment.user_id,
            username: payment.users.username,
            paymentAmount: amount,
            expectedShares: expectedShares,
            actualShares: actualShares,
            phasePrice: parseFloat(applicablePhase.price_per_share),
            description: `Share calculation mismatch: Expected ${expectedShares} shares for $${amount} payment, but got ${actualShares} shares`
          });
          this.summary.shareCalculationErrors++;
        }
      }
    } else {
      this.discrepancies.push({
        type: 'MISSING_SHARE_PURCHASE',
        paymentId: payment.id,
        userId: payment.user_id,
        username: payment.users.username,
        paymentAmount: amount,
        description: `Approved payment has no corresponding share purchase record`
      });
    }
  }

  async auditCommissionCalculations() {
    console.log('💰 Auditing commission calculations...');
    
    const { data: commissions, error } = await supabase
      .from('commission_transactions')
      .select(`
        id,
        referrer_id,
        referred_id,
        share_purchase_id,
        commission_rate,
        share_purchase_amount,
        usdt_commission,
        share_commission,
        status,
        created_at
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get commissions: ${error.message}`);
    }
    
    console.log(`📋 Found ${commissions.length} commission records`);
    this.summary.totalCommissionsAnalyzed = commissions.length;
    
    for (const commission of commissions) {
      await this.analyzeCommission(commission);
      if (commission.status === 'approved') {
        this.summary.totalCommissionsPaid += parseFloat(commission.usdt_commission);
      }
    }
    
    console.log(`✅ Commission analysis complete\n`);
  }

  async analyzeCommission(commission) {
    const purchaseAmount = parseFloat(commission.share_purchase_amount);
    const commissionRate = parseFloat(commission.commission_rate) / 100;
    const actualUSDTCommission = parseFloat(commission.usdt_commission);
    const actualShareCommission = parseFloat(commission.share_commission);
    
    // Expected calculations
    const expectedUSDTCommission = purchaseAmount * commissionRate;
    
    // Get the share purchase to verify share commission calculation
    const { data: sharePurchase, error } = await supabase
      .from('aureus_share_purchases')
      .select('shares_purchased')
      .eq('id', commission.share_purchase_id)
      .single();
    
    if (!error && sharePurchase) {
      const sharesPurchased = parseInt(sharePurchase.shares_purchased);
      const expectedShareCommission = sharesPurchased * commissionRate;
      
      // Check USDT commission accuracy
      if (Math.abs(actualUSDTCommission - expectedUSDTCommission) > 0.01) {
        this.discrepancies.push({
          type: 'USDT_COMMISSION_ERROR',
          commissionId: commission.id,
          referrerId: commission.referrer_id,
          referredId: commission.referred_id,
          purchaseAmount: purchaseAmount,
          commissionRate: commission.commission_rate,
          expectedUSDTCommission: expectedUSDTCommission,
          actualUSDTCommission: actualUSDTCommission,
          difference: actualUSDTCommission - expectedUSDTCommission,
          description: `USDT commission calculation error: Expected $${expectedUSDTCommission.toFixed(2)}, got $${actualUSDTCommission.toFixed(2)}`
        });
        this.summary.commissionCalculationErrors++;
      }
      
      // Check share commission accuracy
      if (Math.abs(actualShareCommission - expectedShareCommission) > 0.01) {
        this.discrepancies.push({
          type: 'SHARE_COMMISSION_ERROR',
          commissionId: commission.id,
          referrerId: commission.referrer_id,
          referredId: commission.referred_id,
          sharesPurchased: sharesPurchased,
          commissionRate: commission.commission_rate,
          expectedShareCommission: expectedShareCommission,
          actualShareCommission: actualShareCommission,
          difference: actualShareCommission - expectedShareCommission,
          description: `Share commission calculation error: Expected ${expectedShareCommission.toFixed(2)} shares, got ${actualShareCommission.toFixed(2)} shares`
        });
        this.summary.commissionCalculationErrors++;
      }
    }
  }

  async checkMissingCommissions() {
    console.log('🔍 Checking for missing commission records...');
    
    // Get all approved share purchases
    const { data: sharePurchases, error } = await supabase
      .from('aureus_share_purchases')
      .select(`
        id,
        user_id,
        total_amount,
        shares_purchased,
        created_at
      `)
      .eq('status', 'approved');
    
    if (error) {
      throw new Error(`Failed to get share purchases: ${error.message}`);
    }
    
    for (const purchase of sharePurchases) {
      // Check if user has a referrer
      const { data: referral, error: refError } = await supabase
        .from('referrals')
        .select('referrer_id, referred_id')
        .eq('referred_id', purchase.user_id)
        .eq('status', 'active')
        .single();
      
      if (!refError && referral) {
        // Check if commission exists for this purchase
        const { data: commission, error: commError } = await supabase
          .from('commission_transactions')
          .select('id')
          .eq('share_purchase_id', purchase.id)
          .single();
        
        if (commError || !commission) {
          this.discrepancies.push({
            type: 'MISSING_COMMISSION',
            sharePurchaseId: purchase.id,
            userId: purchase.user_id,
            referrerId: referral.referrer_id,
            purchaseAmount: parseFloat(purchase.total_amount),
            sharesPurchased: parseInt(purchase.shares_purchased),
            description: `Missing commission record for share purchase with active referral relationship`
          });
          this.summary.missingCommissions++;
        }
      }
    }
    
    console.log(`✅ Missing commission check complete\n`);
  }

  async identifyDuplicateCommissions() {
    console.log('🔍 Checking for duplicate commission records...');
    
    const { data: duplicates, error } = await supabase
      .rpc('find_duplicate_commissions');
    
    // If RPC doesn't exist, do manual check
    const { data: commissions, error: commError } = await supabase
      .from('commission_transactions')
      .select('share_purchase_id, referrer_id, referred_id, id, usdt_commission')
      .order('share_purchase_id');
    
    if (!commError) {
      const seen = new Map();
      
      for (const commission of commissions) {
        const key = `${commission.share_purchase_id}-${commission.referrer_id}-${commission.referred_id}`;
        
        if (seen.has(key)) {
          this.discrepancies.push({
            type: 'DUPLICATE_COMMISSION',
            commissionId: commission.id,
            duplicateOf: seen.get(key).id,
            sharePurchaseId: commission.share_purchase_id,
            referrerId: commission.referrer_id,
            referredId: commission.referred_id,
            description: `Duplicate commission record found for the same share purchase and referral relationship`
          });
          this.summary.duplicateCommissions++;
        } else {
          seen.set(key, commission);
        }
      }
    }
    
    console.log(`✅ Duplicate commission check complete\n`);
  }

  async verifyShareCalculations() {
    console.log('📊 Verifying share calculations against current phase pricing...');
    
    // This is already covered in analyzePayment, but we can add additional checks here
    // for historical accuracy if needed
    
    console.log(`✅ Share calculation verification complete\n`);
  }

  async generateReport() {
    console.log('📋 COMPREHENSIVE FINANCIAL AUDIT REPORT');
    console.log('═'.repeat(60));
    
    console.log('\n📊 AUDIT SUMMARY:');
    console.log(`• Total Payments Analyzed: ${this.summary.totalPaymentsAnalyzed}`);
    console.log(`• Total Commissions Analyzed: ${this.summary.totalCommissionsAnalyzed}`);
    console.log(`• Total Approved Payment Amount: $${this.summary.totalApprovedPaymentAmount.toFixed(2)}`);
    console.log(`• Total Commissions Paid: $${this.summary.totalCommissionsPaid.toFixed(2)}`);
    
    console.log('\n🚨 DISCREPANCIES FOUND:');
    console.log(`• Share Calculation Errors: ${this.summary.shareCalculationErrors}`);
    console.log(`• Commission Calculation Errors: ${this.summary.commissionCalculationErrors}`);
    console.log(`• Missing Commission Records: ${this.summary.missingCommissions}`);
    console.log(`• Duplicate Commission Records: ${this.summary.duplicateCommissions}`);
    
    if (this.discrepancies.length > 0) {
      console.log('\n🔍 DETAILED DISCREPANCIES:');
      console.log('─'.repeat(60));
      
      this.discrepancies.forEach((discrepancy, index) => {
        console.log(`\n${index + 1}. ${discrepancy.type}`);
        console.log(`   Description: ${discrepancy.description}`);
        
        Object.keys(discrepancy).forEach(key => {
          if (key !== 'type' && key !== 'description') {
            console.log(`   ${key}: ${discrepancy[key]}`);
          }
        });
      });
    } else {
      console.log('\n✅ NO DISCREPANCIES FOUND - All financial calculations appear correct!');
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (this.summary.shareCalculationErrors > 0) {
      console.log('• Review and correct share calculation logic in payment approval process');
    }
    if (this.summary.commissionCalculationErrors > 0) {
      console.log('• Verify commission calculation formulas and fix any rounding issues');
    }
    if (this.summary.missingCommissions > 0) {
      console.log('• Create missing commission records for approved payments with active referrals');
    }
    if (this.summary.duplicateCommissions > 0) {
      console.log('• Remove duplicate commission records to prevent double-payments');
    }
    
    console.log('\n🔧 DATABASE QUERIES USED:');
    console.log('• SELECT * FROM crypto_payment_transactions WHERE status = \'approved\'');
    console.log('• SELECT * FROM commission_transactions');
    console.log('• SELECT * FROM aureus_share_purchases WHERE status = \'approved\'');
    console.log('• SELECT * FROM referrals WHERE status = \'active\'');
    console.log('• SELECT * FROM investment_phases');
    
    console.log('\n═'.repeat(60));
    console.log('📋 AUDIT COMPLETE');
  }
}

// Run the audit
async function runAudit() {
  const auditor = new FinancialAuditor();
  await auditor.runFullAudit();
}

// Execute if run directly
if (require.main === module) {
  runAudit().catch(console.error);
}

module.exports = { FinancialAuditor };
