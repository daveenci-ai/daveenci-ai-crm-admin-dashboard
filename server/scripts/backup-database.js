const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backupDatabase() {
  try {
    console.log('🔄 Starting database backup...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../backups');
    
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Export all contacts
    const contacts = await prisma.contact.findMany({
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
    });
    
    // Export all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    });
    
    // Export all touchpoints
    const touchpoints = await prisma.touchpoint.findMany();
    
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      description: 'Backup before contact fields migration',
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
    
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    
    console.log('✅ Database backup completed successfully!');
    console.log(`📁 Backup file: ${backupFile}`);
    console.log(`📊 Backed up: ${contacts.length} contacts, ${users.length} users, ${touchpoints.length} touchpoints`);
    
    return backupFile;
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run backup if called directly
if (require.main === module) {
  backupDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { backupDatabase }; 