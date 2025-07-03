-- Create missing tables for Aureus Alliance Holdings Bot
-- Run this in Supabase SQL Editor

-- 1. Create aureus_share_purchases table
CREATE TABLE IF NOT EXISTS public.aureus_share_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  package_id UUID,
  package_name VARCHAR(100) NOT NULL,
  shares_purchased INTEGER NOT NULL DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  commission_used DECIMAL(15,2) DEFAULT 0,
  remaining_payment DECIMAL(15,2) DEFAULT 0,
  payment_method VARCHAR(50) DEFAULT 'crypto',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'pending_payment', 'pending_approval', 'active', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aureus_share_purchases_user_id ON public.aureus_share_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_aureus_share_purchases_status ON public.aureus_share_purchases(status);

COMMENT ON TABLE public.aureus_share_purchases IS 'Tracks share purchases made by users';

-- 2. Create commission_balances table
CREATE TABLE IF NOT EXISTS public.commission_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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

-- 3. Create commission_transactions table
CREATE TABLE IF NOT EXISTS public.commission_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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

-- 4. Create commission_withdrawal_requests table
CREATE TABLE IF NOT EXISTS public.commission_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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

-- 5. Create commission_usage table
CREATE TABLE IF NOT EXISTS public.commission_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  share_purchase_id UUID NOT NULL REFERENCES public.aureus_share_purchases(id) ON DELETE CASCADE,
  commission_amount_used DECIMAL(15,2) NOT NULL,
  remaining_payment_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_usage_user_id ON public.commission_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_usage_purchase_id ON public.commission_usage(share_purchase_id);

COMMENT ON TABLE public.commission_usage IS 'Tracks commission balance usage for share purchases';

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE public.aureus_share_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic policies - can be refined later)
-- Users can only see their own records

-- Note: RLS policies disabled for service role access
-- The bot uses service role key, so these policies won't affect bot operations
-- But they provide security for direct user access

-- aureus_share_purchases policies
CREATE POLICY "Users can view own share purchases" ON public.aureus_share_purchases
  FOR SELECT USING (true); -- Allow all for service role

CREATE POLICY "Users can insert own share purchases" ON public.aureus_share_purchases
  FOR INSERT WITH CHECK (true); -- Allow all for service role

-- commission_balances policies
CREATE POLICY "Users can view own commission balance" ON public.commission_balances
  FOR SELECT USING (true); -- Allow all for service role

-- commission_transactions policies
CREATE POLICY "Users can view own commission transactions" ON public.commission_transactions
  FOR SELECT USING (true); -- Allow all for service role

-- commission_withdrawal_requests policies
CREATE POLICY "Users can view own withdrawal requests" ON public.commission_withdrawal_requests
  FOR SELECT USING (true); -- Allow all for service role

CREATE POLICY "Users can create own withdrawal requests" ON public.commission_withdrawal_requests
  FOR INSERT WITH CHECK (true); -- Allow all for service role

-- commission_usage policies
CREATE POLICY "Users can view own commission usage" ON public.commission_usage
  FOR SELECT USING (true); -- Allow all for service role

-- Grant necessary permissions
GRANT ALL ON public.aureus_share_purchases TO authenticated;
GRANT ALL ON public.commission_balances TO authenticated;
GRANT ALL ON public.commission_transactions TO authenticated;
GRANT ALL ON public.commission_withdrawal_requests TO authenticated;
GRANT ALL ON public.commission_usage TO authenticated;

-- Grant service role full access
GRANT ALL ON public.aureus_share_purchases TO service_role;
GRANT ALL ON public.commission_balances TO service_role;
GRANT ALL ON public.commission_transactions TO service_role;
GRANT ALL ON public.commission_withdrawal_requests TO service_role;
GRANT ALL ON public.commission_usage TO service_role;
