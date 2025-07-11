-- SAFE KYC SCHEMA UPDATE - Handles existing objects
-- Execute this in Supabase SQL Editor

-- ========================================
-- STEP 1: Check existing KYC tables
-- ========================================
SELECT 
    'STEP 1: Checking existing KYC tables' as step,
    table_name,
    CASE WHEN table_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('kyc_information', 'kyc_audit_log');

-- ========================================
-- STEP 2: Create KYC information table (safe)
-- ========================================
CREATE TABLE IF NOT EXISTS public.kyc_information (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Personal Information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  full_legal_name VARCHAR(200) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  
  -- Government ID (encrypted)
  id_type VARCHAR(20) NOT NULL CHECK (id_type IN ('national_id', 'passport')),
  id_number_encrypted TEXT NOT NULL,
  id_number_hash VARCHAR(64) NOT NULL,
  
  -- Contact Information
  phone_number VARCHAR(20) NOT NULL,
  email_address VARCHAR(255) NOT NULL,
  
  -- Address Information
  street_address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country_code VARCHAR(3) NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  
  -- Compliance and Audit
  data_consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_policy_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  kyc_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  kyc_status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (kyc_status IN ('pending', 'completed', 'rejected', 'expired')),
  
  -- Audit Trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_telegram_id BIGINT,
  last_modified_by VARCHAR(100),
  
  -- Certificate Generation
  certificate_requested BOOLEAN DEFAULT FALSE,
  certificate_generated_at TIMESTAMP WITH TIME ZONE,
  certificate_sent_at TIMESTAMP WITH TIME ZONE
);

-- ========================================
-- STEP 3: Add constraints safely
-- ========================================
DO $$ 
BEGIN
    -- Add unique constraint for user_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'kyc_information' 
        AND constraint_name = 'unique_user_kyc'
    ) THEN
        ALTER TABLE public.kyc_information 
        ADD CONSTRAINT unique_user_kyc UNIQUE(user_id);
        RAISE NOTICE 'Added unique_user_kyc constraint';
    END IF;
    
    -- Add unique constraint for id_hash if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'kyc_information' 
        AND constraint_name = 'unique_id_hash'
    ) THEN
        ALTER TABLE public.kyc_information 
        ADD CONSTRAINT unique_id_hash UNIQUE(id_number_hash);
        RAISE NOTICE 'Added unique_id_hash constraint';
    END IF;
END $$;

