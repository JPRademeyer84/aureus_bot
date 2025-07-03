-- Fix ON CONFLICT issues by adding unique constraints
-- This script adds the missing unique constraints to existing tables

-- Add unique constraint to investment_packages.name
-- First check if constraint already exists, if not add it
DO $$
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'investment_packages_name_key' 
        AND table_name = 'investment_packages'
    ) THEN
        -- Add unique constraint to name column
        ALTER TABLE investment_packages ADD CONSTRAINT investment_packages_name_key UNIQUE (name);
        RAISE NOTICE 'Added unique constraint to investment_packages.name';
    ELSE
        RAISE NOTICE 'Unique constraint on investment_packages.name already exists';
    END IF;
END $$;

-- Add unique constraint to company_wallets(network, currency)
DO $$
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_network_currency' 
        AND table_name = 'company_wallets'
    ) THEN
        -- Add unique constraint to network, currency combination
        ALTER TABLE company_wallets ADD CONSTRAINT unique_network_currency UNIQUE (network, currency);
        RAISE NOTICE 'Added unique constraint to company_wallets(network, currency)';
    ELSE
        RAISE NOTICE 'Unique constraint on company_wallets(network, currency) already exists';
    END IF;
END $$;

-- Verify constraints were added
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE' 
    AND tc.table_name IN ('investment_packages', 'company_wallets')
ORDER BY tc.table_name, tc.constraint_name;
