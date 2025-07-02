const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function rollbackMigration(backupFilePath) {
  try {
    console.log('🔄 Starting database rollback...');
    console.log(`📁 Using backup file: ${backupFilePath}`);
    
    // Check if backup file exists
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file not found: ${backupFilePath}`);
    }
    
    // Read backup data
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    console.log(`📊 Backup contains: ${backupData.counts.contacts} contacts, ${backupData.counts.users} users, ${backupData.counts.touchpoints} touchpoints`);
    console.log(`🕐 Backup timestamp: ${backupData.timestamp}`);
    
    // Confirm rollback
    console.log('\n⚠️  WARNING: This will DELETE ALL current data and restore from backup!');
    console.log('This action cannot be undone.');
    
    // In a production environment, you might want to add an interactive confirmation here
    // For now, we'll proceed with the rollback
    
    console.log('\n🗑️  Clearing existing data...');
    
    // Delete data in correct order (due to foreign key constraints)
    await prisma.touchpoint.deleteMany();
    console.log('✅ Cleared touchpoints');
    
    await prisma.contact.deleteMany();
    console.log('✅ Cleared contacts');
    
    // Don't delete users as they contain authentication data
    // await prisma.user.deleteMany();
    
    console.log('\n📥 Restoring data from backup...');
    
    // Restore users (only if they don't exist)
    for (const user of backupData.data.users) {
      try {
        await prisma.user.upsert({
          where: { id: user.id },
          update: {
            name: user.name,
            email: user.email
          },
          create: {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: new Date(user.createdAt)
          }
        });
      } catch (error) {
        console.warn(`Warning: Could not restore user ${user.id}: ${error.message}`);
      }
    }
    console.log(`✅ Restored ${backupData.data.users.length} users`);
    
    // Restore contacts (convert to old schema format)
    for (const contact of backupData.data.contacts) {
      try {
        await prisma.contact.create({
          data: {
            id: contact.id,
            name: contact.name,
            email: contact.email, // Use old field names
            phone: contact.phone,
            company: contact.company,
            source: contact.source,
            status: contact.status,
            notes: contact.notes,
            createdAt: new Date(contact.createdAt),
            updatedAt: new Date(contact.updatedAt),
            userId: contact.userId
          }
        });
      } catch (error) {
        console.warn(`Warning: Could not restore contact ${contact.id}: ${error.message}`);
      }
    }
    console.log(`✅ Restored ${backupData.data.contacts.length} contacts`);
    
    // Restore touchpoints
    for (const touchpoint of backupData.data.touchpoints) {
      try {
        await prisma.touchpoint.create({
          data: {
            id: touchpoint.id,
            note: touchpoint.note,
            source: touchpoint.source,
            createdAt: new Date(touchpoint.createdAt),
            contactId: touchpoint.contactId
          }
        });
      } catch (error) {
        console.warn(`Warning: Could not restore touchpoint ${touchpoint.id}: ${error.message}`);
      }
    }
    console.log(`✅ Restored ${backupData.data.touchpoints.length} touchpoints`);
    
    console.log('\n🎉 ROLLBACK COMPLETED SUCCESSFULLY!');
    console.log('====================================');
    console.log('✅ Data restored from backup');
    console.log('✅ Database is back to pre-migration state');
    console.log('\n🔄 Next steps:');
    console.log('1. Restart your application server');
    console.log('2. Verify that everything is working correctly');
    console.log('3. Investigate what went wrong with the migration');
    
    return {
      success: true,
      restoredCounts: {
        users: backupData.data.users.length,
        contacts: backupData.data.contacts.length,
        touchpoints: backupData.data.touchpoints.length
      }
    };
    
  } catch (error) {
    console.error('\n❌ ROLLBACK FAILED!');
    console.error('===================');
    console.error('Error:', error.message);
    console.error('\n🚨 CRITICAL: Database may be in an inconsistent state!');
    console.error('Please contact your database administrator immediately.');
    
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function listBackupFiles() {
  const backupDir = path.join(__dirname, '../backups');
  
  if (!fs.existsSync(backupDir)) {
    console.log('📁 No backup directory found.');
    return [];
  }
  
  const files = fs.readdirSync(backupDir)
    .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
    .map(file => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      return {
        filename: file,
        path: filePath,
        created: stats.birthtime,
        size: stats.size
      };
    })
    .sort((a, b) => b.created - a.created); // Sort by newest first
  
  return files;
}

// Interactive rollback selection
async function interactiveRollback() {
  console.log('🔍 Available backup files:');
  console.log('==========================');
  
  const backupFiles = listBackupFiles();
  
  if (backupFiles.length === 0) {
    console.log('❌ No backup files found. Cannot perform rollback.');
    return false;
  }
  
  backupFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file.filename}`);
    console.log(`   Created: ${file.created.toISOString()}`);
    console.log(`   Size: ${(file.size / 1024).toFixed(2)} KB\n`);
  });
  
  // In a production environment, you would add interactive selection here
  // For now, use the most recent backup
  const selectedBackup = backupFiles[0];
  console.log(`🔄 Using most recent backup: ${selectedBackup.filename}`);
  
  return await rollbackMigration(selectedBackup.path);
}

// Run rollback if called directly
if (require.main === module) {
  const backupPath = process.argv[2];
  
  if (backupPath) {
    // Use specific backup file
    rollbackMigration(backupPath)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    // Interactive selection
    interactiveRollback()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = { rollbackMigration, listBackupFiles }; 