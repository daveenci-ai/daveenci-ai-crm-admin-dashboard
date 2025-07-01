import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Login from './Login';
import './App.css';

// Configure axios to send cookies
axios.defaults.withCredentials = true;

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
  source: 'MANUAL' | 'EMAIL' | 'SMS' | 'PHONE' | 'MEETING' | 'AUTO';
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
  // Authentication state
  const [user, setUser] = useState<{ id: number; email: string; name: string } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // App state
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
  const [touchpointSource, setTouchpointSource] = useState<'MANUAL' | 'EMAIL' | 'SMS' | 'PHONE' | 'MEETING' | 'AUTO'>('MANUAL');
  
  // Inline editing state
  const [editingField, setEditingField] = useState<{field: string, contactId: number} | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [originalContact, setOriginalContact] = useState<Contact | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/me`);
      setUser(response.data.user);
    } catch (err) {
      // User not authenticated, will show login
      setUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLoginSuccess = (userData: { id: number; email: string; name: string }) => {
    setUser(userData);
    setIsAuthLoading(false);
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`);
      setUser(null);
      setContacts([]);
      setSelectedContact(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const contactsRes = await axios.get(`${API_BASE_URL}/contacts`);
      setContacts(contactsRes.data);
    } catch (err) {
      setError('Failed to fetch data. Please try refreshing the page.');
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        userId: 1 // This field is ignored by backend now
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
        note: touchpointNote,
        source: touchpointSource
      });
      setTouchpointNote('');
      setTouchpointSource('MANUAL');
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

  // Inline editing functions
  const startEditing = (field: string, contactId: number, currentValue: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      setOriginalContact(contact);
      setEditingField({ field, contactId });
      setEditingValue(currentValue);
    }
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditingValue('');
    setOriginalContact(null);
  };

  const saveEdit = async () => {
    if (!editingField || !originalContact) return;

    try {
      const updatedData = {
        ...originalContact,
        [editingField.field]: editingValue
      };

      const response = await axios.put(`${API_BASE_URL}/contacts/${editingField.contactId}`, updatedData);
      
      // Update contacts list
      setContacts(contacts.map(c => 
        c.id === editingField.contactId ? response.data : c
      ));
      
      // Update selected contact if it's the one being edited
      if (selectedContact?.id === editingField.contactId) {
        setSelectedContact(response.data);
      }

      cancelEditing();
    } catch (err) {
      setError('Failed to update contact');
      console.error('Error updating contact:', err);
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

  const getTouchpointSourceIcon = (source: string) => {
    switch (source) {
      case 'MANUAL': return '✏️';
      case 'EMAIL': return '📧';
      case 'SMS': return '💬';
      case 'PHONE': return '📞';
      case 'MEETING': return '🤝';
      case 'AUTO': return '🤖';
      default: return '✏️';
    }
  };

  const getTouchpointSourceLabel = (source: string) => {
    switch (source) {
      case 'MANUAL': return 'Manual';
      case 'EMAIL': return 'Email';
      case 'SMS': return 'SMS';
      case 'PHONE': return 'Phone';
      case 'MEETING': return 'Meeting';
      case 'AUTO': return 'Auto';
      default: return 'Manual';
    }
  };

  // Show loading while checking authentication
  if (isAuthLoading) {
    return (
      <div className="app-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading Daveenci CRM...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Show app loading while fetching data
  if (isLoading) {
    return (
      <div className="app-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading your contacts...</p>
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
            <p>Welcome back, {user.name}!</p>
          </div>
          <div className="header-actions">
            <button 
              className="create-btn"
              onClick={() => setShowCreateForm(true)}
            >
              + Add Contact
            </button>
            <button 
              className="logout-btn"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
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
                    <label>Name:</label>
                    {editingField?.field === 'name' && editingField?.contactId === selectedContact.id ? (
                      <div className="edit-field">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                        />
                        <div className="edit-buttons">
                          <button onClick={saveEdit}>Save</button>
                          <button onClick={cancelEditing}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="editable-field"
                        onDoubleClick={() => startEditing('name', selectedContact.id, selectedContact.name)}
                      >
                        {selectedContact.name}
                      </span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Email:</label>
                    {editingField?.field === 'email' && editingField?.contactId === selectedContact.id ? (
                      <div className="edit-field">
                        <input
                          type="email"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                        />
                        <div className="edit-buttons">
                          <button onClick={saveEdit}>Save</button>
                          <button onClick={cancelEditing}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="editable-field"
                        onDoubleClick={() => startEditing('email', selectedContact.id, selectedContact.email)}
                      >
                        {selectedContact.email}
                      </span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Phone:</label>
                    {editingField?.field === 'phone' && editingField?.contactId === selectedContact.id ? (
                      <div className="edit-field">
                        <input
                          type="tel"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                        />
                        <div className="edit-buttons">
                          <button onClick={saveEdit}>Save</button>
                          <button onClick={cancelEditing}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="editable-field"
                        onDoubleClick={() => startEditing('phone', selectedContact.id, selectedContact.phone || '')}
                      >
                        {selectedContact.phone || 'Add phone'}
                      </span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Company:</label>
                    {editingField?.field === 'company' && editingField?.contactId === selectedContact.id ? (
                      <div className="edit-field">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                        />
                        <div className="edit-buttons">
                          <button onClick={saveEdit}>Save</button>
                          <button onClick={cancelEditing}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="editable-field"
                        onDoubleClick={() => startEditing('company', selectedContact.id, selectedContact.company || '')}
                      >
                        {selectedContact.company || 'Add company'}
                      </span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Source:</label>
                    {editingField?.field === 'source' && editingField?.contactId === selectedContact.id ? (
                      <div className="edit-field">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                        />
                        <div className="edit-buttons">
                          <button onClick={saveEdit}>Save</button>
                          <button onClick={cancelEditing}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="editable-field"
                        onDoubleClick={() => startEditing('source', selectedContact.id, selectedContact.source || '')}
                      >
                        {selectedContact.source || 'Add source'}
                      </span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Status:</label>
                    {editingField?.field === 'status' && editingField?.contactId === selectedContact.id ? (
                      <div className="edit-field">
                        <select
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                        >
                          <option value="PROSPECT">Prospect</option>
                          <option value="LEAD">Lead</option>
                          <option value="OPPORTUNITY">Opportunity</option>
                          <option value="CLIENT">Client</option>
                        </select>
                        <div className="edit-buttons">
                          <button onClick={saveEdit}>Save</button>
                          <button onClick={cancelEditing}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <span 
                        className="status-badge editable-field"
                        style={{ backgroundColor: getStatusColor(selectedContact.status) }}
                        onDoubleClick={() => startEditing('status', selectedContact.id, selectedContact.status)}
                      >
                        {selectedContact.status}
                      </span>
                    )}
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
                  <div className="touchpoint-source-selector">
                    <label>Source:</label>
                    <select
                      value={touchpointSource}
                      onChange={(e) => setTouchpointSource(e.target.value as any)}
                    >
                      <option value="MANUAL">✏️ Manual</option>
                      <option value="EMAIL">📧 Email</option>
                      <option value="SMS">💬 SMS</option>
                      <option value="PHONE">📞 Phone</option>
                      <option value="MEETING">🤝 Meeting</option>
                      <option value="AUTO">🤖 Auto</option>
                    </select>
                  </div>
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
                      <div className="touchpoint-header">
                        <div className="touchpoint-source">
                          <span className="source-icon">{getTouchpointSourceIcon(touchpoint.source)}</span>
                          <span className="source-label">{getTouchpointSourceLabel(touchpoint.source)}</span>
                        </div>
                        <span className="touchpoint-date">
                          {formatDate(touchpoint.createdAt)}
                        </span>
                      </div>
                      <p className="touchpoint-note">{touchpoint.note}</p>
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
