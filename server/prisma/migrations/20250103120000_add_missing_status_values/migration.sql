-- Add UNQUALIFIED and CHURNED values to Status enum safely
-- Use DO blocks to handle cases where values might already exist

DO $$ 
BEGIN
    -- Add UNQUALIFIED if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'UNQUALIFIED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Status')
    ) THEN
        ALTER TYPE "Status" ADD VALUE 'UNQUALIFIED';
    END IF;
    
    -- Add CHURNED if it doesn't exist  
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'CHURNED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Status')
    ) THEN
        ALTER TYPE "Status" ADD VALUE 'CHURNED';
    END IF;
END $$; 