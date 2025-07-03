-- Check actual share purchases to verify shares_sold count
-- Run this in Supabase SQL Editor

-- 1. Check all share purchases
SELECT 
  id,
  user_id,
  package_name,
  shares_purchased,
  total_amount,
  status,
  created_at
FROM public.aureus_share_purchases
ORDER BY created_at DESC;

-- 2. Sum total shares purchased by status
SELECT 
  status,
  SUM(shares_purchased) as total_shares,
  COUNT(*) as purchase_count
FROM public.aureus_share_purchases
GROUP BY status;

-- 3. Check investment_phases current state
SELECT 
  phase_number,
  phase_name,
  price_per_share,
  total_shares_available,
  shares_sold,
  is_active,
  updated_at
FROM public.investment_phases
ORDER BY phase_number;

-- 4. Check if there are any approved/active purchases
SELECT 
  SUM(shares_purchased) as total_approved_shares
FROM public.aureus_share_purchases
WHERE status IN ('active', 'approved', 'pending_approval');

-- 5. Check for any test or duplicate data
SELECT 
  user_id,
  COUNT(*) as purchase_count,
  SUM(shares_purchased) as total_shares
FROM public.aureus_share_purchases
GROUP BY user_id
ORDER BY total_shares DESC;
