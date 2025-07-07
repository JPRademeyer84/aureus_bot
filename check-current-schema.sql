-- CHECK CURRENT DATABASE SCHEMA
-- Run this first to see what columns actually exist

-- 1. Show all columns in crypto_payment_transactions table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'crypto_payment_transactions'
ORDER BY ordinal_position;

-- 2. Show sample data to understand current structure
SELECT *
FROM public.crypto_payment_transactions
ORDER BY created_at DESC
LIMIT 2;

-- 3. Check if any bank transfer payments exist
SELECT 
    COUNT(*) as total_payments,
    COUNT(CASE WHEN network = 'BANK_TRANSFER' THEN 1 END) as bank_transfers,
    COUNT(CASE WHEN currency = 'ZAR' THEN 1 END) as zar_payments
FROM public.crypto_payment_transactions;

-- 4. Show existing indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'crypto_payment_transactions';

-- 5. Show existing functions
SELECT 
    proname as function_name,
    pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname IN ('get_zar_amount', 'is_bank_transfer');

-- 6. Show existing views
SELECT 
    table_name,
    view_definition
FROM information_schema.views 
WHERE table_name = 'bank_transfer_payments';

-- 7. Show existing constraints
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'crypto_payment_transactions';

-- 8. Show existing triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'crypto_payment_transactions';
