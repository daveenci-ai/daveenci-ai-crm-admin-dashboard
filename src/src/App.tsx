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
  source: 'MANUAL' | 'EMAIL' | 'SMS' | 'PHONE' | 'IN_PERSON' | 'EVENT' | 'OTHER';
  createdAt: string;
}

interface RecentTouchpoint {
  id: number;
  note: string;
  source: 'MANUAL' | 'EMAIL' | 'SMS' | 'PHONE' | 'IN_PERSON' | 'EVENT' | 'OTHER';
  createdAt: string;
  contact: {
    id: number;
    name: string;
    email: string;
    company?: string;
    status: 'PROSPECT' | 'LEAD' | 'OPPORTUNITY' | 'CLIENT';
  };
}

const API_BASE_URL = 'https://daveenci-ai-crm-admin-dashboard.onrender.com/api';

type ViewType = 'dashboard' | 'leads' | 'add-lead';

function App() {
  // Authentication state
  const [user, setUser] = useState<{ id: number; email: string; name: string } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // App state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recentTouchpoints, setRecentTouchpoints] = useState<RecentTouchpoint[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All Status');
  const [sourceFilter, setSourceFilter] = useState<string>('All Sources');

  // Form state for creating contacts
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: '',
    status: 'PROSPECT' as const,
    notes: ''
  });

  useEffect(() => {
    // Check for stored auth token on app load
    const token = localStorage.getItem('authToken');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (user) {
      fetchContacts();
      fetchRecentTouchpoints();
    }
  }, [user]);

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/me`);
      setUser(response.data.user);
    } catch (err) {
      localStorage.removeItem('authToken');
      delete axios.defaults.headers.common['Authorization'];
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
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('authToken');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setContacts([]);
      setRecentTouchpoints([]);
    }
  };

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/contacts`);
      setContacts(response.data);
    } catch (err) {
      setError('Failed to fetch data. Please try refreshing the page.');
      console.error('Error fetching contacts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentTouchpoints = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/touchpoints/recent?limit=10`);
      setRecentTouchpoints(response.data);
    } catch (err) {
      console.error('Error fetching recent touchpoints:', err);
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
        notes: ''
      });
      setCurrentView('leads');
    } catch (err) {
      setError('Failed to create contact');
      console.error('Error creating contact:', err);
    }
  };

  const deleteContact = async (contactId: number) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/contacts/${contactId}`);
      setContacts(contacts.filter(c => c.id !== contactId));
    } catch (err) {
      setError('Failed to delete contact');
      console.error('Error deleting contact:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROSPECT': return '#6366f1'; // Indigo
      case 'LEAD': return '#f59e0b'; // Amber
      case 'OPPORTUNITY': return '#10b981'; // Emerald
      case 'CLIENT': return '#8b5cf6'; // Violet
      default: return '#6b7280'; // Gray
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PROSPECT': return 'New';
      case 'LEAD': return 'Contacted';
      case 'OPPORTUNITY': return 'Qualified';
      case 'CLIENT': return 'Converted';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatActivityTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' • ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTouchpointIcon = (source: string) => {
    switch (source) {
      case 'EMAIL': return '📧';
      case 'SMS': return '💬';
      case 'PHONE': return '📞';
      case 'IN_PERSON': return '🤝';
      case 'EVENT': return '📅';
      case 'MANUAL': return '✏️';
      case 'OTHER': return '📋';
      default: return '✏️';
    }
  };

  const getTouchpointIconColor = (source: string) => {
    switch (source) {
      case 'EMAIL': return '#3b82f6'; // Blue
      case 'SMS': return '#10b981'; // Green
      case 'PHONE': return '#f59e0b'; // Amber
      case 'IN_PERSON': return '#8b5cf6'; // Purple
      case 'EVENT': return '#ef4444'; // Red
      case 'MANUAL': return '#6b7280'; // Gray
      case 'OTHER': return '#06b6d4'; // Cyan
      default: return '#6b7280';
    }
  };

  const getActivityTitle = (touchpoint: RecentTouchpoint) => {
    const contactName = touchpoint.contact.name;
    const company = touchpoint.contact.company;
    
    switch (touchpoint.source) {
      case 'EMAIL':
        return `Email sent to ${contactName}`;
      case 'SMS':
        return `SMS sent to ${contactName}`;
      case 'PHONE':
        return `Phone call with ${contactName}`;
      case 'IN_PERSON':
        return `In-person meeting with ${contactName}`;
      case 'EVENT':
        return `Event activity with ${contactName}`;
      case 'MANUAL':
        return `Manual note added for ${contactName}`;
      case 'OTHER':
        return `Activity logged for ${contactName}`;
      default:
        return `Touchpoint with ${contactName}`;
    }
  };

  const getActivityDescription = (touchpoint: RecentTouchpoint) => {
    // Return the first 100 characters of the note as description
    if (touchpoint.note.length > 100) {
      return touchpoint.note.substring(0, 100) + '...';
    }
    return touchpoint.note;
  };

  // Calculate dashboard stats
  const totalLeads = contacts.length;
  const thisMonthLeads = contacts.filter(contact => {
    const contactDate = new Date(contact.createdAt);
    const now = new Date();
    return contactDate.getMonth() === now.getMonth() && contactDate.getFullYear() === now.getFullYear();
  }).length;
  const convertedLeads = contacts.filter(contact => contact.status === 'CLIENT').length;
  const followUpsNeeded = contacts.filter(contact => contact.status === 'LEAD' || contact.status === 'OPPORTUNITY').length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.company?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All Status' || contact.status === statusFilter;
    const matchesSource = sourceFilter === 'All Sources' || contact.source === sourceFilter;
    
    return matchesSearch && matchesStatus && matchesSource;
  });

  // Show loading while checking authentication
  if (isAuthLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading DaVeenci CRM...</p>
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
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your leads...</p>
      </div>
    );
  }

  return (
    <div className="crm-app">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">📊</div>
            <div className="logo-text">
              <h2>Daveenci</h2>
              <p>CRM System</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <h3>NAVIGATION</h3>
            <button 
              className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentView('dashboard')}
            >
              <span className="nav-icon">📊</span>
              Dashboard
            </button>
            <button 
              className={`nav-item ${currentView === 'leads' ? 'active' : ''}`}
              onClick={() => setCurrentView('leads')}
            >
              <span className="nav-icon">👥</span>
              All Leads
            </button>
            <button 
              className={`nav-item ${currentView === 'add-lead' ? 'active' : ''}`}
              onClick={() => setCurrentView('add-lead')}
            >
              <span className="nav-icon">➕</span>
              Add Lead
            </button>
          </div>

          <div className="nav-section">
            <h3>QUICK STATS</h3>
            <div className="quick-stat">
              <span className="stat-dot green"></span>
              <span>Total Leads</span>
              <span className="stat-value">{totalLeads}</span>
            </div>
            <div className="quick-stat">
              <span className="stat-dot green"></span>
              <span>This Month</span>
              <span className="stat-value">{thisMonthLeads}</span>
            </div>
            <div className="quick-stat">
              <span className="stat-dot purple"></span>
              <span>Converted</span>
              <span className="stat-value">{convertedLeads}</span>
            </div>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div className="dashboard">
            <div className="dashboard-header">
              <h1>Welcome to Your CRM</h1>
              <p>Manage your leads and grow your business efficiently</p>
              <button 
                className="cta-button"
                onClick={() => setCurrentView('add-lead')}
              >
                ➕ Add New Lead
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon blue">👥</div>
                <div className="stat-content">
                  <h3>Total Leads</h3>
                  <div className="stat-number">{totalLeads}</div>
                  <p className="stat-change">+0 this week</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon green">📅</div>
                <div className="stat-content">
                  <h3>This Month</h3>
                  <div className="stat-number">{thisMonthLeads}</div>
                  <p className="stat-change">New leads</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon purple">🎯</div>
                <div className="stat-content">
                  <h3>Converted</h3>
                  <div className="stat-number">{convertedLeads}</div>
                  <p className="stat-change">Success rate</p>
                </div>
              </div>

              <div className="stat-card urgent">
                <div className="stat-icon orange">⏰</div>
                <div className="stat-content">
                  <h3>Follow-ups Due</h3>
                  <div className="stat-number">{followUpsNeeded}</div>
                  <p className="stat-change">Action needed</p>
                </div>
                <div className="urgent-badge">Urgent</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon indigo">📈</div>
                <div className="stat-content">
                  <h3>Conversion Rate</h3>
                  <div className="stat-number">{conversionRate}%</div>
                  <p className="stat-change">Performance</p>
                </div>
              </div>
            </div>

            {/* Recent Activity Section */}
            <div className="recent-activity">
              <div className="activity-header">
                <div className="activity-icon">📈</div>
                <h2>Recent Activity</h2>
              </div>

              <div className="activity-feed">
                {recentTouchpoints.length === 0 ? (
                  <div className="activity-empty">
                    <p>No recent activity</p>
                    <span>Start adding touchpoints to track your interactions</span>
                  </div>
                ) : (
                  recentTouchpoints.map((touchpoint) => (
                    <div key={touchpoint.id} className="activity-item">
                      <div 
                        className="activity-item-icon"
                        style={{ backgroundColor: getTouchpointIconColor(touchpoint.source) }}
                      >
                        {getTouchpointIcon(touchpoint.source)}
                      </div>
                      <div className="activity-item-content">
                        <div className="activity-item-header">
                          <h4>{getActivityTitle(touchpoint)}</h4>
                          <span className="activity-time">{formatActivityTime(touchpoint.createdAt)}</span>
                        </div>
                        <p className="activity-description">
                          {getActivityDescription(touchpoint)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Leads View */}
        {currentView === 'leads' && (
          <div className="leads-view">
            <div className="leads-header">
              <div className="leads-title">
                <h1>All Leads</h1>
                <p>Manage and track your {totalLeads} leads</p>
              </div>
              <div className="leads-actions">
                <button className="export-btn">
                  📄 Export CSV
                </button>
                <button 
                  className="add-lead-btn"
                  onClick={() => setCurrentView('add-lead')}
                >
                  ➕ Add Lead
                </button>
              </div>
            </div>

            <div className="leads-controls">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search leads by name, company, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="filters">
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option>All Status</option>
                  <option value="PROSPECT">New</option>
                  <option value="LEAD">Contacted</option>
                  <option value="OPPORTUNITY">Qualified</option>
                  <option value="CLIENT">Converted</option>
                </select>
                <select 
                  value={sourceFilter} 
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <option>All Sources</option>
                  <option value="Website">Website</option>
                  <option value="Referral">Referral</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Email">Email</option>
                </select>
                <button className="view-toggle list-view active">☰</button>
                <button className="view-toggle grid-view">⊞</button>
              </div>
            </div>

            <div className="leads-table">
              <table>
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Industry</th>
                    <th>Contact</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map(contact => (
                    <tr key={contact.id}>
                      <td>
                        <div className="lead-info">
                          <div className="lead-avatar">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="lead-name">{contact.name}</div>
                            <div className="lead-title">Contact</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="company-info">
                          <span className="company-icon">🏢</span>
                          {contact.company || 'N/A'}
                        </div>
                      </td>
                      <td>
                        <span 
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(contact.status) }}
                        >
                          {getStatusLabel(contact.status)}
                        </span>
                      </td>
                      <td>{contact.source || 'General'}</td>
                      <td>
                        <div className="contact-info">
                          <div>📧 {contact.email}</div>
                          <div>📞 {contact.phone || 'N/A'}</div>
                        </div>
                      </td>
                      <td>📅 {formatDate(contact.createdAt)}</td>
                      <td>
                        <div className="actions">
                          <button 
                            className="action-btn"
                            onClick={() => deleteContact(contact.id)}
                          >
                            ⋮
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredContacts.length === 0 && (
                <div className="empty-state">
                  <p>No leads found matching your criteria</p>
                  <button onClick={() => setCurrentView('add-lead')}>
                    Add your first lead
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Lead View */}
        {currentView === 'add-lead' && (
          <div className="add-lead-view">
            <div className="form-header">
              <h1>Add New Lead</h1>
              <p>Enter lead information to start tracking</p>
            </div>

            <form onSubmit={createContact} className="lead-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Company</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  >
                    <option value="">Select Source</option>
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Email">Email</option>
                    <option value="Phone">Phone</option>
                    <option value="Event">Event</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="PROSPECT">New</option>
                    <option value="LEAD">Contacted</option>
                    <option value="OPPORTUNITY">Qualified</option>
                    <option value="CLIENT">Converted</option>
                  </select>
                </div>
              </div>

              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Add any additional notes about this lead..."
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setCurrentView('leads')}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Add Lead
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
