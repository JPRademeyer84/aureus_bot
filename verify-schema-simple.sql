-- SIMPLE VERIFICATION SCRIPT
-- Run this after bank-transfer-schema-fixed.sql

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

-- 2. Check if helper functions exist
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

-- 3. Check if view exists
SELECT 
    'bank_transfer_payments view' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_name = 'bank_transfer_payments'
        ) THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status;

-- 4. Check if index exists
SELECT 
    'bank_transfer index' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_crypto_payment_transactions_bank_transfer'
        ) THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status;

-- 5. Test functions (safe version)
DO $$ 
BEGIN
    BEGIN
        PERFORM get_zar_amount('{"zar_amount": 1800.00}');
        RAISE NOTICE '✅ get_zar_amount function works';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ get_zar_amount function error: %', SQLERRM;
    END;
    
    BEGIN
        PERFORM is_bank_transfer('BANK_TRANSFER', 'ZAR');
        RAISE NOTICE '✅ is_bank_transfer function works';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ is_bank_transfer function error: %', SQLERRM;
    END;
END $$;

-- 6. Show current bank transfers
SELECT 
    'Current bank transfers' as info,
    COUNT(*) as count
FROM public.crypto_payment_transactions 
WHERE network = 'BANK_TRANSFER';

-- 7. Show sample bank transfer data (safe query - only basic columns)
SELECT
    id,
    amount as usd_amount,
    network,
    currency,
    status,
    created_at
FROM public.crypto_payment_transactions
WHERE network = 'BANK_TRANSFER'
ORDER BY created_at DESC
LIMIT 3;

-- 8. Test the view (safe version)
DO $$ 
BEGIN
    BEGIN
        PERFORM COUNT(*) FROM public.bank_transfer_payments;
        RAISE NOTICE '✅ bank_transfer_payments view works';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ bank_transfer_payments view error: %', SQLERRM;
    END;
END $$;

-- 9. Summary
SELECT 
    'VERIFICATION COMPLETE' as status,
    NOW() as timestamp;
