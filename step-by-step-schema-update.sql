-- STEP-BY-STEP SCHEMA UPDATE FOR BANK TRANSFERS
-- Execute each step one by one in Supabase SQL Editor

-- ========================================
-- STEP 1: Check current table structure
-- ========================================
SELECT 
    'STEP 1: Current table structure' as step,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'crypto_payment_transactions'
ORDER BY ordinal_position;

-- ========================================
-- STEP 2: Add transaction_notes column
-- ========================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'crypto_payment_transactions' 
        AND column_name = 'transaction_notes'
    ) THEN
        ALTER TABLE public.crypto_payment_transactions 
        ADD COLUMN transaction_notes TEXT;
        
        RAISE NOTICE 'STEP 2: Added transaction_notes column successfully';
    ELSE
        RAISE NOTICE 'STEP 2: transaction_notes column already exists';
    END IF;
END $$;

-- ========================================
-- STEP 3: Verify column was added
-- ========================================
SELECT 
    'STEP 3: Verify transaction_notes column' as step,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'crypto_payment_transactions' 
            AND column_name = 'transaction_notes'
        ) THEN '✅ transaction_notes column EXISTS' 
        ELSE '❌ transaction_notes column MISSING' 
    END as status;

-- ========================================
-- STEP 4: Create helper function for ZAR amounts
-- ========================================
CREATE OR REPLACE FUNCTION public.get_zar_amount(transaction_notes_json TEXT)
RETURNS NUMERIC AS $$
BEGIN
    IF transaction_notes_json IS NULL OR transaction_notes_json = '' THEN
        RETURN NULL;
    END IF;
    
    BEGIN
        RETURN (transaction_notes_json::json->>'zar_amount')::numeric;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN NULL;
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

SELECT 'STEP 4: Created get_zar_amount function' as step;

-- ========================================
-- STEP 5: Create helper function for bank transfer check
-- ========================================
CREATE OR REPLACE FUNCTION public.is_bank_transfer(network_val TEXT, currency_val TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(network_val, '') = 'BANK_TRANSFER' AND COALESCE(currency_val, '') = 'ZAR';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

SELECT 'STEP 5: Created is_bank_transfer function' as step;

-- ========================================
-- STEP 6: Test the functions
-- ========================================
SELECT 
    'STEP 6: Function tests' as step,
    get_zar_amount('{"zar_amount": 1800.00}') as zar_test_result,
    is_bank_transfer('BANK_TRANSFER', 'ZAR') as bank_test_result;

-- ========================================
-- STEP 7: Update existing bank transfer records
-- ========================================
UPDATE public.crypto_payment_transactions 
SET transaction_notes = json_build_object(
    'payment_method', 'bank_transfer',
    'zar_amount', CASE 
        WHEN transaction_hash ~ 'ZAR:([0-9.]+)' THEN 
            (regexp_match(transaction_hash, 'ZAR:([0-9.]+)'))[1]::numeric
        ELSE amount * 18 -- fallback calculation
    END,
    'exchange_rate', CASE 
        WHEN transaction_hash ~ 'RATE:([0-9.]+)' THEN 
            (regexp_match(transaction_hash, 'RATE:([0-9.]+)'))[1]::numeric
        ELSE 18 
    END,
    'transaction_fee_percent', 10
)::text
WHERE network = 'BANK_TRANSFER' 
AND currency = 'ZAR' 
AND (transaction_notes IS NULL OR transaction_notes = '');

SELECT 'STEP 7: Updated existing bank transfer records' as step;

-- ========================================
-- STEP 8: Create performance index
-- ========================================
CREATE INDEX IF NOT EXISTS idx_crypto_payment_transactions_bank_transfer 
ON public.crypto_payment_transactions (network, currency) 
WHERE network = 'BANK_TRANSFER';

SELECT 'STEP 8: Created performance index' as step;

-- ========================================
-- STEP 9: Create bank transfer view
-- ========================================
CREATE OR REPLACE VIEW public.bank_transfer_payments AS
SELECT 
    id,
    user_id,
    amount as usd_amount,
    get_zar_amount(transaction_notes) as zar_amount,
    sender_wallet as proof_file_id,
    receiver_wallet as bank_account,
    status,
    created_at,
    updated_at,
    approved_at,
    approved_by_admin_id
FROM public.crypto_payment_transactions
WHERE network = 'BANK_TRANSFER' AND currency = 'ZAR';

SELECT 'STEP 9: Created bank_transfer_payments view' as step;

-- ========================================
-- STEP 10: Grant permissions
-- ========================================
GRANT SELECT, UPDATE ON public.crypto_payment_transactions TO authenticated;
GRANT SELECT ON public.bank_transfer_payments TO authenticated;

SELECT 'STEP 10: Granted permissions' as step;

-- ========================================
-- STEP 11: Final verification
-- ========================================
SELECT 
    'STEP 11: Final verification' as step,
    COUNT(*) as total_bank_transfers
FROM public.crypto_payment_transactions 
WHERE network = 'BANK_TRANSFER';

-- Show sample data with new transaction_notes
SELECT 
    'Sample bank transfer data' as info,
    id,
    amount,
    transaction_notes,
    status
FROM public.crypto_payment_transactions 
WHERE network = 'BANK_TRANSFER'
ORDER BY created_at DESC
LIMIT 2;

SELECT 'SCHEMA UPDATE COMPLETE ✅' as final_status;
