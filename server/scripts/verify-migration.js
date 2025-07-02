const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyMigration() {
  try {
    console.log('🔍 Starting migration verification...');
    
    // Get all contacts to verify data integrity
    const contacts = await prisma.contact.findMany({
      include: {
        touchpoints: true
      }
    });
    
    console.log(`📊 Total contacts found: ${contacts.length}`);
    
    const results = {
      totalContacts: contacts.length,
      contactsWithPrimaryEmail: 0,
      contactsWithSecondaryEmail: 0,
      contactsWithPrimaryPhone: 0,
      contactsWithSecondaryPhone: 0,
      contactsWithIndustry: 0,
      contactsWithWebsite: 0,
      contactsWithAddress: 0,
      contactsWithLegacyEmailField: 0,
      contactsWithLegacyPhoneField: 0,
      errors: []
    };
    
    // Verify each contact
    for (const contact of contacts) {
      // Check primary email (should never be null/empty after migration)
      if (!contact.primaryEmail) {
        results.errors.push({
          contactId: contact.id,
          contactName: contact.name,
          error: 'Missing primary email'
        });
      } else {
        results.contactsWithPrimaryEmail++;
      }
      
      // Count optional fields
      if (contact.secondaryEmail) results.contactsWithSecondaryEmail++;
      if (contact.primaryPhone) results.contactsWithPrimaryPhone++;
      if (contact.secondaryPhone) results.contactsWithSecondaryPhone++;
      if (contact.industry) results.contactsWithIndustry++;
      if (contact.website) results.contactsWithWebsite++;
      if (contact.address) results.contactsWithAddress++;
      
      // Check for legacy fields (should still exist for compatibility)
      if (contact.email) results.contactsWithLegacyEmailField++;
      if (contact.phone) results.contactsWithLegacyPhoneField++;
      
      // Validate email format
      if (contact.primaryEmail && !isValidEmail(contact.primaryEmail)) {
        results.errors.push({
          contactId: contact.id,
          contactName: contact.name,
          error: `Invalid primary email format: ${contact.primaryEmail}`
        });
      }
      
      if (contact.secondaryEmail && !isValidEmail(contact.secondaryEmail)) {
        results.errors.push({
          contactId: contact.id,
          contactName: contact.name,
          error: `Invalid secondary email format: ${contact.secondaryEmail}`
        });
      }
      
      // Validate website URL format
      if (contact.website && !isValidURL(contact.website)) {
        results.errors.push({
          contactId: contact.id,
          contactName: contact.name,
          error: `Invalid website URL format: ${contact.website}`
        });
      }
    }
    
    // Calculate percentages
    const percentages = {
      withSecondaryEmail: ((results.contactsWithSecondaryEmail / results.totalContacts) * 100).toFixed(1),
      withPrimaryPhone: ((results.contactsWithPrimaryPhone / results.totalContacts) * 100).toFixed(1),
      withSecondaryPhone: ((results.contactsWithSecondaryPhone / results.totalContacts) * 100).toFixed(1),
      withIndustry: ((results.contactsWithIndustry / results.totalContacts) * 100).toFixed(1),
      withWebsite: ((results.contactsWithWebsite / results.totalContacts) * 100).toFixed(1),
      withAddress: ((results.contactsWithAddress / results.totalContacts) * 100).toFixed(1)
    };
    
    // Print verification results
    console.log('\n📋 MIGRATION VERIFICATION RESULTS');
    console.log('=====================================');
    console.log(`✅ Total contacts: ${results.totalContacts}`);
    console.log(`✅ Contacts with primary email: ${results.contactsWithPrimaryEmail} (100%)`);
    console.log(`📧 Contacts with secondary email: ${results.contactsWithSecondaryEmail} (${percentages.withSecondaryEmail}%)`);
    console.log(`📱 Contacts with primary phone: ${results.contactsWithPrimaryPhone} (${percentages.withPrimaryPhone}%)`);
    console.log(`📱 Contacts with secondary phone: ${results.contactsWithSecondaryPhone} (${percentages.withSecondaryPhone}%)`);
    console.log(`🏢 Contacts with industry: ${results.contactsWithIndustry} (${percentages.withIndustry}%)`);
    console.log(`🌐 Contacts with website: ${results.contactsWithWebsite} (${percentages.withWebsite}%)`);
    console.log(`📍 Contacts with address: ${results.contactsWithAddress} (${percentages.withAddress}%)`);
    
    if (results.errors.length > 0) {
      console.log(`\n❌ ERRORS FOUND: ${results.errors.length}`);
      console.log('===================');
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. Contact ID ${error.contactId} (${error.contactName}): ${error.error}`);
      });
    } else {
      console.log('\n✅ No data integrity errors found!');
    }
    
    // Check legacy field migration success
    console.log('\n🔄 LEGACY FIELD MIGRATION CHECK');
    console.log('===============================');
    console.log(`📧 Contacts still with legacy email field: ${results.contactsWithLegacyEmailField}`);
    console.log(`📱 Contacts still with legacy phone field: ${results.contactsWithLegacyPhoneField}`);
    
    const isSuccess = results.errors.length === 0 && 
                     results.contactsWithPrimaryEmail === results.totalContacts;
    
    if (isSuccess) {
      console.log('\n🎉 MIGRATION VERIFICATION PASSED!');
      console.log('All contacts have been successfully migrated.');
    } else {
      console.log('\n⚠️  MIGRATION VERIFICATION FAILED!');
      console.log('Please review the errors above and fix any issues.');
    }
    
    return {
      success: isSuccess,
      results,
      percentages
    };
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyMigration()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(() => process.exit(1));
}

module.exports = { verifyMigration }; 