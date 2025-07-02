const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function deployWithUserPreservation() {
  console.log('🚀 Starting nuclear database reset with user preservation...\n');
  
  let usersBackup = null;
  let emergencyBackupPath = null;
  
  try {
    // Step 1: Create emergency full backup first
    console.log('📋 Step 1: Creating emergency full backup...');
    emergencyBackupPath = await createEmergencyBackup();
    console.log(`✅ Emergency backup created: ${emergencyBackupPath}\n`);
    
    // Step 2: Back up users with passwords
    console.log('👥 Step 2: Backing up user credentials...');
    usersBackup = await backupUsers();
    console.log(`✅ Backed up ${usersBackup.length} users\n`);
    
    // Step 3: Nuclear database reset
    console.log('💥 Step 3: Performing nuclear database reset...');
    await nuclearReset();
    console.log('✅ Database reset completed\n');
    
    // Step 4: Generate Prisma client
    console.log('🔧 Step 4: Generating Prisma client...');
    await execAsync('npx prisma generate', { cwd: path.join(__dirname, '..') });
    console.log('✅ Prisma client generated\n');
    
    // Step 5: Restore users
    console.log('👥 Step 5: Restoring users...');
    await restoreUsers(usersBackup);
    console.log(`✅ Restored ${usersBackup.length} users\n`);
    
    // Step 6: Verify deployment
    console.log('🔍 Step 6: Verifying deployment...');
    await verifyDeployment(usersBackup.length);
    console.log('✅ Deployment verified\n');
    
    console.log('🎉 DEPLOYMENT SUCCESSFUL!');
    console.log('✅ Database reset completed');
    console.log('✅ Users preserved and restored');
    console.log('✅ All migrations applied from scratch');
    console.log(`📁 Emergency backup available at: ${emergencyBackupPath}`);
    
  } catch (error) {
    console.error('\n❌ DEPLOYMENT FAILED!');
    console.error('Error:', error.message);
    
    if (emergencyBackupPath) {
      console.log('\n🚨 EMERGENCY RECOVERY INSTRUCTIONS:');
      console.log('1. Your data is backed up at:', emergencyBackupPath);
      console.log('2. You can manually restore from this backup if needed');
      console.log('3. Contact support if you need help with recovery');
    }
    
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function createEmergencyBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../backups');
  
  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  try {
    // Get all data
    const [contacts, users, touchpoints] = await Promise.all([
      prisma.contact.findMany({
        include: {
          touchpoints: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.user.findMany(), // Include passwords for emergency restore
      prisma.touchpoint.findMany()
    ]);
    
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      description: 'Emergency backup before nuclear database reset',
      counts: {
        contacts: contacts.length,
        users: users.length,
        touchpoints: touchpoints.length
      },
      data: {
        users,
        contacts,
        touchpoints
      }
    };
    
    const backupFile = path.join(backupDir, `emergency-backup-${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    
    return backupFile;
  } catch (error) {
    console.error('Failed to create emergency backup:', error);
    throw new Error('Emergency backup failed - aborting deployment for safety');
  }
}

async function backupUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        password: true, // Include password hash for restoration
        createdAt: true
      }
    });
    
    if (users.length === 0) {
      throw new Error('No users found in database - cannot proceed with user preservation');
    }
    
    return users;
  } catch (error) {
    console.error('Failed to backup users:', error);
    throw error;
  }
}

async function nuclearReset() {
  try {
    console.log('⚠️  This will completely destroy and recreate the database...');
    
    // Run prisma migrate reset with force flag
    const { stdout, stderr } = await execAsync(
      'npx prisma migrate reset --force --skip-generate', 
      { 
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, FORCE: 'true' }
      }
    );
    
    if (stderr && !stderr.includes('warn')) {
      console.warn('Reset warnings:', stderr);
    }
    
    console.log('Database reset output:', stdout);
    return true;
  } catch (error) {
    console.error('Nuclear reset failed:', error);
    throw new Error(`Database reset failed: ${error.message}`);
  }
}

async function restoreUsers(usersBackup) {
  try {
    // Create new Prisma client instance after reset
    const newPrisma = new PrismaClient();
    
    // Restore each user
    for (const user of usersBackup) {
      await newPrisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          password: user.password, // Use existing password hash
          createdAt: user.createdAt
        }
      });
    }
    
    await newPrisma.$disconnect();
    return true;
  } catch (error) {
    console.error('Failed to restore users:', error);
    throw new Error(`User restoration failed: ${error.message}`);
  }
}

async function verifyDeployment(expectedUserCount) {
  try {
    // Create new Prisma client instance
    const verifyPrisma = new PrismaClient();
    
    // Check database tables exist and users were restored
    const userCount = await verifyPrisma.user.count();
    const contactCount = await verifyPrisma.contact.count();
    
    await verifyPrisma.$disconnect();
    
    if (userCount !== expectedUserCount) {
      throw new Error(`User count mismatch: expected ${expectedUserCount}, got ${userCount}`);
    }
    
    console.log(`✓ Database schema reset successfully`);
    console.log(`✓ ${userCount} users restored`);
    console.log(`✓ Contacts table ready (${contactCount} contacts)`);
    console.log(`✓ All migrations applied from scratch`);
    
    return true;
  } catch (error) {
    console.error('Deployment verification failed:', error);
    throw error;
  }
}

// Show usage instructions
function showUsage() {
  console.log(`
🚀 Nuclear Database Reset with User Preservation

This script will:
1. 📋 Create emergency backup of all data
2. 👥 Back up user credentials (name, email, password)
3. 💥 Completely destroy and recreate database
4. 🔧 Apply all migrations from scratch
5. 👥 Restore users with same login credentials
6. 🔍 Verify deployment success

⚠️  WARNING: This will delete ALL contacts and touchpoints!
✅ Only user accounts will be preserved.

Usage:
  npm run db:deploy-preserve
  
For production deployment:
  npm install && npm run db:deploy-preserve && npm run build
`);
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }
  
  deployWithUserPreservation()
    .then(() => {
      console.log('\n🎉 Ready for production deployment!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Deployment failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deployWithUserPreservation }; 