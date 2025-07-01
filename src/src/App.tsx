import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

interface Contact {
  id: number;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  source?: string;
  status: 'PROSPECT' | 'LEAD' | 'OPPORTUNITY' | 'CLIENT';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  touchpoints: Touchpoint[];
  user: {
    id: number;
    name: string;
    email: string;
  };
}

interface Touchpoint {
  id: number;
  note: string;
  createdAt: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

const API_BASE_URL = 'https://daveenci-ai-crm-admin-dashboard.onrender.com/api';

function App() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Form state for creating/editing contacts
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: '',
    status: 'PROSPECT' as const,
    notes: '',
    userId: 1 // Will be updated when users are loaded
  });

  const [touchpointNote, setTouchpointNote] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [contactsRes, usersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/contacts`),
        axios.get(`${API_BASE_URL}/users`)
      ]);
      setContacts(contactsRes.data);
      setUsers(usersRes.data);
      
      // Update form userId to first available user
      if (usersRes.data.length > 0) {
        setFormData(prev => ({ ...prev, userId: usersRes.data[0].id }));
      }
    } catch (err) {
      setError('Failed to fetch data. Make sure the backend server is running.');
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure we have a valid user
    if (users.length === 0) {
      setError('No users available. Please create a user first.');
      return;
    }
    
    try {
      const response = await axios.post(`${API_BASE_URL}/contacts`, formData);
      setContacts([response.data, ...contacts]);
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        source: '',
        status: 'PROSPECT',
        notes: '',
        userId: users.length > 0 ? users[0].id : 1
      });
      setShowCreateForm(false);
    } catch (err) {
      setError('Failed to create contact');
      console.error('Error creating contact:', err);
    }
  };

  const addTouchpoint = async (contactId: number) => {
    if (!touchpointNote.trim()) return;
    
    try {
      await axios.post(`${API_BASE_URL}/contacts/${contactId}/touchpoints`, {
        note: touchpointNote
      });
      setTouchpointNote('');
      fetchData(); // Refresh data to get updated touchpoints
    } catch (err) {
      setError('Failed to add touchpoint');
      console.error('Error adding touchpoint:', err);
    }
  };

  const deleteContact = async (contactId: number) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/contacts/${contactId}`);
      setContacts(contacts.filter(c => c.id !== contactId));
      setSelectedContact(null);
    } catch (err) {
      setError('Failed to delete contact');
      console.error('Error deleting contact:', err);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (contact.company && contact.company.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || contact.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROSPECT': return '#6B7280';
      case 'LEAD': return '#F59E0B';
      case 'OPPORTUNITY': return '#3B82F6';
      case 'CLIENT': return '#10B981';
      default: return '#6B7280';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading Daveenci CRM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <h1>🚀 Daveenci CRM</h1>
            <p>Manage your contacts and grow your business</p>
          </div>
          <button 
            className="create-btn"
            onClick={() => setShowCreateForm(true)}
          >
            + Add Contact
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <main className="main-content">
        <div className="contacts-panel">
          <div className="panel-header">
            <h2>Contacts ({filteredContacts.length})</h2>
            <div className="controls">
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Status</option>
                <option value="PROSPECT">Prospects</option>
                <option value="LEAD">Leads</option>
                <option value="OPPORTUNITY">Opportunities</option>
                <option value="CLIENT">Clients</option>
              </select>
            </div>
          </div>

          <div className="contacts-list">
            {filteredContacts.length === 0 ? (
              <div className="empty-state">
                <p>No contacts found</p>
                <button onClick={() => setShowCreateForm(true)}>
                  Create your first contact
                </button>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`contact-card ${selectedContact?.id === contact.id ? 'selected' : ''}`}
                  onClick={() => setSelectedContact(contact)}
                >
                  <div className="contact-header">
                    <h3>{contact.name}</h3>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(contact.status) }}
                    >
                      {contact.status}
                    </span>
                  </div>
                  <p className="contact-email">{contact.email}</p>
                  {contact.company && <p className="contact-company">{contact.company}</p>}
                  <div className="contact-meta">
                    <span>{contact.touchpoints.length} touchpoints</span>
                    <span>{formatDate(contact.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="details-panel">
          {selectedContact ? (
            <div className="contact-details">
              <div className="details-header">
                <h2>{selectedContact.name}</h2>
                <button 
                  className="delete-btn"
                  onClick={() => deleteContact(selectedContact.id)}
                >
                  Delete
                </button>
              </div>

              <div className="contact-info">
                <div className="info-grid">
                  <div className="info-item">
                    <label>Email:</label>
                    <span>{selectedContact.email}</span>
                  </div>
                  {selectedContact.phone && (
                    <div className="info-item">
                      <label>Phone:</label>
                      <span>{selectedContact.phone}</span>
                    </div>
                  )}
                  {selectedContact.company && (
                    <div className="info-item">
                      <label>Company:</label>
                      <span>{selectedContact.company}</span>
                    </div>
                  )}
                  {selectedContact.source && (
                    <div className="info-item">
                      <label>Source:</label>
                      <span>{selectedContact.source}</span>
                    </div>
                  )}
                  <div className="info-item">
                    <label>Status:</label>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(selectedContact.status) }}
                    >
                      {selectedContact.status}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Owner:</label>
                    <span>{selectedContact.user.name}</span>
                  </div>
                </div>
                
                {selectedContact.notes && (
                  <div className="notes-section">
                    <label>Notes:</label>
                    <p>{selectedContact.notes}</p>
                  </div>
                )}
              </div>

              <div className="touchpoints-section">
                <h3>Touchpoints ({selectedContact.touchpoints.length})</h3>
                
                <div className="add-touchpoint">
                  <textarea
                    placeholder="Add a new touchpoint..."
                    value={touchpointNote}
                    onChange={(e) => setTouchpointNote(e.target.value)}
                    rows={3}
                  />
                  <button 
                    onClick={() => addTouchpoint(selectedContact.id)}
                    disabled={!touchpointNote.trim()}
                  >
                    Add Touchpoint
                  </button>
                </div>

                <div className="touchpoints-list">
                  {selectedContact.touchpoints.map((touchpoint) => (
                    <div key={touchpoint.id} className="touchpoint-item">
                      <p>{touchpoint.note}</p>
                      <span className="touchpoint-date">
                        {formatDate(touchpoint.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <h2>Select a contact</h2>
              <p>Choose a contact from the list to view details and manage touchpoints</p>
            </div>
          )}
        </div>
      </main>

      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Create New Contact</h2>
              <button onClick={() => setShowCreateForm(false)}>✕</button>
            </div>
            <form onSubmit={createContact}>
              <div className="form-grid">
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <input
                  type="email"
                  placeholder="Email Address *"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Source"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                />
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="PROSPECT">Prospect</option>
                  <option value="LEAD">Lead</option>
                  <option value="OPPORTUNITY">Opportunity</option>
                  <option value="CLIENT">Client</option>
                </select>
                {users.length > 0 && (
                  <select
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: parseInt(e.target.value) })}
                  >
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <textarea
                placeholder="Notes (optional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
              <div className="form-actions">
                <button type="button" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </button>
                <button type="submit">Create Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