-- ========================================
-- STEP 4: Create KYC audit log table (safe)
-- ========================================
CREATE TABLE IF NOT EXISTS public.kyc_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_id UUID NOT NULL REFERENCES public.kyc_information(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Audit Information
  action VARCHAR(50) NOT NULL,
  field_changed VARCHAR(100),
  old_value_hash VARCHAR(64),
  new_value_hash VARCHAR(64),
  
  -- Context
  performed_by_telegram_id BIGINT,
  performed_by_username VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Timestamp
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- STEP 5: Create indexes safely
-- ========================================
CREATE INDEX IF NOT EXISTS idx_kyc_information_user_id ON public.kyc_information(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_information_kyc_status ON public.kyc_information(kyc_status);
CREATE INDEX IF NOT EXISTS idx_kyc_information_country_code ON public.kyc_information(country_code);
CREATE INDEX IF NOT EXISTS idx_kyc_information_created_at ON public.kyc_information(created_at);
CREATE INDEX IF NOT EXISTS idx_kyc_information_certificate_requested ON public.kyc_information(certificate_requested);

CREATE INDEX IF NOT EXISTS idx_kyc_audit_log_kyc_id ON public.kyc_audit_log(kyc_id);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_log_user_id ON public.kyc_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_log_action ON public.kyc_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_log_performed_at ON public.kyc_audit_log(performed_at);

-- ========================================
-- STEP 6: Add table comments
-- ========================================
COMMENT ON TABLE public.kyc_information IS 'Stores KYC (Know Your Customer) data for share certificate generation';
COMMENT ON TABLE public.kyc_audit_log IS 'Audit trail for all KYC data access and modifications';

-- ========================================
-- STEP 7: Enable RLS safely
-- ========================================
ALTER TABLE public.kyc_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_audit_log ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 8: Drop existing policies and recreate
-- ========================================
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own KYC data" ON public.kyc_information;
    DROP POLICY IF EXISTS "Users can insert their own KYC data" ON public.kyc_information;
    DROP POLICY IF EXISTS "Users can update their own KYC data" ON public.kyc_information;
    DROP POLICY IF EXISTS "Users can view their own KYC audit logs" ON public.kyc_audit_log;
    
    RAISE NOTICE 'Dropped existing policies';
END $$;

-- Create new policies
CREATE POLICY "Users can view their own KYC data" ON public.kyc_information
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own KYC data" ON public.kyc_information
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own KYC data" ON public.kyc_information
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own KYC audit logs" ON public.kyc_audit_log
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- ========================================
-- STEP 9: Grant permissions
-- ========================================
GRANT SELECT, INSERT, UPDATE ON public.kyc_information TO authenticated;
GRANT SELECT, INSERT ON public.kyc_audit_log TO authenticated;

-- ========================================
-- STEP 10: Create helper functions
-- ========================================

-- Function to check if user has completed KYC
CREATE OR REPLACE FUNCTION public.check_kyc_completion(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.kyc_information 
    WHERE user_id = p_user_id 
    AND kyc_status = 'completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to hash ID numbers
CREATE OR REPLACE FUNCTION public.hash_id_number(p_id_number TEXT)
RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN encode(digest(upper(trim(p_id_number)), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log KYC actions
CREATE OR REPLACE FUNCTION public.log_kyc_action(
  p_kyc_id UUID,
  p_user_id INTEGER,
  p_action VARCHAR(50),
  p_field_changed VARCHAR(100) DEFAULT NULL,
  p_telegram_id BIGINT DEFAULT NULL,
  p_username VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.kyc_audit_log (
    kyc_id,
    user_id,
    action,
    field_changed,
    performed_by_telegram_id,
    performed_by_username
  ) VALUES (
    p_kyc_id,
    p_user_id,
    p_action,
    p_field_changed,
    p_telegram_id,
    p_username
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get certificate timeline
CREATE OR REPLACE FUNCTION public.get_certificate_timeline()
RETURNS TEXT AS $$
DECLARE
  current_day INTEGER;
  timeline_text TEXT;
BEGIN
  current_day := EXTRACT(DOW FROM NOW());
  
  CASE 
    WHEN current_day IN (1, 2, 3) THEN
      timeline_text := 'Your share certificate will be generated and sent within 48 hours (by ' || 
                      TO_CHAR(NOW() + INTERVAL '2 days', 'Day, DD Month YYYY') || ')';
    WHEN current_day = 4 THEN
      timeline_text := 'Your share certificate will be generated and sent by Monday (within 48 business hours)';
    WHEN current_day = 5 THEN
      timeline_text := 'Your share certificate will be generated and sent by Tuesday (within 48 business hours)';
    ELSE
      timeline_text := 'Your share certificate will be generated and sent by Wednesday (within 48 business hours, excluding weekends)';
  END CASE;
  
  RETURN timeline_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- STEP 11: Create update trigger
-- ========================================
CREATE OR REPLACE FUNCTION public.update_kyc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_kyc_updated_at ON public.kyc_information;

-- Create new trigger
CREATE TRIGGER trigger_update_kyc_updated_at
  BEFORE UPDATE ON public.kyc_information
  FOR EACH ROW
  EXECUTE FUNCTION public.update_kyc_updated_at();

-- ========================================
-- STEP 12: Grant function permissions
-- ========================================
GRANT EXECUTE ON FUNCTION public.check_kyc_completion(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hash_id_number(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_kyc_action(UUID, INTEGER, VARCHAR(50), VARCHAR(100), BIGINT, VARCHAR(255)) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_certificate_timeline() TO authenticated;

-- ========================================
-- STEP 13: Final verification
-- ========================================
SELECT 
    'STEP 13: Final verification' as step,
    'KYC schema setup complete' as status,
    NOW() as completed_at;

-- Check if tables exist
SELECT 
    'Tables created:' as check_type,
    table_name,
    '✅ EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('kyc_information', 'kyc_audit_log');

-- Check if functions exist
SELECT 
    'Functions created:' as check_type,
    routine_name,
    '✅ EXISTS' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('check_kyc_completion', 'hash_id_number', 'log_kyc_action', 'get_certificate_timeline');

-- ========================================
-- STEP 14: Create certificate generation view (optional)
-- ========================================
-- Note: This view requires aureus_share_purchases table to exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'aureus_share_purchases'
    ) THEN
        -- Create certificate generation view
        CREATE OR REPLACE VIEW public.certificate_generation_queue AS
        SELECT
          k.id as kyc_id,
          k.user_id,
          k.full_legal_name,
          k.email_address,
          k.kyc_completed_at,
          k.certificate_requested,
          k.certificate_generated_at,
          k.certificate_sent_at,
          u.username as telegram_username,
          COALESCE(SUM(sp.shares_purchased), 0) as total_shares,
          MAX(sp.created_at) as latest_purchase_date
        FROM public.kyc_information k
        JOIN public.users u ON k.user_id = u.id
        LEFT JOIN public.aureus_share_purchases sp ON k.user_id = sp.user_id AND sp.status = 'active'
        WHERE k.kyc_status = 'completed'
          AND k.certificate_requested = TRUE
          AND k.certificate_generated_at IS NULL
        GROUP BY k.id, k.user_id, k.full_legal_name, k.email_address, k.kyc_completed_at,
                 k.certificate_requested, k.certificate_generated_at, k.certificate_sent_at, u.username
        ORDER BY k.kyc_completed_at ASC;

        GRANT SELECT ON public.certificate_generation_queue TO authenticated;

        RAISE NOTICE 'Certificate generation view created successfully';
    ELSE
        RAISE NOTICE 'Skipping certificate view - aureus_share_purchases table not found';
    END IF;
END $$;

SELECT '🎉 KYC SCHEMA UPDATE COMPLETE! 🎉' as final_status;
