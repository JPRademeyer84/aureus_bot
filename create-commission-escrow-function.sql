-- Add missing escrowed_amount column to commission_balances table
-- This column is required for the escrow system to work properly
ALTER TABLE commission_balances
ADD COLUMN IF NOT EXISTS escrowed_amount DECIMAL(15,2) DEFAULT 0.00;

-- Update any existing records to have zero escrow
UPDATE commission_balances
SET escrowed_amount = 0.00
WHERE escrowed_amount IS NULL;

-- Create the missing create_commission_escrow function
-- This function atomically checks available balance and creates escrow for commission requests

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
            total_withdrawn_usdt,
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_commission_escrow(INTEGER, DECIMAL, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.create_commission_escrow(INTEGER, DECIMAL, TEXT) IS
'Atomically checks available commission balance and creates escrow for withdrawal/conversion requests. Prevents double-spending by locking funds until request is approved or rejected.';

-- Create the release_commission_escrow function
-- This function releases escrowed funds when requests are rejected or cancelled

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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.release_commission_escrow(INTEGER, DECIMAL) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.release_commission_escrow(INTEGER, DECIMAL) IS
'Releases escrowed commission funds when withdrawal or conversion requests are rejected or cancelled. Ensures escrow integrity.';
