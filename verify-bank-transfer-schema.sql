-- VERIFICATION SCRIPT FOR BANK TRANSFER SCHEMA UPDATES
-- Run this after executing bank-transfer-schema-updates.sql

-- 1. Check if transaction_notes column exists
SELECT 
    'transaction_notes column' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'crypto_payment_transactions' 
            AND column_name = 'transaction_notes'
        ) THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status;

-- 2. Check if bank transfer index exists
SELECT 
    'bank_transfer index' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_crypto_payment_transactions_bank_transfer'
        ) THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status;

-- 3. Check if helper functions exist
SELECT 
    'get_zar_amount function' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'get_zar_amount'
        ) THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status
UNION ALL
SELECT 
    'is_bank_transfer function' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'is_bank_transfer'
        ) THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status;

-- 4. Check if bank_transfer_payments view exists
SELECT 
    'bank_transfer_payments view' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_name = 'bank_transfer_payments'
        ) THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status;

-- 5. Check if audit trigger exists
SELECT 
    'audit_bank_transfer_trigger' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'audit_bank_transfer_trigger'
        ) THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status;

-- 6. Test the helper functions (only if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_zar_amount') THEN
        RAISE NOTICE 'Testing get_zar_amount function...';
        PERFORM get_zar_amount('{"zar_amount": 1800.00}');
        RAISE NOTICE 'get_zar_amount function works!';
    ELSE
        RAISE NOTICE 'get_zar_amount function does not exist';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_bank_transfer') THEN
        RAISE NOTICE 'Testing is_bank_transfer function...';
        PERFORM is_bank_transfer('BANK_TRANSFER', 'ZAR');
        RAISE NOTICE 'is_bank_transfer function works!';
    ELSE
        RAISE NOTICE 'is_bank_transfer function does not exist';
    END IF;
END $$;

-- 7. Show current bank transfer payments
SELECT 
    'Current bank transfers' as info,
    COUNT(*) as count
FROM public.crypto_payment_transactions 
WHERE network = 'BANK_TRANSFER';

-- 8. Show sample bank transfer data (basic query)
SELECT
    id,
    amount as usd_amount,
    transaction_notes,
    status,
    created_at
FROM public.crypto_payment_transactions
WHERE network = 'BANK_TRANSFER'
ORDER BY created_at DESC
LIMIT 3;

-- 9. Test the view
SELECT 
    'View test' as test_name,
    COUNT(*) as bank_transfer_count
FROM public.bank_transfer_payments;

-- 10. Check constraints
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'crypto_payment_transactions' 
AND constraint_name LIKE '%bank_transfer%';

-- Expected results:
-- ✅ All checks should show "EXISTS"
-- ✅ Function tests should return expected values
-- ✅ Bank transfer count should match between table and view
-- ✅ Constraint should exist for bank transfer validation
