-- Migration to update TouchpointSource enum
-- First, update existing data
UPDATE touchpoints SET source = 'IN_PERSON' WHERE source = 'MEETING';
UPDATE touchpoints SET source = 'OTHER' WHERE source = 'AUTO';

-- Drop the old enum and create new one
ALTER TYPE "touchpoint_source" RENAME TO "touchpoint_source_old";

CREATE TYPE "touchpoint_source" AS ENUM ('MANUAL', 'EMAIL', 'SMS', 'PHONE', 'IN_PERSON', 'EVENT', 'OTHER');

ALTER TABLE touchpoints ALTER COLUMN source TYPE "touchpoint_source" USING source::text::"touchpoint_source";

DROP TYPE "touchpoint_source_old"; 