-- CreateExtendedContactFields
-- This migration adds new contact fields and restructures email/phone fields

-- Step 1: Add new columns to contacts table
ALTER TABLE "public"."contacts" ADD COLUMN "primary_email" TEXT;
ALTER TABLE "public"."contacts" ADD COLUMN "secondary_email" TEXT;
ALTER TABLE "public"."contacts" ADD COLUMN "primary_phone" TEXT;
ALTER TABLE "public"."contacts" ADD COLUMN "secondary_phone" TEXT;
ALTER TABLE "public"."contacts" ADD COLUMN "industry" TEXT;
ALTER TABLE "public"."contacts" ADD COLUMN "website" TEXT;
ALTER TABLE "public"."contacts" ADD COLUMN "address" TEXT;

-- Step 2: Migrate existing data
-- Copy existing email to primary_email
UPDATE "public"."contacts" SET "primary_email" = "email" WHERE "email" IS NOT NULL;

-- Copy existing phone to primary_phone  
UPDATE "public"."contacts" SET "primary_phone" = "phone" WHERE "phone" IS NOT NULL;

-- Step 3: Make primary_email NOT NULL (since email was required before)
ALTER TABLE "public"."contacts" ALTER COLUMN "primary_email" SET NOT NULL;

-- Step 4: Drop old columns (after data migration is complete and verified)
-- Note: In production, you might want to keep these columns temporarily for rollback safety
-- ALTER TABLE "public"."contacts" DROP COLUMN "email";
-- ALTER TABLE "public"."contacts" DROP COLUMN "phone";

-- For now, let's rename them to _old for safety and potential rollback
ALTER TABLE "public"."contacts" RENAME COLUMN "email" TO "email_old";
ALTER TABLE "public"."contacts" RENAME COLUMN "phone" TO "phone_old";

-- Step 5: Add any indexes that might be helpful
CREATE INDEX IF NOT EXISTS "contacts_primary_email_idx" ON "public"."contacts"("primary_email");
CREATE INDEX IF NOT EXISTS "contacts_industry_idx" ON "public"."contacts"("industry"); 