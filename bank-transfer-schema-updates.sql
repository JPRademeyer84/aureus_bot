-- BANK TRANSFER SYSTEM SCHEMA UPDATES
-- Execute these SQL commands in your Supabase SQL editor

-- 1. Add transaction_notes column to crypto_payment_transactions table
-- This will store bank transfer details in JSON format
ALTER TABLE public.crypto_payment_transactions 
ADD COLUMN IF NOT EXISTS transaction_notes TEXT;

-- 2. Add comment to explain the transaction_notes usage
COMMENT ON COLUMN public.crypto_payment_transactions.transaction_notes IS 
'JSON field for storing additional payment details, especially for bank transfers. Format: {"payment_method": "bank_transfer", "zar_amount": 1000.00, "exchange_rate": 18, "transaction_fee_percent": 10}';

-- 3. Update existing bank transfer records to have proper transaction_notes
-- This will parse the transaction_hash field and create proper JSON
UPDATE public.crypto_payment_transactions 
SET transaction_notes = json_build_object(
    'payment_method', 'bank_transfer',
    'zar_amount', CASE 
        WHEN transaction_hash ~ 'ZAR:([0-9.]+)' THEN 
            (regexp_match(transaction_hash, 'ZAR:([0-9.]+)'))[1]::numeric
        ELSE NULL 
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
AND transaction_notes IS NULL;

-- 4. Create index for better performance on bank transfer queries
CREATE INDEX IF NOT EXISTS idx_crypto_payment_transactions_bank_transfer 
ON public.crypto_payment_transactions (network, currency) 
WHERE network = 'BANK_TRANSFER';

-- 5. Add check constraint to ensure valid bank transfer data
-- First drop if exists, then create
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_bank_transfer_currency'
        AND table_name = 'crypto_payment_transactions'
    ) THEN
        ALTER TABLE public.crypto_payment_transactions
        ADD CONSTRAINT chk_bank_transfer_currency
        CHECK (
            (network = 'BANK_TRANSFER' AND currency = 'ZAR') OR
            (network != 'BANK_TRANSFER')
        );
    END IF;
END $$;

-- 6. Create function to extract ZAR amount from transaction_notes
CREATE OR REPLACE FUNCTION public.get_zar_amount(transaction_notes_json TEXT)
RETURNS NUMERIC AS $$
BEGIN
    IF transaction_notes_json IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN (transaction_notes_json::json->>'zar_amount')::numeric;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Create function to check if payment is bank transfer
CREATE OR REPLACE FUNCTION public.is_bank_transfer(network_val TEXT, currency_val TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN network_val = 'BANK_TRANSFER' AND currency_val = 'ZAR';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. Update RLS policies to include bank transfer payments
-- Allow users to view their own bank transfer payments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'Users can view own bank transfer payments'
        AND tablename = 'crypto_payment_transactions'
    ) THEN
        CREATE POLICY "Users can view own bank transfer payments"
        ON public.crypto_payment_transactions
        FOR SELECT
        USING (
            auth.uid()::text IN (
                SELECT telegram_id::text
                FROM public.telegram_users
                WHERE user_id = crypto_payment_transactions.user_id
            )
        );
    END IF;
END $$;

-- 9. Grant necessary permissions for the new column
GRANT SELECT, UPDATE ON public.crypto_payment_transactions TO authenticated;

-- 10. Create view for easy bank transfer reporting
CREATE OR REPLACE VIEW public.bank_transfer_payments AS
SELECT 
    id,
    user_id,
    amount as usd_amount,
    get_zar_amount(transaction_notes) as zar_amount,
    sender_wallet_address as proof_file_id,
    receiver_wallet_address as bank_account,
    status,
    created_at,
    updated_at,
    approved_at,
    approved_by_admin_id
FROM public.crypto_payment_transactions
WHERE network = 'BANK_TRANSFER' AND currency = 'ZAR';

-- 11. Grant access to the view
GRANT SELECT ON public.bank_transfer_payments TO authenticated;

-- 12. Add helpful comments
COMMENT ON VIEW public.bank_transfer_payments IS 
'Simplified view of bank transfer payments with ZAR amounts extracted from JSON';

COMMENT ON FUNCTION public.get_zar_amount(TEXT) IS 
'Extracts ZAR amount from transaction_notes JSON field';

COMMENT ON FUNCTION public.is_bank_transfer(TEXT, TEXT) IS 
'Checks if a payment is a bank transfer based on network and currency';

-- 13. Create audit trigger for bank transfer payments
CREATE OR REPLACE FUNCTION public.audit_bank_transfer_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.network = 'BANK_TRANSFER' THEN
        INSERT INTO public.admin_audit_log (
            admin_id,
            action_type,
            target_type,
            target_id,
            details,
            timestamp
        ) VALUES (
            COALESCE(NEW.approved_by_admin_id, 0),
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'CREATE_BANK_TRANSFER'
                WHEN TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN 'UPDATE_BANK_TRANSFER_STATUS'
                ELSE 'UPDATE_BANK_TRANSFER'
            END,
            'bank_transfer_payment',
            NEW.id::text,
            json_build_object(
                'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
                'new_status', NEW.status,
                'amount_usd', NEW.amount,
                'zar_amount', get_zar_amount(NEW.transaction_notes)
            )::text,
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. Create the trigger
DROP TRIGGER IF EXISTS audit_bank_transfer_trigger ON public.crypto_payment_transactions;
CREATE TRIGGER audit_bank_transfer_trigger
    AFTER INSERT OR UPDATE ON public.crypto_payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_bank_transfer_changes();

-- 15. Verify the schema updates
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'crypto_payment_transactions' 
AND column_name = 'transaction_notes';

-- Expected result: Should show the transaction_notes column exists

-- 16. Test query to verify bank transfer functionality
SELECT 
    id,
    amount,
    network,
    currency,
    get_zar_amount(transaction_notes) as zar_amount,
    is_bank_transfer(network, currency) as is_bank_transfer,
    status,
    created_at
FROM public.crypto_payment_transactions 
WHERE network = 'BANK_TRANSFER'
ORDER BY created_at DESC
LIMIT 5;

-- This should show any existing bank transfer payments with proper ZAR amounts
