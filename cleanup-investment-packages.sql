-- CLEANUP SCRIPT: Remove investment_packages references
-- Run this in Supabase SQL Editor to clean up old package system

-- 1. Drop investment_packages table if it exists
DROP TABLE IF EXISTS investment_packages CASCADE;

-- 2. Remove package_id column from aureus_investments if it exists
ALTER TABLE aureus_investments DROP COLUMN IF EXISTS package_id;

-- 3. Clean up any remaining indexes
DROP INDEX IF EXISTS idx_investment_packages_active;
DROP INDEX IF EXISTS idx_investment_packages_price;

-- 4. Verify cleanup
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%package%' OR column_name LIKE '%package%')
ORDER BY table_name, column_name;

-- Expected result: No rows returned (all package references removed)
