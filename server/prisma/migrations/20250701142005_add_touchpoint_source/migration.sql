-- CreateEnum
CREATE TYPE "touchpoint_source" AS ENUM ('MANUAL', 'EMAIL', 'SMS', 'PHONE', 'MEETING', 'AUTO');
 
-- AlterTable
ALTER TABLE "touchpoints" ADD COLUMN "source" "touchpoint_source" NOT NULL DEFAULT 'MANUAL'; 