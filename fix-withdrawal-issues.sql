-- Fix withdrawal system issues
-- 1. Ensure total_withdrawn column exists (some schemas have total_withdrawn_usdt)
-- 2. Add escrowed_amount column if missing
-- 3. Fix function overloading conflicts

-- Step 1: Add missing columns to commission_balances if they don't exist
ALTER TABLE commission_balances
ADD COLUMN IF NOT EXISTS total_withdrawn DECIMAL(15,2) DEFAULT 0.00;

ALTER TABLE commission_balances
ADD COLUMN IF NOT EXISTS escrowed_amount DECIMAL(15,2) DEFAULT 0.00;

-- Step 1.5: Add missing columns to commission_withdrawals if they don't exist
ALTER TABLE commission_withdrawals
ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(255);

ALTER TABLE commission_withdrawals
ADD COLUMN IF NOT EXISTS approved_by_admin_id BIGINT;

ALTER TABLE commission_withdrawals
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE commission_withdrawals
ADD COLUMN IF NOT EXISTS rejected_by_admin_id BIGINT;

ALTER TABLE commission_withdrawals
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE commission_withdrawals
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Step 2: If total_withdrawn_usdt exists but total_withdrawn doesn't, copy the data
DO $$
BEGIN
    -- Check if total_withdrawn_usdt column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'commission_balances' 
        AND column_name = 'total_withdrawn_usdt'
    ) THEN
        -- Copy data from total_withdrawn_usdt to total_withdrawn
        UPDATE commission_balances 
        SET total_withdrawn = COALESCE(total_withdrawn_usdt, 0)
        WHERE total_withdrawn IS NULL OR total_withdrawn = 0;
        
        -- Drop the old column (optional - uncomment if you want to remove it)
        -- ALTER TABLE commission_balances DROP COLUMN IF EXISTS total_withdrawn_usdt;
    END IF;
END $$;

-- Step 3: Update any existing records to have zero escrow if NULL
UPDATE commission_balances 
SET escrowed_amount = 0.00 
WHERE escrowed_amount IS NULL;

UPDATE commission_balances 
SET total_withdrawn = 0.00 
WHERE total_withdrawn IS NULL;

-- Step 4: Drop old UUID versions of escrow functions to fix overloading
DROP FUNCTION IF EXISTS public.create_commission_escrow(UUID, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS public.create_commission_escrow(UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.release_commission_escrow(UUID, DECIMAL);
DROP FUNCTION IF EXISTS public.release_commission_escrow(UUID, NUMERIC);

-- Step 5: Create the correct INTEGER versions of escrow functions
CREATE OR REPLACE FUNCTION public.create_commission_escrow(
    p_user_id INTEGER,
    p_request_amount DECIMAL,
    p_request_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance DECIMAL := 0;
    v_current_escrow DECIMAL := 0;
    v_available_balance DECIMAL := 0;
    v_result JSON;
BEGIN
    -- Get current balance and escrow amount
    SELECT 
        COALESCE(usdt_balance, 0),
        COALESCE(escrowed_amount, 0)
    INTO 
        v_current_balance,
        v_current_escrow
    FROM commission_balances 
    WHERE user_id = p_user_id;
    
    -- If no balance record exists, create one with zero values
    IF NOT FOUND THEN
        INSERT INTO commission_balances (
            user_id, 
            usdt_balance, 
            escrowed_amount,
            total_earned_usdt,
            total_earned_shares,
            total_withdrawn,
            created_at,
            last_updated
        ) VALUES (
            p_user_id, 
            0, 
            0,
            0,
            0,
            0,
            NOW(),
            NOW()
        );
        
        v_current_balance := 0;
        v_current_escrow := 0;
    END IF;
    
    -- Calculate available balance
    v_available_balance := v_current_balance - v_current_escrow;
    
    -- Check if user has sufficient available balance
    IF v_available_balance < p_request_amount THEN
        -- Return error with balance details
        v_result := json_build_object(
            'success', false,
            'error', 'Insufficient available balance',
            'current_balance', v_current_balance,
            'escrowed_amount', v_current_escrow,
            'available_balance', v_available_balance,
            'requested_amount', p_request_amount
        );
        RETURN v_result;
    END IF;
    
    -- Update escrow amount atomically
    UPDATE commission_balances 
    SET 
        escrowed_amount = v_current_escrow + p_request_amount,
        last_updated = NOW()
    WHERE user_id = p_user_id;
    
    -- Return success with updated balance info
    v_result := json_build_object(
        'success', true,
        'previous_balance', v_current_balance,
        'previous_escrow', v_current_escrow,
        'new_escrow', v_current_escrow + p_request_amount,
        'available_balance', v_available_balance - p_request_amount,
        'escrowed_amount', p_request_amount,
        'request_type', p_request_type
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error details
        v_result := json_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE
        );
        RETURN v_result;
END;
$$;

-- Step 6: Create the release escrow function
CREATE OR REPLACE FUNCTION public.release_commission_escrow(
    p_user_id INTEGER,
    p_escrow_amount DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_escrow DECIMAL := 0;
    v_result JSON;
BEGIN
    -- Get current escrow amount
    SELECT COALESCE(escrowed_amount, 0)
    INTO v_current_escrow
    FROM commission_balances 
    WHERE user_id = p_user_id;
    
    -- If no balance record exists, return error
    IF NOT FOUND THEN
        v_result := json_build_object(
            'success', false,
            'error', 'Commission balance record not found for user'
        );
        RETURN v_result;
    END IF;
    
    -- Check if there's enough escrow to release
    IF v_current_escrow < p_escrow_amount THEN
        v_result := json_build_object(
            'success', false,
            'error', 'Insufficient escrowed amount',
            'current_escrow', v_current_escrow,
            'requested_release', p_escrow_amount
        );
        RETURN v_result;
    END IF;
    
    -- Release escrow amount atomically
    UPDATE commission_balances 
    SET 
        escrowed_amount = GREATEST(0, v_current_escrow - p_escrow_amount),
        last_updated = NOW()
    WHERE user_id = p_user_id;
    
    -- Return success with updated escrow info
    v_result := json_build_object(
        'success', true,
        'previous_escrow', v_current_escrow,
        'released_amount', p_escrow_amount,
        'new_escrow', GREATEST(0, v_current_escrow - p_escrow_amount)
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error details
        v_result := json_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE
        );
        RETURN v_result;
END;
$$;

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION public.create_commission_escrow(INTEGER, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_commission_escrow(INTEGER, DECIMAL) TO authenticated;

-- Step 8: Verify the schema is correct
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'commission_balances' 
AND column_name IN ('user_id', 'usdt_balance', 'escrowed_amount', 'total_withdrawn', 'total_withdrawn_usdt')
ORDER BY column_name;
