import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Login from './Login';
import './App.css';
import { API_CONFIG, type ContactStatus, type TouchpointSource } from './config';

// Configure axios to send cookies
axios.defaults.withCredentials = true;

// Add request timeout
axios.defaults.timeout = API_CONFIG.TIMEOUT;

// Initialize auth token from localStorage on app load
const initializeAuth = () => {
  const storedToken = localStorage.getItem('authToken');
  if (storedToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
  }
};

// Call initialization
initializeAuth();

interface Contact {
  id: number;
  name: string;
  primaryEmail: string;
  secondaryEmail?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  company?: string;
  industry?: string;
  website?: string;
  address?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  source?: string;
  status: 'PROSPECT' | 'LEAD' | 'OPPORTUNITY' | 'CLIENT' | 'CHURNED' | 'DECLINED' | 'UNQUALIFIED';
  sentiment?: 'GOOD' | 'NEUTRAL' | 'BAD';
  leadScore?: number;
  opportunityScore?: number;
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

// Cache utilities

const getCachedData = (key: string) => {
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < API_CONFIG.CACHE_DURATION) {
        return data;
      }
    }
  } catch (error) {
    // Silently handle cache errors
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    // Silently handle cache errors
  }
};

// Simple Tooltip Component
const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  return (
    <div className="tooltip-container" title={text}>
      {children}
    </div>
  );
};

// Helper function to ensure URLs have proper protocol
const ensureProtocol = (url: string): string => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

