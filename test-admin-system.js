require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAdminSystem() {
  console.log('🧪 Testing Enhanced Admin System...');
  
  try {
    // Test 1: Check admin_users table
    console.log('\n1️⃣ Testing admin_users table...');
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('*');
    
    if (adminError) {
      console.error('❌ Admin users test failed:', adminError);
    } else {
      console.log(`✅ Admin users table working! Found ${adminUsers.length} admin users:`);
      adminUsers.forEach(admin => {
        console.log(`   👤 ${admin.telegram_username} (${admin.permission_level}) - Active: ${admin.is_active}`);
      });
    }

    // Test 2: Check admin_audit_logs table
    console.log('\n2️⃣ Testing admin_audit_logs table...');
    const { data: auditLogs, error: auditError } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);
    
    if (auditError) {
      console.error('❌ Audit logs test failed:', auditError);
    } else {
      console.log(`✅ Audit logs table working! Found ${auditLogs.length} recent logs:`);
      auditLogs.forEach(log => {
        console.log(`   📋 ${log.timestamp}: ${log.action} by ${log.admin_username} on ${log.target_type}`);
      });
    }

    // Test 3: Check payment_admin_notes table
    console.log('\n3️⃣ Testing payment_admin_notes table...');
    const { data: adminNotes, error: notesError } = await supabase
      .from('payment_admin_notes')
      .select('*')
      .limit(5);
    
    if (notesError) {
      console.error('❌ Admin notes test failed:', notesError);
    } else {
      console.log(`✅ Admin notes table working! Found ${adminNotes.length} notes`);
    }

    // Test 4: Check crypto_payment_transactions with new admin columns
    console.log('\n4️⃣ Testing enhanced payment transactions...');
    const { data: payments, error: paymentError } = await supabase
      .from('crypto_payment_transactions')
      .select('id, status, approved_by_admin_id, approved_at, rejected_by_admin_id, rejected_at, verification_status')
      .limit(5);
    
    if (paymentError) {
      console.error('❌ Enhanced payments test failed:', paymentError);
    } else {
      console.log(`✅ Enhanced payments table working! Found ${payments.length} payments:`);
      payments.forEach(payment => {
        console.log(`   💳 ${payment.id.substring(0, 8)}... - Status: ${payment.status}, Verification: ${payment.verification_status}`);
      });
    }

    // Test 5: Test audit logging function
    console.log('\n5️⃣ Testing audit logging...');
    const testLogData = {
      admin_telegram_id: 1393852532,
      admin_username: 'TTTFOUNDER',
      action: 'SYSTEM_TEST',
      target_type: 'system',
      target_id: 'admin_system_test',
      details: { test: true, timestamp: new Date().toISOString() }
    };

    const { data: logResult, error: logError } = await supabase
      .from('admin_audit_logs')
      .insert([testLogData])
      .select()
      .single();
    
    if (logError) {
      console.error('❌ Audit logging test failed:', logError);
    } else {
      console.log('✅ Audit logging working! Test log created:', logResult.id);
    }

    console.log('\n🎉 Enhanced Admin System Test Complete!');
    console.log('\n📊 System Status:');
    console.log(`   👥 Admin Users: ${adminUsers?.length || 0}`);
    console.log(`   📋 Audit Logs: ${auditLogs?.length || 0}`);
    console.log(`   💳 Payments: ${payments?.length || 0}`);
    console.log(`   📝 Admin Notes: ${adminNotes?.length || 0}`);
    
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

testAdminSystem();
