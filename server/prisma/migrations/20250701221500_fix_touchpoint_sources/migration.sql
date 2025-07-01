-- Migration to fix TouchpointSource enum
-- Handle potential partial failure from previous migration

-- Create the new enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'touchpoint_source_new') THEN
        CREATE TYPE "touchpoint_source_new" AS ENUM ('MANUAL', 'EMAIL', 'SMS', 'PHONE', 'IN_PERSON', 'EVENT', 'OTHER');
    END IF;
END $$;

-- Update the column to use the new enum, handling all possible current states
ALTER TABLE touchpoints ALTER COLUMN source TYPE "touchpoint_source_new" USING 
  CASE 
    WHEN source::text = 'MEETING' THEN 'IN_PERSON'::"touchpoint_source_new"
    WHEN source::text = 'AUTO' THEN 'OTHER'::"touchpoint_source_new"
    WHEN source::text = 'IN_PERSON' THEN 'IN_PERSON'::"touchpoint_source_new"
    WHEN source::text = 'OTHER' THEN 'OTHER'::"touchpoint_source_new"
    WHEN source::text = 'MANUAL' THEN 'MANUAL'::"touchpoint_source_new"
    WHEN source::text = 'EMAIL' THEN 'EMAIL'::"touchpoint_source_new"
    WHEN source::text = 'SMS' THEN 'SMS'::"touchpoint_source_new"
    WHEN source::text = 'PHONE' THEN 'PHONE'::"touchpoint_source_new"
    ELSE 'MANUAL'::"touchpoint_source_new"
  END;

-- Drop old enum and rename new one
DROP TYPE IF EXISTS "touchpoint_source";
ALTER TYPE "touchpoint_source_new" RENAME TO "touchpoint_source"; 