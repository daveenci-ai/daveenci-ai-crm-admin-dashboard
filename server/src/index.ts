import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth';
import { requireAuth, AuthenticatedRequest } from './middleware/requireAuth';

dotenv.config();
const prisma = new PrismaClient();
const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://crm.daveenci.ai', // For future use
        'https://daveenci-ai-crm-admin-dashboard-4uq0.onrender.com' // Current frontend
      ] 
    : ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Auth routes (unprotected)
app.use('/api/auth', authRoutes);

// Seed user endpoint (for production setup)
app.post('/api/seed-user', async (req, res) => {
  try {
    const bcrypt = require('bcrypt');
    const password = await bcrypt.hash('secret123', 10);

    const user = await prisma.user.upsert({
      where: { email: 'anton@daveenci.ai' },
      update: {},
      create: {
        email: 'anton@daveenci.ai',
        name: 'Anton Osipov',
        password,
      },
    });

    res.json({ message: 'User seeded successfully', user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Seed user error:', error);
    res.status(500).json({ error: 'Failed to seed user' });
  }
});

// Root endpoint - API info
app.get('/', (req, res) => {
  res.json({ 
    name: 'Daveenci CRM API',
    version: '1.0.0',
    status: 'OK',
    endpoints: {
      health: '/api/health',
      contacts: '/api/contacts',
      users: '/api/users',
      docs: 'https://github.com/daveenci-ai/daveenci-ai-crm-admin-dashboard'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Daveenci CRM API is running' });
});

// Get all contacts (protected)
app.get('/api/contacts', requireAuth, async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      include: {
        touchpoints: {
          orderBy: {
            createdAt: 'desc'
          }
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
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Get a single contact by ID (protected)
app.get('/api/contacts/:id', requireAuth, async (req, res) => {
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

// Create a new contact (protected)
app.post('/api/contacts', requireAuth, async (req, res) => {
  try {
    const { 
      name, 
      primaryEmail, 
      secondaryEmail, 
      primaryPhone, 
      secondaryPhone, 
      company, 
      industry,
      website,
      address,
      source, 
      status, 
      notes,
      // Legacy support for old field names
      email,
      phone
    } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;
    
    // Basic validation - support both old and new field names
    const emailToUse = primaryEmail || email;
    if (!name || !emailToUse) {
      return res.status(400).json({ error: 'Name and primary email are required' });
    }
    
    const newContact = await prisma.contact.create({ 
      data: {
        name,
        primaryEmail: emailToUse,
        secondaryEmail,
        primaryPhone: primaryPhone || phone,
        secondaryPhone,
        company,
        industry,
        website,
        address,
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

// Update a contact (protected)
app.put('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const { 
      name, 
      primaryEmail, 
      secondaryEmail, 
      primaryPhone, 
      secondaryPhone, 
      company, 
      industry,
      website,
      address,
      source, 
      status, 
      notes,
      // Legacy support for old field names
      email,
      phone
    } = req.body;
    
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        name,
        primaryEmail: primaryEmail || email,
        secondaryEmail,
        primaryPhone: primaryPhone || phone,
        secondaryPhone,
        company,
        industry,
        website,
        address,
        source,
        status,
        notes
      },
      include: {
        touchpoints: {
          orderBy: {
            createdAt: 'desc'
          }
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
    
    res.json(updatedContact);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Delete a contact (protected)
app.delete('/api/contacts/:id', requireAuth, async (req, res) => {
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

// Add a touchpoint to a contact (protected)
app.post('/api/contacts/:id/touchpoints', requireAuth, async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const { note, source = 'MANUAL' } = req.body;
    
    if (!note) {
      return res.status(400).json({ error: 'Note is required' });
    }
    
    const touchpoint = await prisma.touchpoint.create({
      data: {
        note,
        source,
        contactId
      }
    });
    
    res.status(201).json(touchpoint);
  } catch (error) {
    console.error('Error creating touchpoint:', error);
    res.status(500).json({ error: 'Failed to create touchpoint' });
  }
});

// Delete a touchpoint (protected)
app.delete('/api/touchpoints/:id', requireAuth, async (req, res) => {
  try {
    const touchpointId = parseInt(req.params.id);
    
    // Verify the touchpoint exists
    const touchpoint = await prisma.touchpoint.findUnique({
      where: { id: touchpointId }
    });
    
    if (!touchpoint) {
      return res.status(404).json({ error: 'Touchpoint not found' });
    }
    
    await prisma.touchpoint.delete({
      where: { id: touchpointId }
    });
    
    res.json({ message: 'Touchpoint deleted successfully' });
  } catch (error) {
    console.error('Error deleting touchpoint:', error);
    res.status(500).json({ error: 'Failed to delete touchpoint' });
  }
});

// Get recent touchpoints (protected) - for activity feed
app.get('/api/touchpoints/recent', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    const recentTouchpoints = await prisma.touchpoint.findMany({
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            primaryEmail: true,
            company: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
    
    res.json(recentTouchpoints);
  } catch (error) {
    console.error('Error fetching recent touchpoints:', error);
    res.status(500).json({ error: 'Failed to fetch recent touchpoints' });
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