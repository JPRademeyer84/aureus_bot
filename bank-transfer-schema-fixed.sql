-- BANK TRANSFER SCHEMA UPDATES - FIXED VERSION
-- Run check-current-schema.sql first to see current structure
-- Then run this script step by step

-- STEP 1: Add transaction_notes column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'crypto_payment_transactions' 
        AND column_name = 'transaction_notes'
    ) THEN
        ALTER TABLE public.crypto_payment_transactions 
        ADD COLUMN transaction_notes TEXT;
        
        RAISE NOTICE 'Added transaction_notes column';
    ELSE
        RAISE NOTICE 'transaction_notes column already exists';
    END IF;
END $$;

-- STEP 2: Create helper function to extract ZAR amount
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

-- STEP 3: Create helper function to check bank transfer
CREATE OR REPLACE FUNCTION public.is_bank_transfer(network_val TEXT, currency_val TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(network_val, '') = 'BANK_TRANSFER' AND COALESCE(currency_val, '') = 'ZAR';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- STEP 4: Update existing bank transfer records with proper JSON
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

-- STEP 5: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_crypto_payment_transactions_bank_transfer 
ON public.crypto_payment_transactions (network, currency) 
WHERE network = 'BANK_TRANSFER';

-- STEP 6: Create view for bank transfer payments (using existing columns)
CREATE OR REPLACE VIEW public.bank_transfer_payments AS
SELECT 
    id,
    user_id,
    amount as usd_amount,
    get_zar_amount(transaction_notes) as zar_amount,
    sender_wallet as proof_file_id,  -- Use sender_wallet instead of sender_wallet_address
    receiver_wallet as bank_account, -- Use receiver_wallet instead of receiver_wallet_address
    status,
    created_at,
    updated_at,
    approved_at,
    approved_by_admin_id
FROM public.crypto_payment_transactions
WHERE network = 'BANK_TRANSFER' AND currency = 'ZAR';

-- STEP 7: Grant permissions
GRANT SELECT, UPDATE ON public.crypto_payment_transactions TO authenticated;
GRANT SELECT ON public.bank_transfer_payments TO authenticated;

-- STEP 8: Add helpful comments
COMMENT ON COLUMN public.crypto_payment_transactions.transaction_notes IS 
'JSON field for storing additional payment details, especially for bank transfers';

COMMENT ON VIEW public.bank_transfer_payments IS 
'Simplified view of bank transfer payments with ZAR amounts extracted from JSON';

COMMENT ON FUNCTION public.get_zar_amount(TEXT) IS 
'Extracts ZAR amount from transaction_notes JSON field';

COMMENT ON FUNCTION public.is_bank_transfer(TEXT, TEXT) IS 
'Checks if a payment is a bank transfer based on network and currency';

-- STEP 9: Test the setup
SELECT 
    'Schema Update Status' as status,
    'SUCCESS' as result;

-- Test functions
SELECT 
    'Function Tests' as test_type,
    get_zar_amount('{"zar_amount": 1800.00}') as zar_test,
    is_bank_transfer('BANK_TRANSFER', 'ZAR') as bank_test;

-- Show current bank transfers
SELECT 
    'Current Bank Transfers' as info,
    COUNT(*) as count
FROM public.crypto_payment_transactions 
WHERE network = 'BANK_TRANSFER';

-- Show sample data
SELECT 
    id,
    amount,
    network,
    currency,
    transaction_notes,
    status,
    created_at
FROM public.crypto_payment_transactions 
WHERE network = 'BANK_TRANSFER'
ORDER BY created_at DESC
LIMIT 3;
