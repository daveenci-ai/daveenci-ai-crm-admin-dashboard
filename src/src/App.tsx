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

type ViewType = 'dashboard' | 'contacts' | 'email-campaigns' | 'calendar';

function App() {
  // Authentication state
  const [user, setUser] = useState<{ id: number; email: string; name: string } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // App state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recentTouchpoints, setRecentTouchpoints] = useState<RecentTouchpoint[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Contact filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All Types');
  const [industryFilter, setIndustryFilter] = useState<string>('All Industries');
  const [timeFilter, setTimeFilter] = useState<string>('All Time');
  
  // Dashboard breakdown filters
  const [breakdownType, setBreakdownType] = useState<string>('Industry');
  const [breakdownPeriod, setBreakdownPeriod] = useState<string>('Last 28 Days');
  const [breakdownContactFilter, setBreakdownContactFilter] = useState<string>('All Contacts');

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

  const [showCreateForm, setShowCreateForm] = useState(false);

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
      setCurrentView('contacts');
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

  // Calculate funnel data
  const prospectCount = contacts.filter(c => c.status === 'PROSPECT').length;
  const leadCount = contacts.filter(c => c.status === 'LEAD').length;
  const opportunityCount = contacts.filter(c => c.status === 'OPPORTUNITY').length;
  const clientCount = contacts.filter(c => c.status === 'CLIENT').length;

  // Calculate conversion rates between stages
  const prospectToLeadRate = prospectCount > 0 ? Math.round((leadCount / (prospectCount + leadCount)) * 100) : 0;
  const leadToOpportunityRate = leadCount > 0 ? Math.round((opportunityCount / (leadCount + opportunityCount)) * 100) : 0;
  const opportunityToClientRate = opportunityCount > 0 ? Math.round((clientCount / (opportunityCount + clientCount)) * 100) : 0;

  // Calculate new contacts (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newContacts = contacts.filter(contact => new Date(contact.createdAt) >= sevenDaysAgo);

  // Calculate 28-day growth for each stage
  const twentyEightDaysAgo = new Date();
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
  
  const newProspects28Days = contacts.filter(contact => 
    contact.status === 'PROSPECT' && new Date(contact.createdAt) >= twentyEightDaysAgo
  ).length;
  
  const newLeads28Days = contacts.filter(contact => 
    contact.status === 'LEAD' && new Date(contact.createdAt) >= twentyEightDaysAgo
  ).length;
  
  const newOpportunities28Days = contacts.filter(contact => 
    contact.status === 'OPPORTUNITY' && new Date(contact.createdAt) >= twentyEightDaysAgo
  ).length;
  
  const newClients28Days = contacts.filter(contact => 
    contact.status === 'CLIENT' && new Date(contact.createdAt) >= twentyEightDaysAgo
  ).length;

  // Calculate growth percentages (dummy calculation for now since we don't have historical data)
  const prospectGrowth = prospectCount > 0 ? Math.min(Math.round((newProspects28Days / prospectCount) * 100), 100) : 0;
  const leadGrowth = leadCount > 0 ? Math.min(Math.round((newLeads28Days / leadCount) * 100), 100) : 0;
  const opportunityGrowth = opportunityCount > 0 ? Math.min(Math.round((newOpportunities28Days / opportunityCount) * 100), 100) : 0;
  const clientGrowth = clientCount > 0 ? Math.min(Math.round((newClients28Days / clientCount) * 100), 100) : 0;

  // Filter recent touchpoints to exclude those from new contacts
  const recentTouchpointsExcludingNew = recentTouchpoints.filter(touchpoint => 
    !newContacts.some(newContact => newContact.id === touchpoint.contact.id)
  );

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.company?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All Types' || contact.status === statusFilter;
    const matchesIndustry = industryFilter === 'All Industries' || contact.source === industryFilter;
    
    return matchesSearch && matchesStatus && matchesIndustry;
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
      {/* Top Navigation */}
      <div className="top-navigation">
        <div className="logo">
          <div className="logo-icon">📊</div>
          <div className="logo-text">
            <h2>Daveenci</h2>
            <p>CRM System</p>
          </div>
        </div>
        <div className="nav-links">
          <button 
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-item ${currentView === 'contacts' ? 'active' : ''}`}
            onClick={() => setCurrentView('contacts')}
          >
            Contacts
          </button>
          <button 
            className={`nav-item ${currentView === 'email-campaigns' ? 'active' : ''}`}
            onClick={() => setCurrentView('email-campaigns')}
          >
            Email Campaigns
          </button>
          <button 
            className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`}
            onClick={() => setCurrentView('calendar')}
          >
            Calendar
          </button>
        </div>
        <div className="user-actions">
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
              <h1>Dashboard</h1>
              <p>Overview of your CRM performance and activities</p>
            </div>

            {/* Sales Funnel Section */}
            <div className="dashboard-section">
              <h2>Sales Funnel</h2>
              <div className="funnel-container">
                <div className="funnel-stage prospects" onClick={() => setCurrentView('contacts')}>
                  <div className="funnel-content">
                    <div className="funnel-icon">👥</div>
                    <div className="funnel-number">{prospectCount}</div>
                    <div className="funnel-label">Prospects</div>
                    <div className="funnel-growth">
                      <span className="growth-number">+{newProspects28Days}</span>
                      <span className="growth-period">28 days</span>
                      <span className="growth-percentage">+{prospectGrowth}%</span>
                    </div>
                  </div>
                  <div className="funnel-arrow">→</div>
                </div>

                <div className="funnel-stage leads" onClick={() => setCurrentView('contacts')}>
                  <div className="funnel-content">
                    <div className="funnel-icon">🎯</div>
                    <div className="funnel-number">{leadCount}</div>
                    <div className="funnel-label">Leads</div>
                    <div className="funnel-growth">
                      <span className="growth-number">+{newLeads28Days}</span>
                      <span className="growth-period">28 days</span>
                      <span className="growth-percentage">+{leadGrowth}%</span>
                    </div>
                  </div>
                  <div className="funnel-arrow">→</div>
                </div>

                <div className="funnel-stage opportunities" onClick={() => setCurrentView('contacts')}>
                  <div className="funnel-content">
                    <div className="funnel-icon">⚡</div>
                    <div className="funnel-number">{opportunityCount}</div>
                    <div className="funnel-label">Opportunities</div>
                    <div className="funnel-growth">
                      <span className="growth-number">+{newOpportunities28Days}</span>
                      <span className="growth-period">28 days</span>
                      <span className="growth-percentage">+{opportunityGrowth}%</span>
                    </div>
                  </div>
                  <div className="funnel-arrow">→</div>
                </div>

                <div className="funnel-stage clients" onClick={() => setCurrentView('contacts')}>
                  <div className="funnel-content">
                    <div className="funnel-icon">👑</div>
                    <div className="funnel-number">{clientCount}</div>
                    <div className="funnel-label">Clients</div>
                    <div className="funnel-growth">
                      <span className="growth-number">+{newClients28Days}</span>
                      <span className="growth-period">28 days</span>
                      <span className="growth-percentage">+{clientGrowth}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Three Column Section */}
            <div className="dashboard-section">
              <div className="three-column-grid">
                {/* New Contacts Column */}
                <div className="column-section">
                  <div className="column-header">
                    <h3>New Contacts</h3>
                    <span className="column-subtitle">Last 7 Days</span>
                  </div>
                  <div className="column-content">
                    {newContacts.length === 0 ? (
                      <div className="empty-state-small">
                        <p>No new contacts this week</p>
                        <span>Add contacts to see them here</span>
                      </div>
                    ) : (
                      newContacts.slice(0, 5).map((contact) => (
                        <div key={contact.id} className="contact-item-small">
                          <div className="contact-avatar-small">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="contact-info-small">
                            <div className="contact-name-small">{contact.name}</div>
                            <div className="contact-company-small">{contact.company || 'No company'}</div>
                            <div className="contact-date-small">{formatDate(contact.createdAt)}</div>
                          </div>
                          <div 
                            className="status-badge-small"
                            style={{ backgroundColor: getStatusColor(contact.status) }}
                          >
                            {getStatusLabel(contact.status)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Touchpoints Column */}
                <div className="column-section">
                  <div className="column-header">
                    <h3>Recent Touchpoints</h3>
                    <span className="column-subtitle">Excluding New Contacts</span>
                  </div>
                  <div className="column-content">
                    {recentTouchpointsExcludingNew.length === 0 ? (
                      <div className="empty-state-small">
                        <p>No recent touchpoints</p>
                        <span>Interactions will appear here</span>
                      </div>
                    ) : (
                      recentTouchpointsExcludingNew.slice(0, 5).map((touchpoint) => (
                        <div key={touchpoint.id} className="touchpoint-item-small">
                          <div 
                            className="touchpoint-icon-small"
                            style={{ backgroundColor: getTouchpointIconColor(touchpoint.source) }}
                          >
                            {getTouchpointIcon(touchpoint.source)}
                          </div>
                          <div className="touchpoint-info-small">
                            <div className="touchpoint-contact-small">{touchpoint.contact.name}</div>
                            <div className="touchpoint-note-small">
                              {touchpoint.note.length > 50 ? 
                                `${touchpoint.note.substring(0, 50)}...` : 
                                touchpoint.note
                              }
                            </div>
                            <div className="touchpoint-time-small">{formatActivityTime(touchpoint.createdAt)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Upcoming Events Column */}
                <div className="column-section">
                  <div className="column-header">
                    <h3>Upcoming Events</h3>
                    <span className="column-subtitle">Next 7 Days</span>
                  </div>
                  <div className="column-content">
                    <div className="event-item-small">
                      <div className="event-date-small">
                        <div className="event-day">23</div>
                        <div className="event-month">Jan</div>
                      </div>
                      <div className="event-info-small">
                        <div className="event-title-small">Meeting with Sarah Johnson</div>
                        <div className="event-location-small">📍 Conference Room A</div>
                        <div className="event-time-small">⏰ 2:00 PM - 3:00 PM</div>
                      </div>
                    </div>

                    <div className="event-item-small">
                      <div className="event-date-small">
                        <div className="event-day">24</div>
                        <div className="event-month">Jan</div>
                      </div>
                      <div className="event-info-small">
                        <div className="event-title-small">Call with Michael Chen</div>
                        <div className="event-location-small">📞 Phone Call</div>
                        <div className="event-time-small">⏰ 10:00 AM - 11:00 AM</div>
                      </div>
                    </div>

                    <div className="event-item-small">
                      <div className="event-date-small">
                        <div className="event-day">25</div>
                        <div className="event-month">Jan</div>
                      </div>
                      <div className="event-info-small">
                        <div className="event-title-small">Demo for Emily Rodriguez</div>
                        <div className="event-location-small">💻 Virtual Meeting</div>
                        <div className="event-time-small">⏰ 3:30 PM - 4:30 PM</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>



            {/* Breakdown Section */}
            <div className="dashboard-section breakdown-section">
              <div className="section-header">
                <h2>Breakdown</h2>
                <div className="breakdown-filters">
                  <select 
                    value={breakdownContactFilter} 
                    onChange={(e) => setBreakdownContactFilter(e.target.value)}
                  >
                    <option value="All Contacts">All Contacts</option>
                    <option value="Prospects">Prospects</option>
                    <option value="Leads">Leads</option>
                    <option value="Opportunities">Opportunities</option>
                    <option value="Clients">Clients</option>
                  </select>
                  <select 
                    value={breakdownType} 
                    onChange={(e) => setBreakdownType(e.target.value)}
                  >
                    <option value="Industry">By Industry</option>
                    <option value="Location">By Location</option>
                    <option value="Source">By Source</option>
                    <option value="Status">By Status</option>
                  </select>
                  <select 
                    value={breakdownPeriod} 
                    onChange={(e) => setBreakdownPeriod(e.target.value)}
                  >
                    <option value="Last 7 Days">Last 7 Days</option>
                    <option value="Last 28 Days">Last 28 Days</option>
                    <option value="Last 3 Months">Last 3 Months</option>
                    <option value="Last 6 Months">Last 6 Months</option>
                    <option value="Last 12 Months">Last 12 Months</option>
                  </select>
                </div>
              </div>
              
              <div className="breakdown-grid">
                <div className="breakdown-chart">
                  <div className="chart-placeholder">
                    <div className="chart-icon">📊</div>
                    <p>Breakdown Chart</p>
                    <span>Visual representation of {breakdownContactFilter.toLowerCase()} {breakdownType.toLowerCase()} data for {breakdownPeriod.toLowerCase()}</span>
                  </div>
                </div>
                
                <div className="breakdown-stats">
                  <div className="breakdown-stat">
                    <div className="stat-color" style={{backgroundColor: '#6366f1'}}></div>
                    <div className="stat-info">
                      <div className="stat-label">Technology</div>
                      <div className="stat-percentage">35%</div>
                    </div>
                  </div>
                  
                  <div className="breakdown-stat">
                    <div className="stat-color" style={{backgroundColor: '#10b981'}}></div>
                    <div className="stat-info">
                      <div className="stat-label">Healthcare</div>
                      <div className="stat-percentage">28%</div>
                    </div>
                  </div>
                  
                  <div className="breakdown-stat">
                    <div className="stat-color" style={{backgroundColor: '#f59e0b'}}></div>
                    <div className="stat-info">
                      <div className="stat-label">Finance</div>
                      <div className="stat-percentage">22%</div>
                    </div>
                  </div>
                  
                  <div className="breakdown-stat">
                    <div className="stat-color" style={{backgroundColor: '#8b5cf6'}}></div>
                    <div className="stat-info">
                      <div className="stat-label">Education</div>
                      <div className="stat-percentage">15%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contacts View */}
        {currentView === 'contacts' && (
          <div className="contacts-view">
            <div className="contacts-header">
              <div className="contacts-title">
                <h1>All Contacts</h1>
                <p>Manage and track your {totalLeads} contacts</p>
              </div>
              <div className="contacts-actions">
                <button className="export-btn">
                  📄 Export CSV
                </button>
                <button 
                  className="add-contact-btn"
                  onClick={() => setShowCreateForm(true)}
                >
                  ➕ Add Contact
                </button>
              </div>
            </div>

            <div className="contacts-controls">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search contacts by name, company, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="filters">
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option>All Types</option>
                  <option value="PROSPECT">Prospects</option>
                  <option value="LEAD">Leads</option>
                  <option value="OPPORTUNITY">Opportunities</option>
                  <option value="CLIENT">Clients</option>
                </select>
                <select 
                  value={industryFilter} 
                  onChange={(e) => setIndustryFilter(e.target.value)}
                >
                  <option>All Industries</option>
                  <option value="Technology">Technology</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Finance">Finance</option>
                  <option value="Education">Education</option>
                  <option value="Construction">Construction</option>
                </select>
                <select 
                  value={timeFilter} 
                  onChange={(e) => setTimeFilter(e.target.value)}
                >
                  <option>All Time</option>
                  <option value="Last Week">Last Week</option>
                  <option value="Last 28 Days">Last 28 Days</option>
                  <option value="Last 6 Months">Last 6 Months</option>
                  <option value="Last 12 Months">Last 12 Months</option>
                </select>
              </div>
            </div>

            <div className="contacts-layout">
              {/* Contacts List */}
              <div className="contacts-list-panel">
                <div className="contacts-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Contact</th>
                        <th>Company</th>
                        <th>Status</th>
                        <th>Industry</th>
                        <th>Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContacts.map(contact => (
                        <tr 
                          key={contact.id} 
                          className={selectedContact?.id === contact.id ? 'selected' : ''}
                          onClick={() => setSelectedContact(contact)}
                        >
                          <td>
                            <div className="contact-info">
                              <div className="contact-avatar">
                                {contact.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="contact-name">{contact.name}</div>
                                <div className="contact-email">{contact.email}</div>
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
                          <td>📅 {formatDate(contact.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredContacts.length === 0 && (
                    <div className="empty-state">
                      <p>No contacts found matching your criteria</p>
                      <button onClick={() => setShowCreateForm(true)}>
                        Add your first contact
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Details Panel */}
              <div className="contact-details-panel">
                {selectedContact ? (
                  <div className="contact-details">
                    <div className="contact-details-header">
                      <div className="contact-avatar-large">
                        {selectedContact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="contact-info-large">
                        <h2>{selectedContact.name}</h2>
                        <p>{selectedContact.email}</p>
                        <span 
                          className="status-badge-large"
                          style={{ backgroundColor: getStatusColor(selectedContact.status) }}
                        >
                          {getStatusLabel(selectedContact.status)}
                        </span>
                      </div>
                      <div className="contact-actions">
                        <button className="edit-btn">✏️ Edit</button>
                        <button 
                          className="delete-btn"
                          onClick={() => deleteContact(selectedContact.id)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    <div className="contact-details-content">
                      <div className="contact-info-section">
                        <h3>Contact Information</h3>
                        <div className="info-grid">
                          <div className="info-item">
                            <label>Phone:</label>
                            <span>{selectedContact.phone || 'Not provided'}</span>
                          </div>
                          <div className="info-item">
                            <label>Company:</label>
                            <span>{selectedContact.company || 'Not provided'}</span>
                          </div>
                          <div className="info-item">
                            <label>Source:</label>
                            <span>{selectedContact.source || 'Not specified'}</span>
                          </div>
                          <div className="info-item">
                            <label>Created:</label>
                            <span>{formatDate(selectedContact.createdAt)}</span>
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
                        <div className="touchpoints-header">
                          <h3>Touchpoints ({selectedContact.touchpoints.length})</h3>
                          <button className="add-touchpoint-btn">+ Add Touchpoint</button>
                        </div>
                        
                        <div className="touchpoints-list">
                          {selectedContact.touchpoints.length === 0 ? (
                            <div className="touchpoints-empty">
                              <p>No touchpoints yet</p>
                              <span>Add your first interaction with this contact</span>
                            </div>
                          ) : (
                            selectedContact.touchpoints.map((touchpoint) => (
                              <div key={touchpoint.id} className="touchpoint-item">
                                <div 
                                  className="touchpoint-icon"
                                  style={{ backgroundColor: getTouchpointIconColor(touchpoint.source) }}
                                >
                                  {getTouchpointIcon(touchpoint.source)}
                                </div>
                                <div className="touchpoint-content">
                                  <div className="touchpoint-header">
                                    <span className="touchpoint-type">
                                      {touchpoint.source.replace('_', ' ').toLowerCase()}
                                    </span>
                                    <span className="touchpoint-time">
                                      {formatActivityTime(touchpoint.createdAt)}
                                    </span>
                                  </div>
                                  <p className="touchpoint-note">{touchpoint.note}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-contact-selected">
                    <div className="no-contact-icon">👤</div>
                    <h3>Select a Contact</h3>
                    <p>Choose a contact from the list to view details and touchpoints</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Email Campaigns View */}
        {currentView === 'email-campaigns' && (
          <div className="placeholder-view">
            <div className="placeholder-content">
              <div className="placeholder-icon">📧</div>
              <h1>Email Campaigns</h1>
              <p>Email campaign management coming soon</p>
              <span>Create, manage, and track your email marketing campaigns</span>
            </div>
          </div>
        )}

        {/* Calendar View */}
        {currentView === 'calendar' && (
          <div className="placeholder-view">
            <div className="placeholder-content">
              <div className="placeholder-icon">📅</div>
              <h1>Calendar</h1>
              <p>Calendar and scheduling coming soon</p>
              <span>Schedule meetings, set reminders, and manage your appointments</span>
            </div>
          </div>
        )}

        {/* Create Contact Form Modal */}
        {showCreateForm && (
          <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add New Contact</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowCreateForm(false)}
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={createContact} className="contact-form">
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
                      <option value="PROSPECT">Prospect</option>
                      <option value="LEAD">Lead</option>
                      <option value="OPPORTUNITY">Opportunity</option>
                      <option value="CLIENT">Client</option>
                    </select>
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Add any additional notes about this contact..."
                  />
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="cancel-btn"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="submit-btn">
                    Add Contact
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
