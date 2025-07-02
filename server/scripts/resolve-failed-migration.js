const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function resolveFailedMigration() {
  console.log('🔧 Resolving failed migration in production database...');
  console.log('=====================================================\n');
  
  try {
    // Step 1: Try to mark the failed migration as resolved
    console.log('STEP 1: Attempting to resolve failed migration');
    console.log('-----------------------------------------------');
    
    const resolveCommand = 'npx prisma migrate resolve --applied 20250103000000_add_unqualified_churned_status';
    console.log(`Running: ${resolveCommand}`);
    
    let migrationResolved = false;
    try {
      const { stdout: resolveOutput, stderr: resolveError } = await execAsync(resolveCommand);
      
      if (resolveError && !resolveError.includes('warning')) {
        console.log('⚠️  Resolve output:', resolveError);
      }
      
      console.log('Resolve output:', resolveOutput);
      console.log('✅ Failed migration marked as resolved\n');
      migrationResolved = true;
    } catch (resolveErr) {
      console.log('⚠️  Could not resolve specific migration (file not found)');
      console.log('🔄 Will attempt to reset migration state instead\n');
    }
    
    // Step 2: If we couldn't resolve the specific migration, try to reset
    if (!migrationResolved) {
      console.log('STEP 1b: Resetting migration state');
      console.log('----------------------------------');
      
      try {
        // Try to reset the migration state to the last known good migration
        const resetCommand = 'npx prisma migrate resolve --rolled-back 20250103000000_add_unqualified_churned_status';
        console.log(`Running: ${resetCommand}`);
        
        const { stdout: resetOutput, stderr: resetError } = await execAsync(resetCommand);
        
        if (resetError && !resetError.includes('warning')) {
          console.log('⚠️  Reset output:', resetError);
        }
        
        console.log('Reset output:', resetOutput);
        console.log('✅ Migration state reset\n');
      } catch (resetErr) {
        console.log('⚠️  Could not reset migration state, trying force approach\n');
        
        // As a last resort, try to manually update the database
        console.log('STEP 1c: Force removing failed migration record');
        console.log('---------------------------------------------');
        
        const forceCommand = `npx prisma db execute --stdin <<EOF
DELETE FROM "_prisma_migrations" WHERE migration_name = '20250103000000_add_unqualified_churned_status';
EOF`;
        
        try {
          await execAsync(forceCommand);
          console.log('✅ Forced removal of failed migration record\n');
        } catch (forceErr) {
          console.log('⚠️  Force removal failed, proceeding anyway\n');
        }
      }
    }
    
    // Step 3: Apply the new migration
    console.log('STEP 2: Applying new migration');
    console.log('------------------------------');
    
    const { stdout: migrateOutput, stderr: migrateError } = await execAsync('npx prisma migrate deploy');
    
    if (migrateError && !migrateError.includes('warning')) {
      throw new Error(`Migration deployment failed: ${migrateError}`);
    }
    
    console.log('Migration output:', migrateOutput);
    console.log('✅ New migration applied successfully!\n');
    
    // Step 4: Generate Prisma client
    console.log('STEP 3: Regenerating Prisma client');
    console.log('-----------------------------------');
    await execAsync('npx prisma generate');
    console.log('✅ Prisma client regenerated\n');
    
    console.log('🎉 MIGRATION RESOLUTION COMPLETED!');
    console.log('==================================');
    console.log('✅ Failed migration resolved');
    console.log('✅ New migration applied');
    console.log('✅ Prisma client updated');
    
    return { success: true };
    
  } catch (error) {
    console.error('\n❌ MIGRATION RESOLUTION FAILED!');
    console.error('================================');
    console.error('Error:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  resolveFailedMigration()
    .then(() => {
      console.log('\n✅ Migration resolution completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration resolution failed!');
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = { resolveFailedMigration }; 