require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPaymentStatus() {
  console.log('🔍 Checking Payment Status...');
  
  try {
    // Get the payment details
    const { data: payments, error } = await supabase
      .from('crypto_payment_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Error fetching payments:', error);
      return;
    }

    console.log(`📋 Found ${payments.length} recent payments:`);
    payments.forEach(payment => {
      console.log(`\n💳 Payment ID: ${payment.id}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Amount: $${payment.amount} ${payment.currency}`);
      console.log(`   Network: ${payment.network}`);
      console.log(`   Created: ${payment.created_at}`);
      console.log(`   Approved by: ${payment.approved_by_admin_id || 'None'}`);
      console.log(`   Approved at: ${payment.approved_at || 'None'}`);
      console.log(`   Verification: ${payment.verification_status || 'None'}`);
    });

    // Check if there's a pending payment that should be approved
    const pendingPayment = payments.find(p => p.status === 'pending');
    if (pendingPayment) {
      console.log(`\n⚠️ Found pending payment: ${pendingPayment.id}`);
      console.log('🔧 Attempting to manually approve it...');
      
      const { data: updatedPayment, error: updateError } = await supabase
        .from('crypto_payment_transactions')
        .update({
          status: 'approved',
          approved_by_admin_id: 1393852532, // TTTFOUNDER's Telegram ID
          approved_at: new Date().toISOString(),
          verification_status: 'verified'
        })
        .eq('id', pendingPayment.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ Error updating payment:', updateError);
      } else {
        console.log('✅ Payment approved successfully!');
        console.log('   New status:', updatedPayment.status);
        console.log('   Approved by:', updatedPayment.approved_by_admin_id);
        console.log('   Approved at:', updatedPayment.approved_at);
      }
    }

    // Check audit logs
    console.log('\n📋 Recent audit logs:');
    const { data: auditLogs, error: auditError } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);
    
    if (auditError) {
      console.error('❌ Error fetching audit logs:', auditError);
    } else {
      auditLogs.forEach(log => {
        console.log(`   📝 ${log.timestamp}: ${log.action} by ${log.admin_username}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Check error:', error);
  }
}

checkPaymentStatus();