function App() {
  // Authentication state
  const [user, setUser] = useState<{ id: number; email: string; name: string } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // App state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const [isContactsLoading, setIsContactsLoading] = useState(true);
  const [isTouchpointsLoading, setIsTouchpointsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Progressive loading state
  const [hasInitialData, setHasInitialData] = useState(false);
  
  // Contact filters
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<string>('All Time');
  const [sourceFilter, setSourceFilter] = useState<string>('All Sources');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null);
  
  // Table sorting
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Form state for creating contacts
  const [formData, setFormData] = useState<{
    name: string;
    primaryEmail: string;
    secondaryEmail: string;
    primaryPhone: string;
    secondaryPhone: string;
    company: string;
    industry: string;
    website: string;
    address: string;
    linkedinUrl: string;
    facebookUrl: string;
    instagramUrl: string;
    youtubeUrl: string;
    tiktokUrl: string;
    source: string;
    status: 'PROSPECT' | 'LEAD' | 'OPPORTUNITY' | 'CLIENT' | 'CHURNED' | 'DECLINED' | 'UNQUALIFIED';
    sentiment: 'GOOD' | 'NEUTRAL' | 'BAD';
    leadScore: string;
    opportunityScore: string;
    notes: string;
  }>({
    name: '',
    primaryEmail: '',
    secondaryEmail: '',
    primaryPhone: '',
    secondaryPhone: '',
    company: '',
    industry: '',
    website: '',
    address: '',
    linkedinUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
    tiktokUrl: '',
    source: '',
    status: 'PROSPECT',
    sentiment: 'NEUTRAL',
    leadScore: '0',
    opportunityScore: '0',
    notes: ''
  });

  // Form state management
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Touchpoint form state
  const [showTouchpointForm, setShowTouchpointForm] = useState(false);
  const [touchpointData, setTouchpointData] = useState<{
    id?: number;
    note: string;
    source: 'MANUAL' | 'EMAIL' | 'SMS' | 'PHONE' | 'IN_PERSON' | 'EVENT' | 'OTHER';
  }>({
    note: '',
    source: 'MANUAL'
  });

  // Load cached data on mount
  useEffect(() => {
    const cachedContacts = getCachedData('contacts');
    const cachedTouchpoints = getCachedData('touchpoints');
    
    if (cachedContacts) {
      setContacts(cachedContacts);
      setIsContactsLoading(false);
      setHasInitialData(true);
    }
    
    if (cachedTouchpoints) {
      // setRecentTouchpoints(cachedTouchpoints); // This line was removed
      setIsTouchpointsLoading(false);
      setHasInitialData(true);
    }
  }, []);

  // Parallel data loading on authentication
  useEffect(() => {
    const initializeApp = async () => {
      await checkAuthStatus();
    };

    initializeApp();
  }, []); // Empty dependency array since we want this to run once on mount

  // Load data when user is authenticated
  useEffect(() => {
    if (user) {
      // Load data in parallel for better performance
      Promise.all([
        fetchContacts()
      ]);
    }
  }, [user]); // Trigger when user changes

  const checkAuthStatus = useCallback(async () => {
    try {
      // First, check if we have a stored token and set it up
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      }
      
      const response = await axios.get(`${API_CONFIG.BASE_URL}/auth/me`);
      setUser(response.data.user);
    } catch (err) {
      // Clear any invalid tokens
      localStorage.removeItem('authToken');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const handleLoginSuccess = (userData: { id: number; email: string; name: string }) => {
    setUser(userData);
    setIsAuthLoading(false);
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/auth/logout`);
    } catch (err) {
      // Silently handle logout errors
    } finally {
      localStorage.removeItem('authToken');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setContacts([]);
      // setRecentTouchpoints([]); // This line was removed
    }
  };

  const fetchContacts = useCallback(async (retryCount = 0) => {
    try {
      setIsContactsLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/contacts`);
      setContacts(response.data);
      setCachedData('contacts', response.data);
      setHasInitialData(true);
      setError(null);
    } catch (err) {
      // Retry logic for network errors
      if (retryCount < 2 && axios.isAxiosError(err) && (!err.response || err.response.status >= 500)) {
        setTimeout(() => fetchContacts(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      
      setError('Failed to fetch contacts. Please try refreshing the page.');
    } finally {
      setIsContactsLoading(false);
    }
  }, []);

  const fetchRecentTouchpoints = useCallback(async (retryCount = 0) => {
    try {
      setIsTouchpointsLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/touchpoints/recent`);
      // setRecentTouchpoints(response.data); // This line was removed
      setCachedData('touchpoints', response.data);
      setHasInitialData(true);
    } catch (err) {
      // Retry logic for network errors
      if (retryCount < 2 && axios.isAxiosError(err) && (!err.response || err.response.status >= 500)) {
        setTimeout(() => fetchRecentTouchpoints(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      
      // Touchpoints are non-critical, fail silently
    } finally {
      setIsTouchpointsLoading(false);
    }
  }, []);

  const exportContacts = () => {
    const csvHeaders = [
      'Name',
      'Primary Email',
      'Secondary Email', 
      'Primary Phone',
      'Secondary Phone',
      'Company',
      'Industry',
      'Website',
      'Address',
      'Source',
      'Status',
      'Notes',
      'Created Date'
    ];

    const csvData = filteredContacts.map(contact => [
      contact.name,
      contact.primaryEmail || '',
      contact.secondaryEmail || '',
      contact.primaryPhone || '',
      contact.secondaryPhone || '',
      contact.company || '',
      contact.industry || '',
      contact.website || '',
      contact.address || '',
      contact.source || '',
      contact.status,
      contact.notes || '',
      formatDate(contact.createdAt)
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `contacts-export-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const createContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await axios.post(`${API_CONFIG.BASE_URL}/contacts`, formData);
      setContacts([response.data, ...contacts]);
      resetForm();
    } catch (err) {
      setError('Failed to create contact');
      console.error('Error creating contact:', err);
    }
  };

  const updateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingContact) return;
    
    try {
      const response = await axios.put(`${API_CONFIG.BASE_URL}/contacts/${editingContact.id}`, formData);
      setContacts(contacts.map(c => c.id === editingContact.id ? response.data : c));
      
      // Update selected contact if it's the one being edited
      if (selectedContact?.id === editingContact.id) {
        setSelectedContact(response.data);
      }
      
      resetForm();
    } catch (err) {
      setError('Failed to update contact');
      console.error('Error updating contact:', err);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    if (editingContact) {
      updateContact(e);
    } else {
      createContact(e);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      primaryEmail: '',
      secondaryEmail: '',
      primaryPhone: '',
      secondaryPhone: '',
      company: '',
      industry: '',
      website: '',
      address: '',
      linkedinUrl: '',
      facebookUrl: '',
      instagramUrl: '',
      youtubeUrl: '',
      tiktokUrl: '',
      source: '',
      status: 'PROSPECT',
      sentiment: 'NEUTRAL',
      leadScore: '0',
      opportunityScore: '0',
      notes: ''
          });
      setShowCreateForm(false);
      setEditingContact(null);
  };

  const openEditForm = (contact: Contact) => {
    setFormData({
      name: contact.name,
      primaryEmail: contact.primaryEmail,
      secondaryEmail: contact.secondaryEmail || '',
      primaryPhone: contact.primaryPhone || '',
      secondaryPhone: contact.secondaryPhone || '',
      company: contact.company || '',
      industry: contact.industry || '',
      website: contact.website || '',
      address: contact.address || '',
      linkedinUrl: contact.linkedinUrl || '',
      facebookUrl: contact.facebookUrl || '',
      instagramUrl: contact.instagramUrl || '',
      youtubeUrl: contact.youtubeUrl || '',
      tiktokUrl: contact.tiktokUrl || '',
      source: contact.source || '',
      status: contact.status,
      sentiment: contact.sentiment || 'NEUTRAL',
      leadScore: contact.leadScore?.toString() || '0',
      opportunityScore: contact.opportunityScore?.toString() || '0',
      notes: contact.notes || ''
    });
    setEditingContact(contact);
    setShowCreateForm(true);
  };

  const createTouchpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedContact) return;
    
    try {
      // Only send note and source to backend (date is not supported for creation)
      const createData = {
        note: touchpointData.note,
        source: touchpointData.source
      };
      
      const response = await axios.post(`${API_CONFIG.BASE_URL}/contacts/${selectedContact.id}/touchpoints`, createData);
      
      // Update the contact's touchpoints in the local state
      const updatedContact = {
        ...selectedContact,
        touchpoints: [response.data, ...selectedContact.touchpoints]
      };
      
      setSelectedContact(updatedContact);
      setContacts(contacts.map(c => c.id === selectedContact.id ? updatedContact : c));
      
      resetTouchpointForm();
      
      // Refresh recent touchpoints
      fetchRecentTouchpoints();
    } catch (err) {
      setError('Failed to create touchpoint');
      console.error('Error creating touchpoint:', err);
    }
  };

  const updateTouchpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedContact) return;
    
    try {
      // Only send note and source to backend (date is not supported for updates)
      const updateData = {
        note: touchpointData.note,
        source: touchpointData.source
      };
      
      const response = await axios.put(`${API_CONFIG.BASE_URL}/touchpoints/${touchpointData.id}`, updateData);
      
      // Update the contact's touchpoints in the local state
      const updatedContact = {
        ...selectedContact,
        touchpoints: selectedContact.touchpoints.map(t => 
          t.id === touchpointData.id ? response.data : t
        )
      };
      
      setSelectedContact(updatedContact);
      setContacts(contacts.map(c => c.id === selectedContact.id ? updatedContact : c));
      
      resetTouchpointForm();
      
      // Refresh recent touchpoints
      fetchRecentTouchpoints();
    } catch (err) {
      setError('Failed to update touchpoint');
      console.error('Error updating touchpoint:', err);
    }
  };

  const handleTouchpointSubmit = (e: React.FormEvent) => {
    if (touchpointData.id) { // If it's an update
      updateTouchpoint(e);
    } else { // If it's a create
      createTouchpoint(e);
    }
  };

  const resetTouchpointForm = () => {
    setTouchpointData({ 
      note: '', 
      source: 'MANUAL'
    });
    setShowTouchpointForm(false);
  };

  const openEditTouchpoint = (touchpoint: Touchpoint) => {
    setTouchpointData({
      note: touchpoint.note,
      source: touchpoint.source,
      id: touchpoint.id
    });
    setShowTouchpointForm(true);
  };

  const openCreateTouchpoint = () => {
    resetTouchpointForm();
    setShowTouchpointForm(true);
  };

  const deleteTouchpoint = async (touchpointId: number) => {
    if (!selectedContact || !window.confirm('Are you sure you want to delete this touchpoint?')) return;
    
    try {
      await axios.delete(`${API_CONFIG.BASE_URL}/touchpoints/${touchpointId}`);
      
      // Update the contact's touchpoints in the local state
      const updatedContact = {
        ...selectedContact,
        touchpoints: selectedContact.touchpoints.filter(t => t.id !== touchpointId)
      };
      
      setSelectedContact(updatedContact);
      setContacts(contacts.map(c => c.id === selectedContact.id ? updatedContact : c));
      
      // Refresh recent touchpoints
      fetchRecentTouchpoints();
    } catch (err) {
      setError('Failed to delete touchpoint');
      console.error('Error deleting touchpoint:', err);
    }
  };

  const deleteContact = async (contactId: number) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      await axios.delete(`${API_CONFIG.BASE_URL}/contacts/${contactId}`);
      setContacts(contacts.filter(c => c.id !== contactId));
    } catch (err) {
      setError('Failed to delete contact');
      console.error('Error deleting contact:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROSPECT': return '#8FA4D4';           // Light blue
      case 'LEAD': return '#F6D479';     // Yellow  
      case 'OPPORTUNITY': return '#F4A261';       // Orange
      case 'CLIENT': return '#7BC47F';   // Green
      case 'UNQUALIFIED': return '#A9A9A9';  // Gray
      case 'DECLINED': return '#D32F2F'; // Red
      case 'CHURNED': return '#000000';     // Black
      default: return '#6b7280'; // Gray
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PROSPECT': return 'Prospects';
      case 'LEAD': return 'Leads';
      case 'OPPORTUNITY': return 'Opportunities';
      case 'CLIENT': return 'Clients';
      case 'UNQUALIFIED': return 'Unqualified';
      case 'DECLINED': return 'Declined';
      case 'CHURNED': return 'Churned';
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

  // Calculate funnel data
  const prospectCount = contacts.filter(c => c.status === 'PROSPECT').length;
  const leadCount = contacts.filter(c => c.status === 'LEAD').length;
  const opportunityCount = contacts.filter(c => c.status === 'OPPORTUNITY').length;
  const clientCount = contacts.filter(c => c.status === 'CLIENT').length;
  const disqualifiedCount = contacts.filter(c => c.status === 'UNQUALIFIED').length;
  const declinedCount = contacts.filter(c => c.status === 'DECLINED').length;
  const churnedCount = contacts.filter(c => c.status === 'CHURNED').length;

  // Calculate new contacts (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);








  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle status card filtering
  const handleStatusCardClick = (status: string) => {
    if (selectedStatusFilter === status) {
      // If clicking the same card, deselect it (show all contacts)
      setSelectedStatusFilter(null);
    } else {
      // Select the new status filter
      setSelectedStatusFilter(status);
    }
  };

  // Filter and sort contacts
  const filteredContacts = contacts.filter(contact => {
    try {
      const matchesSearch = contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (contact.primaryEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.secondaryEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.website?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.address?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Time filter based on contact creation date
      let matchesTimeFilter = true;
      if (timeFilter !== 'All Time') {
        const contactDate = new Date(contact.createdAt);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (timeFilter) {
          case 'Last Week':
            matchesTimeFilter = diffDays <= 7;
            break;
          case 'Last 28 Days':
            matchesTimeFilter = diffDays <= 28;
            break;
          case 'Last 6 Months':
            matchesTimeFilter = diffDays <= 180;
            break;
          case 'Last 12 Months':
            matchesTimeFilter = diffDays <= 365;
            break;
        }
      }

      // Status filter based on selected status card
      let matchesStatus = true;
      if (selectedStatusFilter) {
        matchesStatus = contact.status === selectedStatusFilter;
      }

      // Source filter
      let matchesSource = true;
      if (sourceFilter !== 'All Sources') {
        matchesSource = contact.source === sourceFilter;
      }
    
      return matchesSearch && matchesTimeFilter && matchesStatus && matchesSource;
    } catch (error) {
      console.error('Error filtering contact:', error);
      return false;
    }
  }).sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'source':
        aValue = a.source?.toLowerCase() || '';
        bValue = b.source?.toLowerCase() || '';
        break;
      case 'email':
        aValue = (a.primaryEmail || '').toLowerCase();
        bValue = (b.primaryEmail || '').toLowerCase();
        break;
      case 'phone':
        aValue = a.primaryPhone || '';
        bValue = b.primaryPhone || '';
        break;
      case 'lastTouchpoint':
        const aLastTouchpoint = a.touchpoints
          .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())[0];
        const bLastTouchpoint = b.touchpoints
          .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())[0];
        aValue = aLastTouchpoint ? new Date(aLastTouchpoint.createdAt).getTime() : 0;
        bValue = bLastTouchpoint ? new Date(bLastTouchpoint.createdAt).getTime() : 0;
        break;
      case 'createdAt':
      default:
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
    }

    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
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

  // Show app loading only if we have no data at all
  if (!hasInitialData && (isContactsLoading || isTouchpointsLoading)) {
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
          <div className="logo-text">
            <h2>DaVeenci</h2>
            <p>Smart CRM System</p>
          </div>
        </div>
        <div className="nav-links">
          {/* Navigation links removed as requested */}
        </div>
        <div className="user-actions">
          <button 
            className="nav-action-btn add-contact-btn"
            onClick={() => setShowCreateForm(true)}
          >
            ➕ Add Contact
          </button>
          <button 
            className="nav-action-btn export-btn"
            onClick={exportContacts}
            title="Export filtered contacts to CSV file"
          >
            📄 Export CSV ({filteredContacts.length})
          </button>
          <button className="nav-action-btn logout-btn" onClick={handleLogout}>
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

        {/* Pipeline Stats Bar */}
        <div className="pipeline-stats-bar">
          <div className="pipeline-stats-container">
            <div 
              className={`stat-card churned ${selectedStatusFilter === 'CHURNED' ? 'selected' : ''}`}
              onClick={() => handleStatusCardClick('CHURNED')}
            >
              <div className="stat-number">{churnedCount}</div>
              <div className="stat-label">CHURNED</div>
              <div className="stat-growth">+100% 28d</div>
            </div>
            <div className="pipeline-arrow">→</div>
            <div 
              className={`stat-card declined ${selectedStatusFilter === 'DECLINED' ? 'selected' : ''}`}
              onClick={() => handleStatusCardClick('DECLINED')}
            >
              <div className="stat-number">{declinedCount}</div>
              <div className="stat-label">DECLINED</div>
              <div className="stat-growth">+100% 28d</div>
            </div>
            <div className="pipeline-arrow">→</div>
            <div 
              className={`stat-card unqualified ${selectedStatusFilter === 'UNQUALIFIED' ? 'selected' : ''}`}
              onClick={() => handleStatusCardClick('UNQUALIFIED')}
            >
              <div className="stat-number">{disqualifiedCount}</div>
              <div className="stat-label">UNQUALIFIED</div>
              <div className="stat-growth">+100% 28d</div>
            </div>
            <div className="pipeline-arrow">→</div>
            <div 
              className={`stat-card prospects ${selectedStatusFilter === 'PROSPECT' ? 'selected' : ''}`}
              onClick={() => handleStatusCardClick('PROSPECT')}
            >
              <div className="pipeline-arrows">← </div>
              <div className="stat-content">
                <div className="stat-number">{prospectCount}</div>
                <div className="stat-label">PROSPECTS</div>
                <div className="stat-growth">+100% 28d</div>
              </div>
              <div className="pipeline-arrows"> →</div>
            </div>
            <div className="pipeline-flow">→</div>
            <div 
              className={`stat-card leads ${selectedStatusFilter === 'LEAD' ? 'selected' : ''}`}
              onClick={() => handleStatusCardClick('LEAD')}
            >
              <div className="stat-number">{leadCount}</div>
              <div className="stat-label">LEADS</div>
              <div className="stat-growth">+100% 28d</div>
            </div>
            <div className="pipeline-arrow">→</div>
            <div 
              className={`stat-card opportunities ${selectedStatusFilter === 'OPPORTUNITY' ? 'selected' : ''}`}
              onClick={() => handleStatusCardClick('OPPORTUNITY')}
            >
              <div className="stat-number">{opportunityCount}</div>
              <div className="stat-label">OPPORTUNITIES</div>
              <div className="stat-growth">+100% 28d</div>
            </div>
            <div className="pipeline-arrow">→</div>
            <div 
              className={`stat-card clients ${selectedStatusFilter === 'CLIENT' ? 'selected' : ''}`}
              onClick={() => handleStatusCardClick('CLIENT')}
            >
              <div className="stat-number">{clientCount}</div>
              <div className="stat-label">CLIENTS</div>
              <div className="stat-growth">+100% 28d</div>
            </div>
          </div>
        </div>

        {/* Contacts View */}
          <div className="contacts-view">

            <div className="contacts-controls">
              <div className="controls-split">
                <div className="search-section">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search contacts by name, email, company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="filters-section">
                  <select 
                    value={sourceFilter} 
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="All Sources">All Sources</option>
                    {Array.from(new Set(contacts.map(c => c.source).filter(Boolean))).sort().map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                  <select 
                    value={timeFilter} 
                    onChange={(e) => setTimeFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option>All Time</option>
                    <option value="Last Week">Last Week</option>
                    <option value="Last 28 Days">Last 28 Days</option>
                    <option value="Last 6 Months">Last 6 Months</option>
                    <option value="Last 12 Months">Last 12 Months</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="contacts-layout">
              {/* Contacts Table - Full Width */}
              <div className="contacts-table-container">
                <div className="contacts-table">
                  <table>
                    <thead>
                      <tr>
                        <th 
                          className={`sortable ${sortField === 'name' ? 'sorted' : ''}`}
                          onClick={() => handleSort('name')}
                        >
                          Full Name
                          {sortField === 'name' && (
                            <span className="sort-indicator">
                              {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                            </span>
                          )}
                        </th>
                        <th 
                          className={`sortable ${sortField === 'status' ? 'sorted' : ''}`}
                          onClick={() => handleSort('status')}
                        >
                          Status
                          {sortField === 'status' && (
                            <span className="sort-indicator">
                              {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                            </span>
                          )}
                        </th>
                        <th 
                          className={`sortable ${sortField === 'source' ? 'sorted' : ''}`}
                          onClick={() => handleSort('source')}
                        >
                          Source
                          {sortField === 'source' && (
                            <span className="sort-indicator">
                              {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                            </span>
                          )}
                        </th>
                        <th 
                          className={`sortable ${sortField === 'email' ? 'sorted' : ''}`}
                          onClick={() => handleSort('email')}
                        >
                          Email
                          {sortField === 'email' && (
                            <span className="sort-indicator">
                              {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                            </span>
                          )}
                        </th>
                        <th 
                          className={`sortable ${sortField === 'phone' ? 'sorted' : ''}`}
                          onClick={() => handleSort('phone')}
                        >
                          Phone
                          {sortField === 'phone' && (
                            <span className="sort-indicator">
                              {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                            </span>
                          )}
                        </th>
                        <th 
                          className={`sortable ${sortField === 'lastTouchpoint' ? 'sorted' : ''}`}
                          onClick={() => handleSort('lastTouchpoint')}
                        >
                          Last Touchpoint
                          {sortField === 'lastTouchpoint' && (
                            <span className="sort-indicator">
                              {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                            </span>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContacts.map(contact => {
                        const lastTouchpoint = contact.touchpoints
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                        
                        return (
                          <tr 
                            key={contact.id} 
                            className={selectedContact?.id === contact.id ? 'selected' : ''}
                            onClick={() => setSelectedContact(contact)}
                          >
                            <td>
                              <div className="contact-name-cell">
                                <div className="contact-avatar">
                                  {contact.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="contact-name">{contact.name}</div>
                              </div>
                            </td>
                            <td>
                              <span 
                                className="status-badge-table"
                                style={{ backgroundColor: getStatusColor(contact.status) }}
                              >
                                {getStatusLabel(contact.status)}
                              </span>
                            </td>
                            <td>
                              <span className="source-cell">{contact.source || '—'}</span>
                            </td>
                            <td>
                              <span className="email-cell">{contact.primaryEmail}</span>
                            </td>
                            <td>
                              <span className="phone-cell">{contact.primaryPhone || '—'}</span>
                            </td>
                            <td>
                              <div className="last-touchpoint-cell">
                                {lastTouchpoint ? (
                                  <>
                                    <div className="touchpoint-date">
                                      {new Date(lastTouchpoint.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                    </div>
                                    <div className="touchpoint-description">
                                      {lastTouchpoint.note.length > 50 ? 
                                        `${lastTouchpoint.note.substring(0, 50)}...` : 
                                        lastTouchpoint.note
                                      }
                                    </div>
                                  </>
                                ) : (
                                  <span className="no-activity">No activity</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
            </div>
          </div>

            {/* Right Sliding Panel for Contact Details */}
            {selectedContact && (
              <div className="contact-details-sliding-panel">
                <div className="sliding-panel-overlay" onClick={() => setSelectedContact(null)}></div>
                <div className="sliding-panel-content">
                  <div className="sliding-panel-header">
                    <h3>Contact Details</h3>
                    <button 
                      className="close-panel-btn"
                      onClick={() => setSelectedContact(null)}
                      title="Close panel"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="contact-details">
                    {/* Head Section: Avatar, Name, Contact, Company, Social Media, Scores, Status, Actions */}
                    <div className="contact-head-section">
                      <div className="contact-avatar-large" style={{
                        background: selectedContact.sentiment === 'GOOD' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
                                   selectedContact.sentiment === 'NEUTRAL' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' :
                                   selectedContact.sentiment === 'BAD' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
                                   'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      }}>
                        {selectedContact.name.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="contact-essential-info">
                        <h2 className="contact-name-primary">{selectedContact.name}</h2>
                        
                        {/* Contact Methods */}
                        <div className="contact-methods">
                          <div className="contact-method">
                            📧 {selectedContact.primaryEmail}
                            {selectedContact.secondaryEmail && <span className="secondary-info"> • {selectedContact.secondaryEmail}</span>}
                          </div>
                          <div className="contact-method">
                            📞 {selectedContact.primaryPhone || 'No phone'}
                            {selectedContact.secondaryPhone && <span className="secondary-info"> • {selectedContact.secondaryPhone}</span>}
                          </div>
                        </div>

                        {/* Company Info */}
                        {selectedContact.company && (
                          <div className="company-info-head">
                            <h3 className="company-name-head">{selectedContact.company}</h3>
                            {selectedContact.address && (
                              <div className="address-info">
                                📍 {selectedContact.address}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Social Media Icons */}
                        {(selectedContact.linkedinUrl || selectedContact.facebookUrl || selectedContact.instagramUrl || selectedContact.youtubeUrl || selectedContact.tiktokUrl) && (
                          <div className="social-media-icons-head">
                            {selectedContact.linkedinUrl && (
                              <a href={ensureProtocol(selectedContact.linkedinUrl)} target="_blank" rel="noopener noreferrer" className="social-icon-head linkedin" title="LinkedIn">
                                🔗
                              </a>
                            )}
                            {selectedContact.facebookUrl && (
                              <a href={ensureProtocol(selectedContact.facebookUrl)} target="_blank" rel="noopener noreferrer" className="social-icon-head facebook" title="Facebook">
                                📘
                              </a>
                            )}
                            {selectedContact.instagramUrl && (
                              <a href={ensureProtocol(selectedContact.instagramUrl)} target="_blank" rel="noopener noreferrer" className="social-icon-head instagram" title="Instagram">
                                📸
                              </a>
                            )}
                            {selectedContact.youtubeUrl && (
                              <a href={ensureProtocol(selectedContact.youtubeUrl)} target="_blank" rel="noopener noreferrer" className="social-icon-head youtube" title="YouTube">
                                📺
                              </a>
                            )}
                            {selectedContact.tiktokUrl && (
                              <a href={ensureProtocol(selectedContact.tiktokUrl)} target="_blank" rel="noopener noreferrer" className="social-icon-head tiktok" title="TikTok">
                                🎵
                              </a>
                            )}
                          </div>
                        )}

                        {/* Lead/Opportunity Score */}
                        {((selectedContact.status === 'LEAD' && selectedContact.leadScore !== undefined && selectedContact.leadScore !== null) ||
                          (selectedContact.status === 'OPPORTUNITY' && selectedContact.opportunityScore !== undefined && selectedContact.opportunityScore !== null)) && (
                          <div className="score-info-head">
                            <span className="score-label">
                              {selectedContact.status === 'LEAD' ? 'Lead Score:' : 'Opportunity Score:'}
                            </span>
                            <span className="score-value">
                              {selectedContact.status === 'LEAD' 
                                ? Number(selectedContact.leadScore).toFixed(2)
                                : Number(selectedContact.opportunityScore).toFixed(2)
                              }
                            </span>
                          </div>
                        )}

                        {/* Meta Info */}
                        <div className="contact-meta-info">
                          <div className="meta-item">
                            <span className="meta-label">Source:</span>
                            <span className="meta-value">{selectedContact.source || 'Not specified'}</span>
                          </div>
                          <div className="meta-item">
                            <span className="meta-label">Added:</span>
                            <span className="meta-value">{formatDate(selectedContact.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="contact-status-actions">
                        <div 
                          className="status-badge-primary"
                          style={{ backgroundColor: getStatusColor(selectedContact.status) }}
                        >
                          {getStatusLabel(selectedContact.status)}
                        </div>
                        <div className="contact-actions-row">
                          <button 
                            className="action-btn edit-btn"
                            onClick={() => openEditForm(selectedContact)}
                            title="Edit contact"
                          >
                            ✏️
                          </button>
                          <button 
                            className="action-btn delete-btn"
                            onClick={() => deleteContact(selectedContact.id)}
                            title="Delete contact"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Notes Section */}
                    {selectedContact.notes && selectedContact.notes.trim() !== '' && selectedContact.notes !== 'Nothing' && (
                      <>
                        <div className="section-divider"></div>
                        <div className="notes-section">
                          <h3 className="section-title">Notes</h3>
                          <div className="notes-content">
                            <p className="notes-text">{selectedContact.notes}</p>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Touchpoints Section */}
                    <div className="section-divider"></div>
                    <div className="touchpoints-section-redesigned">
                      <div className="touchpoints-header">
                        <div className="section-title">
                          <span className="section-icon">💬</span>
                          <span>Touchpoints ({selectedContact.touchpoints.length})</span>
                        </div>
                        <button 
                          className="add-touchpoint-btn-new"
                          onClick={openCreateTouchpoint}
                        >
                          + Add
                        </button>
                      </div>
                      
                      <div className="touchpoints-list">
                        {selectedContact.touchpoints.length === 0 ? (
                          <div className="touchpoints-empty">
                            <p>No touchpoints yet</p>
                            <span>Add your first interaction with this contact</span>
                          </div>
                        ) : (
                          selectedContact.touchpoints
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .map((touchpoint) => (
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
                                      {touchpoint.source.charAt(0) + touchpoint.source.slice(1).toLowerCase().replace('_', ' ')}
                                    </span>
                                    <span className="touchpoint-time">
                                      {formatActivityTime(touchpoint.createdAt)}
                                    </span>
                                    <div className="touchpoint-actions">
                                      <button 
                                        className="touchpoint-edit-btn"
                                        onClick={() => openEditTouchpoint(touchpoint)}
                                        title="Edit touchpoint"
                                      >
                                        ✏️
                                      </button>
                                      <button 
                                        className="touchpoint-delete-btn"
                                        onClick={() => deleteTouchpoint(touchpoint.id)}
                                        title="Delete touchpoint"
                                      >
                                        🗑️
                                      </button>
                                    </div>
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
              </div>
            )}

        {/* Create Contact Form Modal */}
        {showCreateForm && (
          <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingContact ? 'Edit Contact' : 'Add New Contact'}</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowCreateForm(false)}
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleFormSubmit} className="contact-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="form-group">
                    <label>Company</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Company name"
                    />
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

                  <div className="form-group">
                    <label>Primary Email *</label>
                    <input
                      type="email"
                      value={formData.primaryEmail}
                      onChange={(e) => setFormData({ ...formData, primaryEmail: e.target.value })}
                      required
                      placeholder="john@company.com"
                    />
                  </div>

                  <div className="form-group">
                    <label>Secondary Email</label>
                    <input
                      type="email"
                      value={formData.secondaryEmail}
                      onChange={(e) => setFormData({ ...formData, secondaryEmail: e.target.value })}
                      placeholder="john.personal@gmail.com"
                    />
                  </div>

                  <div className="form-group">
                    <label>Primary Phone</label>
                    <input
                      type="tel"
                      value={formData.primaryPhone}
                      onChange={(e) => setFormData({ ...formData, primaryPhone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>

                  <div className="form-group">
                    <label>Secondary Phone</label>
                    <input
                      type="tel"
                      value={formData.secondaryPhone}
                      onChange={(e) => setFormData({ ...formData, secondaryPhone: e.target.value })}
                      placeholder="+1 (555) 987-6543"
                    />
                  </div>

                  <div className="form-group">
                    <label>Industry</label>
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      placeholder="Technology, Healthcare, Finance..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Website</label>
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="company.com or https://company.com"
                    />
                  </div>

                  <div className="form-group">
                    <label>Source</label>
                    <input
                      type="text"
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      placeholder="Website, Referral, Social Media..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Sentiment</label>
                    <select 
                      value={formData.sentiment}
                      onChange={(e) => setFormData({ ...formData, sentiment: e.target.value as any })}
                    >
                      <option value="NEUTRAL">😐 Neutral</option>
                      <option value="GOOD">😊 Good</option>
                      <option value="BAD">😞 Bad</option>
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label>Address</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={2}
                      placeholder="123 Main St, City, State 12345"
                    />
                  </div>

                  <div className="form-group">
                    <label>LinkedIn URL</label>
                    <input
                      type="url"
                      value={formData.linkedinUrl}
                      onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                      placeholder="https://linkedin.com/in/username"
                    />
                  </div>

                  <div className="form-group">
                    <label>Facebook URL</label>
                    <input
                      type="url"
                      value={formData.facebookUrl}
                      onChange={(e) => setFormData({ ...formData, facebookUrl: e.target.value })}
                      placeholder="https://facebook.com/username"
                    />
                  </div>

                  <div className="form-group">
                    <label>Instagram URL</label>
                    <input
                      type="url"
                      value={formData.instagramUrl}
                      onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                      placeholder="https://instagram.com/username"
                    />
                  </div>

                  <div className="form-group">
                    <label>YouTube URL</label>
                    <input
                      type="url"
                      value={formData.youtubeUrl}
                      onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                      placeholder="https://youtube.com/channel/..."
                    />
                  </div>

                  <div className="form-group">
                    <label>TikTok URL</label>
                    <input
                      type="url"
                      value={formData.tiktokUrl}
                      onChange={(e) => setFormData({ ...formData, tiktokUrl: e.target.value })}
                      placeholder="https://tiktok.com/@username"
                    />
                  </div>
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
                    {editingContact ? 'Update Contact' : 'Add Contact'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Touchpoint Form Modal */}
        {showTouchpointForm && selectedContact && (
          <div className="modal-overlay" onClick={() => setShowTouchpointForm(false)}>
            <div className="modal-content touchpoint-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{touchpointData.id ? 'Edit Touchpoint' : `Add Touchpoint for ${selectedContact.name}`}</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowTouchpointForm(false)}
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleTouchpointSubmit} className="touchpoint-form">
                <div className="form-section">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Touchpoint Type *</label>
                      <select
                        value={touchpointData.source}
                        onChange={(e) => setTouchpointData({ 
                          ...touchpointData, 
                          source: e.target.value as 'MANUAL' | 'EMAIL' | 'SMS' | 'PHONE' | 'IN_PERSON' | 'EVENT' | 'OTHER'
                        })}
                        required
                      >
                        <option value="MANUAL">📝 Manual Note</option>
                        <option value="EMAIL">📧 Email</option>
                        <option value="SMS">💬 SMS</option>
                        <option value="PHONE">📞 Phone Call</option>
                        <option value="IN_PERSON">👥 In Person</option>
                        <option value="EVENT">🎯 Event</option>
                        <option value="OTHER">📋 Other</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Date *</label>
                      <input
                        type="date"
                        value={new Date().toISOString().split('T')[0]}
                        disabled
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Notes *</label>
                    <textarea
                      value={touchpointData.note}
                      onChange={(e) => setTouchpointData({ ...touchpointData, note: e.target.value })}
                      required
                      rows={6}
                      placeholder="Describe the interaction with this contact..."
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="cancel-btn"
                    onClick={() => setShowTouchpointForm(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="submit-btn">
                    {touchpointData.id ? 'Update Touchpoint' : 'Add Touchpoint'}
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
