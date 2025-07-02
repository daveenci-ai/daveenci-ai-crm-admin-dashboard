# Database Migration Guide - Contact Fields Enhancement

## Overview
This guide walks you through safely migrating your CRM database to include the new contact fields (dual email/phone, industry, website, address).

## ⚠️ Important Prerequisites

1. **Database Connection**: Ensure you have a working database connection
2. **Backup Access**: Make sure you have sufficient disk space for backups
3. **Downtime Planning**: Plan for a brief service interruption during migration
4. **Testing Environment**: Test the migration in a development environment first

## 🔧 Migration Scripts Available

```bash
# Backup database only
npm run db:backup

# Verify migration integrity (run after migration)
npm run db:verify

# Complete safe migration (backup + migrate + verify)
npm run db:migrate-safe

# Rollback to previous backup (emergency only)
npm run db:rollback
```

## 📋 Step-by-Step Migration Process

### Step 1: Pre-Migration Backup
```bash
cd server
npm run db:backup
```

This creates a timestamped backup file in `server/backups/`.

### Step 2: Run Safe Migration
```bash
npm run db:migrate-safe
```

This script will:
1. ✅ Create an automatic backup
2. ✅ Apply the database migration
3. ✅ Regenerate Prisma client
4. ✅ Verify data integrity

### Step 3: Restart Services
```bash
# Restart your backend server
npm run dev

# In another terminal, restart frontend
cd ../src/src
npm start
```

### Step 4: Test New Features
1. Open your CRM application
2. Click "Add Contact" button
3. Verify all new fields are visible:
   - Primary/Secondary Email
   - Primary/Secondary Phone
   - Industry dropdown
   - Website field
   - Address field
4. Create a test contact with various fields
5. Verify the contact displays correctly

## 🛡️ Emergency Rollback

If something goes wrong, you can rollback:

```bash
# View available backups and rollback to most recent
npm run db:rollback

# Or rollback to specific backup file
node scripts/rollback-migration.js /path/to/backup-file.json
```

## 📊 Data Migration Details

### What Gets Migrated
- **Existing email** → **primary_email** (required field)
- **Existing phone** → **primary_phone** (optional field)
- **New fields** → **NULL/empty** initially (secondary_email, secondary_phone, industry, website, address)

### Data Preservation
- ✅ All existing contact data is preserved
- ✅ Legacy email/phone fields remain for compatibility
- ✅ All touchpoints and relationships are maintained
- ✅ User accounts and authentication unchanged

### Schema Changes
```sql
-- New columns added:
ALTER TABLE "contacts" ADD COLUMN "primary_email" TEXT NOT NULL;
ALTER TABLE "contacts" ADD COLUMN "secondary_email" TEXT;
ALTER TABLE "contacts" ADD COLUMN "primary_phone" TEXT;
ALTER TABLE "contacts" ADD COLUMN "secondary_phone" TEXT;
ALTER TABLE "contacts" ADD COLUMN "industry" TEXT;
ALTER TABLE "contacts" ADD COLUMN "website" TEXT;
ALTER TABLE "contacts" ADD COLUMN "address" TEXT;

-- Data migration:
UPDATE "contacts" SET "primary_email" = "email";
UPDATE "contacts" SET "primary_phone" = "phone" WHERE "phone" IS NOT NULL;
```

## 🔍 Verification Checklist

After migration, verify:

- [ ] All existing contacts still visible
- [ ] Contact emails migrated to primary_email
- [ ] Contact phones migrated to primary_phone (where present)
- [ ] New contact form shows all fields
- [ ] Can create contacts with new fields
- [ ] Search works across all fields
- [ ] Contact details panel shows organized sections
- [ ] No data corruption or missing records

## 🚨 Troubleshooting

### Database Connection Issues
```bash
# Check database connection
npx prisma db push --preview-feature
```

### Migration Fails
1. Check error message in console
2. Verify database permissions
3. Ensure database is not locked
4. Rollback and try again

### Data Integrity Issues
```bash
# Run verification manually
npm run db:verify
```

### Frontend Issues After Migration
1. Clear browser cache
2. Restart frontend development server
3. Check browser console for errors
4. Verify API endpoints are responding

## 📞 Support

If you encounter issues:

1. **Check the console output** for specific error messages
2. **Run verification** to check data integrity
3. **Rollback if necessary** to restore service
4. **Contact your database administrator** for complex issues

## 🎉 Success Indicators

Migration is successful when:
- ✅ Backup created successfully
- ✅ Migration applied without errors
- ✅ Verification passed with no data integrity issues
- ✅ Frontend loads with new form fields
- ✅ Can create and view contacts with enhanced data

---

**Last Updated**: Phase 6 - Data Migration Strategy
**Version**: 1.0.0 