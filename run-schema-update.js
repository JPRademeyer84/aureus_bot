require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createMissingTables() {
  console.log('🔧 Creating missing database tables...');
  
  try {
    // Create aureus_share_purchases table
    console.log('📊 Creating aureus_share_purchases table...');
    const { error: sharesPurchasesError } = await supabase
      .from('aureus_share_purchases')
      .select('id')
      .limit(1);
    
    if (sharesPurchasesError) {
      console.error('❌ Error creating aureus_share_purchases table:', sharesPurchasesError);
    } else {
      console.log('✅ aureus_share_purchases table created successfully');
    }

    // Create commission_balances table
    console.log('💰 Creating commission_balances table...');
    const { error: commissionBalancesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.commission_balances (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          usdt_balance DECIMAL(15,2) DEFAULT 0,
          share_balance DECIMAL(15,2) DEFAULT 0,
          total_earned_usdt DECIMAL(15,2) DEFAULT 0,
          total_earned_shares DECIMAL(15,2) DEFAULT 0,
          total_withdrawn DECIMAL(15,2) DEFAULT 0,
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_commission_balances_user_id ON public.commission_balances(user_id);
        
        COMMENT ON TABLE public.commission_balances IS 'Tracks dual commission balances (USDT + Shares) for each user';
      `
    });
    
    if (commissionBalancesError) {
      console.error('❌ Error creating commission_balances table:', commissionBalancesError);
    } else {
      console.log('✅ commission_balances table created successfully');
    }

    // Create commission_transactions table
    console.log('📋 Creating commission_transactions table...');
    const { error: commissionTransactionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.commission_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          share_purchase_id UUID REFERENCES public.aureus_share_purchases(id) ON DELETE CASCADE,
          commission_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
          share_purchase_amount DECIMAL(15,2) NOT NULL,
          usdt_commission DECIMAL(15,2) NOT NULL,
          share_commission DECIMAL(15,2) NOT NULL,
          status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
          payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_commission_transactions_referrer ON public.commission_transactions(referrer_id);
        CREATE INDEX IF NOT EXISTS idx_commission_transactions_referred ON public.commission_transactions(referred_id);
        CREATE INDEX IF NOT EXISTS idx_commission_transactions_status ON public.commission_transactions(status);
        
        COMMENT ON TABLE public.commission_transactions IS 'Records all commission transactions with dual structure';
      `
    });
    
    if (commissionTransactionsError) {
      console.error('❌ Error creating commission_transactions table:', commissionTransactionsError);
    } else {
      console.log('✅ commission_transactions table created successfully');
    }

    // Create commission_withdrawal_requests table
    console.log('💸 Creating commission_withdrawal_requests table...');
    const { error: withdrawalRequestsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.commission_withdrawal_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          withdrawal_amount DECIMAL(15,2) NOT NULL,
          wallet_address VARCHAR(255) NOT NULL,
          network VARCHAR(20) NOT NULL CHECK (network IN ('BSC', 'POL', 'TRON')),
          currency VARCHAR(10) DEFAULT 'USDT',
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
          admin_notes TEXT,
          transaction_hash VARCHAR(255),
          processed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.commission_withdrawal_requests(user_id);
        CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.commission_withdrawal_requests(status);
        
        COMMENT ON TABLE public.commission_withdrawal_requests IS 'Commission withdrawal requests from users';
      `
    });
    
    if (withdrawalRequestsError) {
      console.error('❌ Error creating commission_withdrawal_requests table:', withdrawalRequestsError);
    } else {
      console.log('✅ commission_withdrawal_requests table created successfully');
    }

    console.log('\n🎉 Database schema update completed!');
    console.log('✅ All required tables have been created');
    
  } catch (error) {
    console.error('❌ Schema update error:', error);
  }
}

createMissingTables();
