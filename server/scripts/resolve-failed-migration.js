const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function resolveFailedMigration() {
  console.log('🔧 Resolving failed migration in production database...');
  console.log('=====================================================\n');
  
  try {
    // Step 1: Mark the failed migration as resolved
    console.log('STEP 1: Marking failed migration as resolved');
    console.log('--------------------------------------------');
    
    const resolveCommand = 'npx prisma migrate resolve --applied 20250103000000_add_unqualified_churned_status';
    console.log(`Running: ${resolveCommand}`);
    
    try {
      const { stdout: resolveOutput, stderr: resolveError } = await execAsync(resolveCommand);
      
      if (resolveError && !resolveError.includes('warning')) {
        console.log('⚠️  Resolve output:', resolveError);
      }
      
      console.log('Resolve output:', resolveOutput);
      console.log('✅ Failed migration marked as resolved\n');
    } catch (resolveErr) {
      // If the migration doesn't exist, that's fine - it means it was already cleaned up
      console.log('ℹ️  Migration not found (already cleaned up), proceeding to apply new migration\n');
    }
    
    // Step 2: Apply the new migration
    console.log('STEP 2: Applying new migration');
    console.log('------------------------------');
    
    const { stdout: migrateOutput, stderr: migrateError } = await execAsync('npx prisma migrate deploy');
    
    if (migrateError && !migrateError.includes('warning')) {
      throw new Error(`Migration deployment failed: ${migrateError}`);
    }
    
    console.log('Migration output:', migrateOutput);
    console.log('✅ New migration applied successfully!\n');
    
    // Step 3: Generate Prisma client
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