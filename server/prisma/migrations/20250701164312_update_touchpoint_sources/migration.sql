-- Migration to update TouchpointSource enum
-- Create the new enum
CREATE TYPE "touchpoint_source_new" AS ENUM ('MANUAL', 'EMAIL', 'SMS', 'PHONE', 'IN_PERSON', 'EVENT', 'OTHER');

-- Convert the column to use the new enum, mapping old values to new ones
ALTER TABLE touchpoints ALTER COLUMN source TYPE "touchpoint_source_new" USING 
  CASE 
    WHEN source::text = 'MEETING' THEN 'IN_PERSON'::"touchpoint_source_new"
    WHEN source::text = 'AUTO' THEN 'OTHER'::"touchpoint_source_new"
    ELSE source::text::"touchpoint_source_new"
  END;

-- Drop old enum and rename new one
DROP TYPE "touchpoint_source";
ALTER TYPE "touchpoint_source_new" RENAME TO "touchpoint_source"; 