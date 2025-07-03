-- Check the actual structure of aureus_share_purchases table
-- Run this in Supabase SQL Editor

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'aureus_share_purchases'
ORDER BY ordinal_position;

-- Also check if there are any existing records
SELECT COUNT(*) as total_records FROM public.aureus_share_purchases;

-- Check the crypto_payment_transactions table structure too
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'crypto_payment_transactions'
ORDER BY ordinal_position;
