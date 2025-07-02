const { exec } = require('child_process');
const { promisify } = require('util');
const { backupDatabase } = require('./backup-database');
const { verifyMigration } = require('./verify-migration');

const execAsync = promisify(exec);

async function runMigration() {
  console.log('🚀 Starting comprehensive database migration...');
  console.log('=============================================\n');
  
  try {
    // Step 1: Create backup
    console.log('STEP 1: Creating database backup');
    console.log('---------------------------------');
    const backupFile = await backupDatabase();
    console.log(`✅ Backup completed: ${backupFile}\n`);
    
    // Step 2: Run Prisma migration
    console.log('STEP 2: Running Prisma database migration');
    console.log('------------------------------------------');
    console.log('🔄 Applying migration...');
    
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy');
    
    if (stderr && !stderr.includes('warning')) {
      throw new Error(`Migration failed: ${stderr}`);
    }
    
    console.log('Migration output:', stdout);
    console.log('✅ Database migration completed successfully!\n');
    
    // Step 3: Regenerate Prisma client
    console.log('STEP 3: Regenerating Prisma client');
    console.log('-----------------------------------');
    await execAsync('npx prisma generate');
    console.log('✅ Prisma client regenerated successfully!\n');
    
    // Step 4: Verify migration
    console.log('STEP 4: Verifying migration integrity');
    console.log('-------------------------------------');
    const verificationResult = await verifyMigration();
    
    if (!verificationResult.success) {
      throw new Error('Migration verification failed! Check the errors above.');
    }
    
    console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('=====================================');
    console.log('✅ Database backup created');
    console.log('✅ Migration applied');
    console.log('✅ Prisma client updated');
    console.log('✅ Data integrity verified');
    console.log('\n🔄 Next steps:');
    console.log('1. Restart your application server');
    console.log('2. Test the new contact form');
    console.log('3. Verify frontend functionality');
    
    return {
      success: true,
      backupFile,
      verificationResult
    };
    
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED!');
    console.error('====================');
    console.error('Error:', error.message);
    console.error('\n🔧 Recovery steps:');
    console.error('1. Check the error message above');
    console.error('2. Review your database connection');
    console.error('3. Restore from backup if needed');
    console.error('4. Contact your database administrator');
    
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✅ Migration process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration process failed!');
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = { runMigration }; 