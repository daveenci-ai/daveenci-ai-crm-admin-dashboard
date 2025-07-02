const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function superNuclearReset() {
  console.log('💀 SUPER NUCLEAR RESET - Bypassing migration system entirely...\n');
  
  let usersBackup = null;
  let emergencyBackupPath = null;
  
  try {
    // Step 1: Try to back up users if possible
    console.log('👥 Step 1: Attempting to back up users...');
    try {
      const prisma = new PrismaClient();
      usersBackup = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          createdAt: true
        }
      });
      await prisma.$disconnect();
      console.log(`✅ Backed up ${usersBackup.length} users\n`);
    } catch (error) {
      console.log('⚠️  Could not back up users - database too corrupted');
      console.log('⚠️  Proceeding with schema reset...\n');
    }
    
    // Step 2: Complete schema destruction and recreation
    console.log('💥 Step 2: Destroying and recreating schema...');
    await destroyAndRecreateSchema();
    console.log('✅ Schema reset completed\n');
    
    // Step 3: Apply schema directly (bypass migrations)
    console.log('🔧 Step 3: Applying schema directly...');
    await applySchemaDirectly();
    console.log('✅ Schema applied successfully\n');
    
    // Step 4: Generate Prisma client
    console.log('🛠️  Step 4: Generating Prisma client...');
    await execAsync('npx prisma generate', { cwd: path.join(__dirname, '..') });
    console.log('✅ Prisma client generated\n');
    
    // Step 5: Create default user if none existed
    console.log('👤 Step 5: Setting up users...');
    if (usersBackup && usersBackup.length > 0) {
      await restoreUsers(usersBackup);
      console.log(`✅ Restored ${usersBackup.length} users\n`);
    } else {
      await createDefaultUser();
      console.log('✅ Created default user\n');
    }
    
    // Step 6: Verify everything works
    console.log('🔍 Step 6: Verifying deployment...');
    await verifyDeployment();
    console.log('✅ Deployment verified\n');
    
    console.log('🎉 SUPER NUCLEAR RESET SUCCESSFUL!');
    console.log('✅ Database completely rebuilt from schema');
    console.log('✅ All migration issues bypassed');
    console.log('✅ Users restored or default user created');
    
  } catch (error) {
    console.error('\n❌ SUPER NUCLEAR RESET FAILED!');
    console.error('Error:', error.message);
    throw error;
  }
}

async function destroyAndRecreateSchema() {
  try {
    console.log('⚠️  Completely destroying database schema...');
    
    // Drop all tables, types, and sequences
    const destroyScript = `
      -- Drop all tables if they exist (correct lowercase table names)
      DROP TABLE IF EXISTS "touchpoints" CASCADE;
      DROP TABLE IF EXISTS "contacts" CASCADE;
      DROP TABLE IF EXISTS "users" CASCADE;
      DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;
      
      -- Drop all custom types if they exist
      DROP TYPE IF EXISTS "status" CASCADE;
      DROP TYPE IF EXISTS "touchpoint_source" CASCADE;
      
      -- Drop all sequences if they exist
      DROP SEQUENCE IF EXISTS "contacts_id_seq" CASCADE;
      DROP SEQUENCE IF EXISTS "users_id_seq" CASCADE;
      DROP SEQUENCE IF EXISTS "touchpoints_id_seq" CASCADE;
    `;
    
    // Execute raw SQL to destroy everything
    const prisma = new PrismaClient();
    await prisma.$executeRawUnsafe(destroyScript);
    await prisma.$disconnect();
    
    console.log('✅ Schema completely destroyed');
    return true;
  } catch (error) {
    console.warn('⚠️  Some destruction commands failed (this might be OK if tables didn\'t exist)');
    console.warn('Error:', error.message);
    return true; // Continue anyway
  }
}

async function applySchemaDirectly() {
  try {
    console.log('🔧 Applying schema directly with db push...');
    
    // Use db push to apply schema directly, bypassing migrations
    const { stdout, stderr } = await execAsync(
      'npx prisma db push --force-reset --accept-data-loss', 
      { cwd: path.join(__dirname, '..') }
    );
    
    if (stderr && !stderr.includes('warn')) {
      console.warn('Schema push warnings:', stderr);
    }
    
    console.log('Schema push output:', stdout);
    return true;
  } catch (error) {
    console.error('Schema push failed:', error);
    throw new Error(`Schema application failed: ${error.message}`);
  }
}

async function restoreUsers(usersBackup) {
  try {
    const prisma = new PrismaClient();
    
    for (const user of usersBackup) {
      await prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          password: user.password,
          createdAt: user.createdAt
        }
      });
    }
    
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error('Failed to restore users:', error);
    throw new Error(`User restoration failed: ${error.message}`);
  }
}

async function createDefaultUser() {
  try {
    const bcrypt = require('bcrypt');
    const prisma = new PrismaClient();
    
    // Create a default user
    const defaultPassword = await bcrypt.hash('admin123', 10);
    
    await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@daveenci.com',
        password: defaultPassword,
        createdAt: new Date()
      }
    });
    
    await prisma.$disconnect();
    
    console.log('📧 Default user created:');
    console.log('   Email: admin@daveenci.com');
    console.log('   Password: admin123');
    console.log('   ⚠️  Please change this password after logging in!');
    
    return true;
  } catch (error) {
    console.error('Failed to create default user:', error);
    throw new Error(`Default user creation failed: ${error.message}`);
  }
}

async function verifyDeployment() {
  try {
    const prisma = new PrismaClient();
    
    // Check that all tables exist and are accessible
    const userCount = await prisma.user.count();
    const contactCount = await prisma.contact.count();
    const touchpointCount = await prisma.touchpoint.count();
    
    await prisma.$disconnect();
    
    console.log(`✓ Database schema applied successfully`);
    console.log(`✓ Users table: ${userCount} users`);
    console.log(`✓ Contacts table: ${contactCount} contacts`);
    console.log(`✓ Touchpoints table: ${touchpointCount} touchpoints`);
    console.log(`✓ All tables accessible and functional`);
    
    return true;
  } catch (error) {
    console.error('Deployment verification failed:', error);
    throw error;
  }
}

// Show usage instructions
function showUsage() {
  console.log(`
💀 SUPER NUCLEAR DATABASE RESET

This script completely bypasses the migration system and:
1. 💥 Destroys ALL database schema (tables, types, sequences)
2. 👥 Backs up users if possible (or creates default user)
3. 🔧 Applies schema directly using 'prisma db push'
4. 👤 Restores users or creates default admin user
5. 🔍 Verifies everything works

⚠️  WARNING: This WILL delete ALL data!
✅ Use when migration system is completely broken.

Usage:
  npm run db:super-nuclear
  
For production deployment:
  npm install && npm run db:super-nuclear && npm run build

Default User (if no users can be backed up):
  Email: admin@daveenci.com
  Password: admin123
`);
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }
  
  superNuclearReset()
    .then(() => {
      console.log('\n🎉 Ready for production deployment!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Super nuclear reset failed:', error.message);
      process.exit(1);
    });
}

module.exports = { superNuclearReset }; 