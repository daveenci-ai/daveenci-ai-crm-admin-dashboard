# Database Migration Plan - Daveenci CRM

## Overview
This plan outlines the steps to migrate the current Prisma schema to match the new database structure while preserving all existing data.

## Current vs Target Database Structure

### New Tables to Add:
1. **`avatars`** - Avatar models with Replicate integration
2. **`avatars_generated`** - Generated avatar images
3. **`contacts_temp`** - Temporary contacts table (appears to be a duplicate/backup)

### Changes to Existing Tables:

#### `users` table:
- Add `validated` boolean field (default: false)

#### `contacts` table:
- Add social media fields:
  - `linkedin_url`
  - `facebook_url`
  - `instagram_url`
  - `youtube_url`
  - `tiktok_url`

#### `touchpoints` table:
- Already up to date

#### `events` and `event_participants` tables:
- Already up to date

## Migration Steps

### Phase 1: Schema Updates
1. Update Prisma schema file
2. Generate new migration
3. Apply migration safely

### Phase 2: Data Verification
1. Verify all existing data is preserved
2. Test all relationships
3. Verify new constraints

### Phase 3: Application Updates
1. Update API endpoints if needed
2. Update frontend components if needed
3. Test full application flow

## Execution Plan

### Step 1: Backup Current Database (Server-hosted)
Since your database is hosted on a server, you have a few options:

**Option A: Use your hosting provider's backup system**
- Most hosting providers (Railway, Heroku, DigitalOcean, etc.) have built-in backup systems
- Create a backup through your hosting dashboard before proceeding

**Option B: Create a database dump (if you have direct access)**
```bash
# If you have direct database access
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Option C: Skip backup (if you're confident)**
- Prisma migrations are generally safe and reversible
- The migration only adds new fields/tables, doesn't modify existing data

### Step 2: Update Prisma Schema
- Update `server/prisma/schema.prisma` with new models and fields

### Step 3: Generate and Apply Migration
```bash
cd server
npx prisma migrate dev --name "add_avatars_and_social_fields"
```

### Step 4: Generate Prisma Client
```bash
cd server
npx prisma generate
```

### Step 5: Verify Migration
```bash
npm run db:verify --prefix server
```

### Step 6: Build and Start
```bash
# Build the entire project
npm run build

# Start development server
npm run dev

# OR start production
npm run start:server
npm run start:frontend
```

## Build and Start Commands

### Development
```bash
# Install dependencies (if needed)
npm run setup

# Start both server and frontend in development mode
npm run dev
```

### Production Build
```bash
# Build both server and frontend
npm run build

# Start server
npm run start:server

# Start frontend (in separate terminal)
npm run start:frontend
```

### Database Commands
```bash
# Run migrations
npm run db:migrate

# Open Prisma Studio
npm run db:studio

# Push schema changes (alternative to migrate)
npm run db:push

# Backup database
npm run db:backup --prefix server
```

## Rollback Plan (if needed)
If something goes wrong:
1. Stop the application
2. **For server-hosted DB**: Restore from your hosting provider's backup or use `psql $DATABASE_URL < backup_file.sql`
3. Revert schema changes in `server/prisma/schema.prisma`
4. Run `npx prisma migrate reset` (⚠️ This will recreate the database from scratch)
5. Regenerate Prisma client: `npx prisma generate`

## Data Preservation Guarantees
- All existing users will be preserved
- All existing contacts will be preserved
- All existing touchpoints will be preserved
- All existing events and participants will be preserved
- New fields will be added with appropriate defaults

## Testing Checklist
- [ ] Users can still log in
- [ ] Contacts are visible and editable
- [ ] Touchpoints are preserved
- [ ] Events and participants are intact
- [ ] New avatar features work (if implemented)
- [ ] Social media fields can be added to contacts

## Notes
- The `contacts_temp` table appears to be a backup/temporary table
- Consider if this should be integrated or kept separate
- New avatar functionality will require frontend implementation
- Social media fields are optional and won't break existing functionality 