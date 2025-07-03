-- Check existing table structures
-- Run this in Supabase SQL Editor to see what columns exist

-- Check if share_packages table exists and its structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('share_packages', 'investment_packages', 'packages')
ORDER BY table_name, ordinal_position;

-- Check all tables that might contain package information
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%package%'
ORDER BY table_name;

-- Check aureus_share_purchases structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'aureus_share_purchases'
ORDER BY ordinal_position;
