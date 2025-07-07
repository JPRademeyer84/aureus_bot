-- Legal Documents System Database Schema
-- Add NDA acceptance tracking and document access logging

-- 1. Add NDA acceptance tracking table
CREATE TABLE IF NOT EXISTS public.nda_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  telegram_user_id BIGINT,
  username VARCHAR(255),
  full_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one NDA acceptance per user
  CONSTRAINT unique_user_nda UNIQUE(user_id)
);

-- 2. Create document access logs table
CREATE TABLE IF NOT EXISTS public.document_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL, -- 'cipc', 'sars', 'fnb', 'placer_report'
  document_url TEXT NOT NULL,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  telegram_user_id BIGINT,
  username VARCHAR(255),
  has_nda_acceptance BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nda_acceptances_user_id ON public.nda_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_nda_acceptances_accepted_at ON public.nda_acceptances(accepted_at);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_user_id ON public.document_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_document_type ON public.document_access_logs(document_type);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_accessed_at ON public.document_access_logs(accessed_at);

-- 4. Add comments for documentation
COMMENT ON TABLE public.nda_acceptances IS 'Tracks NDA acceptance by users for legal document access';
COMMENT ON TABLE public.document_access_logs IS 'Logs all attempts to access legal documents';

COMMENT ON COLUMN public.nda_acceptances.user_id IS 'Reference to users table';
COMMENT ON COLUMN public.nda_acceptances.accepted_at IS 'Timestamp when NDA was accepted';
COMMENT ON COLUMN public.nda_acceptances.ip_address IS 'IP address when NDA was accepted (if available)';
COMMENT ON COLUMN public.nda_acceptances.user_agent IS 'User agent when NDA was accepted (if available)';

COMMENT ON COLUMN public.document_access_logs.document_type IS 'Type of document accessed (cipc, sars, fnb, placer_report)';
COMMENT ON COLUMN public.document_access_logs.has_nda_acceptance IS 'Whether user had NDA acceptance at time of access';

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.nda_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies (basic security)
CREATE POLICY "Users can view their own NDA acceptance" ON public.nda_acceptances
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own document access logs" ON public.document_access_logs
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- 7. Grant necessary permissions
GRANT SELECT, INSERT ON public.nda_acceptances TO authenticated;
GRANT SELECT, INSERT ON public.document_access_logs TO authenticated;

-- 8. Insert sample data for testing (optional)
-- INSERT INTO public.nda_acceptances (user_id, telegram_user_id, username, full_name) 
-- VALUES (1, 123456789, 'testuser', 'Test User')
-- ON CONFLICT (user_id) DO NOTHING;

-- 9. Create helper function to check NDA acceptance
CREATE OR REPLACE FUNCTION public.check_nda_acceptance(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.nda_acceptances 
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create function to log document access
CREATE OR REPLACE FUNCTION public.log_document_access(
  p_user_id INTEGER,
  p_document_type VARCHAR(100),
  p_document_url TEXT,
  p_telegram_user_id BIGINT DEFAULT NULL,
  p_username VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
  has_nda BOOLEAN;
BEGIN
  -- Check if user has NDA acceptance
  SELECT public.check_nda_acceptance(p_user_id) INTO has_nda;
  
  -- Insert access log
  INSERT INTO public.document_access_logs (
    user_id, 
    document_type, 
    document_url, 
    telegram_user_id, 
    username, 
    has_nda_acceptance
  ) VALUES (
    p_user_id, 
    p_document_type, 
    p_document_url, 
    p_telegram_user_id, 
    p_username, 
    has_nda
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.check_nda_acceptance(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_document_access(INTEGER, VARCHAR(100), TEXT, BIGINT, VARCHAR(255)) TO authenticated;
