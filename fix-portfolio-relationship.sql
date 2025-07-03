-- Fix portfolio relationship issue
-- Run this in Supabase SQL Editor

-- First, let's check if share_packages table exists and get its structure
-- If it doesn't exist, we'll create it

-- Create share_packages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.share_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  price DECIMAL(15,2) NOT NULL,
  shares INTEGER NOT NULL,
  description TEXT,
  roi DECIMAL(5,2) DEFAULT 0,
  quarter_dividends DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default share packages if they don't exist
INSERT INTO public.share_packages (name, price, shares, description, roi, quarter_dividends) 
VALUES 
  ('Shovel', 25.00, 25, 'Entry-level mining equipment package', 12.00, 0.75),
  ('Miner', 75.00, 75, 'Basic mining equipment package', 15.00, 2.81),
  ('Excavator', 250.00, 250, 'Intermediate mining equipment package', 18.00, 11.25),
  ('Crusher', 500.00, 500, 'Advanced mining equipment package', 20.00, 25.00),
  ('Refinery', 750.00, 750, 'Premium mining equipment package', 22.00, 41.25),
  ('Aureus', 1000.00, 1000, 'Elite mining equipment package', 25.00, 62.50),
  ('Titan', 2500.00, 2500, 'Professional mining equipment package', 28.00, 175.00),
  ('Empire', 5000.00, 5000, 'Ultimate mining equipment package', 30.00, 375.00)
ON CONFLICT (name) DO NOTHING;

-- Add foreign key constraint to aureus_share_purchases if it doesn't exist
-- First, add the column if it doesn't exist
DO $$ 
BEGIN
  -- Check if package_id column exists and is the right type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'aureus_share_purchases' 
    AND column_name = 'package_id' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.aureus_share_purchases ADD COLUMN package_id UUID;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'aureus_share_purchases_package_id_fkey'
    AND table_name = 'aureus_share_purchases'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.aureus_share_purchases 
    ADD CONSTRAINT aureus_share_purchases_package_id_fkey 
    FOREIGN KEY (package_id) REFERENCES public.share_packages(id);
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_aureus_share_purchases_package_id ON public.aureus_share_purchases(package_id);

-- Enable RLS for share_packages
ALTER TABLE public.share_packages ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for share_packages
DROP POLICY IF EXISTS "Anyone can view share packages" ON public.share_packages;
CREATE POLICY "Anyone can view share packages" ON public.share_packages
  FOR SELECT USING (true);

-- Grant permissions
GRANT ALL ON public.share_packages TO authenticated;
GRANT ALL ON public.share_packages TO service_role;

-- Add comments
COMMENT ON TABLE public.share_packages IS 'Available share purchase packages';
COMMENT ON COLUMN public.aureus_share_purchases.package_id IS 'References the share package used for this purchase';
