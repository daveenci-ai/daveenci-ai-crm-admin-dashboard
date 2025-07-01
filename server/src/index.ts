import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Daveenci CRM API is running' });
});

// Get all contacts
app.get('/api/contacts', async (req, res) => {
  try {
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
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Get a single contact by ID
app.get('/api/contacts/:id', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { 
        touchpoints: {
          orderBy: { createdAt: 'desc' }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// Create a new contact
app.post('/api/contacts', async (req, res) => {
  try {
    const { name, email, phone, company, source, status, notes, userId } = req.body;
    
    // Basic validation
    if (!name || !email || !userId) {
      return res.status(400).json({ error: 'Name, email, and userId are required' });
    }
    
    const newContact = await prisma.contact.create({ 
      data: {
        name,
        email,
        phone,
        company,
        source,
        status: status || 'PROSPECT',
        notes,
        userId
      },
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
    
    res.status(201).json(newContact);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// Update a contact
app.put('/api/contacts/:id', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const { name, email, phone, company, source, status, notes } = req.body;
    
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        name,
        email,
        phone,
        company,
        source,
        status,
        notes
      },
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
    
    res.json(updatedContact);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Delete a contact
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    
    // Delete associated touchpoints first
    await prisma.touchpoint.deleteMany({
      where: { contactId }
    });
    
    // Then delete the contact
    await prisma.contact.delete({
      where: { id: contactId }
    });
    
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// Add a touchpoint to a contact
app.post('/api/contacts/:id/touchpoints', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const { note } = req.body;
    
    if (!note) {
      return res.status(400).json({ error: 'Note is required' });
    }
    
    const touchpoint = await prisma.touchpoint.create({
      data: {
        note,
        contactId
      }
    });
    
    res.status(201).json(touchpoint);
  } catch (error) {
    console.error('Error creating touchpoint:', error);
    res.status(500).json({ error: 'Failed to create touchpoint' });
  }
});

// Get all users (for demo purposes)
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a demo user (for testing)
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password // Note: In production, this should be hashed
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    });
    
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`🚀 Daveenci CRM server running on port ${port}`);
  console.log(`📊 API available at http://localhost:${port}/api`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
}); 