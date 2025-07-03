-- Fix the shares_sold count in investment_phases table
-- This script recalculates the correct shares_sold based on actual approved purchases

-- Step 1: Check current state
SELECT 
  'BEFORE FIX' as status,
  phase_name,
  shares_sold,
  total_shares_available
FROM public.investment_phases
WHERE is_active = true;

-- Step 2: Calculate actual approved shares
SELECT 
  'ACTUAL APPROVED SHARES' as status,
  COALESCE(SUM(shares_purchased), 0) as actual_approved_shares
FROM public.aureus_share_purchases
WHERE status IN ('active', 'approved', 'pending_approval');

-- Step 3: Reset shares_sold to correct value
-- First, let's see what the correct count should be
WITH approved_shares AS (
  SELECT COALESCE(SUM(shares_purchased), 0) as total_approved
  FROM public.aureus_share_purchases
  WHERE status IN ('active', 'approved', 'pending_approval')
)
UPDATE public.investment_phases 
SET 
  shares_sold = (SELECT total_approved FROM approved_shares),
  updated_at = NOW()
WHERE is_active = true;

-- Step 4: Verify the fix
SELECT 
  'AFTER FIX' as status,
  phase_name,
  shares_sold,
  total_shares_available,
  (shares_sold::float / total_shares_available * 100)::decimal(5,2) as completion_percentage
FROM public.investment_phases
WHERE is_active = true;

-- Step 5: Show breakdown of purchases by status
SELECT 
  'PURCHASE BREAKDOWN' as info,
  status,
  COUNT(*) as purchase_count,
  SUM(shares_purchased) as total_shares
FROM public.aureus_share_purchases
GROUP BY status
ORDER BY status;
