import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Login from './Login';
import './App.css';
import { API_CONFIG, type ContactStatus, type TouchpointSource } from './config';

// Configure axios to send cookies
axios.defaults.withCredentials = true;

// Add request timeout
axios.defaults.timeout = API_CONFIG.TIMEOUT;

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

interface RecentTouchpoint {
  id: number;
  note: string;
  source: TouchpointSource;
  createdAt: string;
  contact: {
    id: number;
    name: string;
    primaryEmail: string;
    company?: string;
    status: ContactStatus;
  };
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
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('All Owners');
  const [timeFilter, setTimeFilter] = useState<string>('All Time');
  const [recentActivityFilter, setRecentActivityFilter] = useState<string>('All Activity');
  
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
      
      if (user) {
        // Load data in parallel for better performance
        Promise.all([
          fetchContacts()
        ]);
      }
    };

    initializeApp();
  }, []); // Empty dependency array since we want this to run once on mount

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/auth/me`);
      setUser(response.data.user);
    } catch (err) {
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

  // Filter and sort contacts
  const filteredContacts = contacts.filter(contact => {
    try {
      const matchesSearch = contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (contact.primaryEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.secondaryEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.website?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.address?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'ALL' || contact.status === statusFilter;
    
    const matchesOwner = ownerFilter === 'All Owners' || contact.user.name === ownerFilter;
    
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
    
    // Recent Activity filter based on latest touchpoint
    let matchesActivityFilter = true;
    if (recentActivityFilter !== 'All Activity') {
      const latestTouchpoint = contact.touchpoints?.length > 0 ? 
        contact.touchpoints.reduce((latest, current) => 
          new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
        ) : null;
      
      if (latestTouchpoint) {
        const touchpointDate = new Date(latestTouchpoint.createdAt);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - touchpointDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (recentActivityFilter) {
          case 'Last Week':
            matchesActivityFilter = diffDays <= 7;
            break;
          case 'Last 28 Days':
            matchesActivityFilter = diffDays <= 28;
            break;
          case 'Last 6 Months':
            matchesActivityFilter = diffDays <= 180;
            break;
          case 'Last 12 Months':
            matchesActivityFilter = diffDays <= 365;
            break;
          case 'No Activity':
            matchesActivityFilter = false;
            break;
        }
      } else {
        // No touchpoints
        matchesActivityFilter = recentActivityFilter === 'No Activity';
      }
    }
    
      return matchesSearch && matchesStatus && matchesOwner && matchesTimeFilter && matchesActivityFilter;
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
          <button 
            className="nav-item active"
          >
            All Contacts
          </button>
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
          <button 
            className="nav-action-btn refresh-btn"
            onClick={() => {
              fetchContacts();
              fetchRecentTouchpoints();
            }}
            title="Refresh data"
            disabled={isContactsLoading || isTouchpointsLoading}
          >
            🔄 Refresh
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
              className="stat-card churned"
              onClick={() => setStatusFilter('CHURNED')}
            >
              <div className="stat-number">{churnedCount}</div>
              <div className="stat-label">CHURNED</div>
              <div className="stat-growth">+100% 28d</div>
            </div>
            <div 
              className="stat-card declined"
              onClick={() => setStatusFilter('DECLINED')}
            >
              <div className="stat-number">{declinedCount}</div>
              <div className="stat-label">DECLINED</div>
              <div className="stat-growth">+100% 28d</div>
            </div>
            <div 
              className="stat-card unqualified"
              onClick={() => setStatusFilter('UNQUALIFIED')}
            >
              <div className="stat-number">{disqualifiedCount}</div>
              <div className="stat-label">DISQUALIFIED</div>
              <div className="stat-growth">+100% 28d</div>
            </div>
            <div 
              className="stat-card prospects highlight"
              onClick={() => setStatusFilter('PROSPECT')}
            >
              <div className="stat-number">{prospectCount}</div>
              <div className="stat-label">PROSPECTS</div>
              <div className="stat-growth">+100% 28d</div>
            </div>
            <div 
              className="stat-card leads"
              onClick={() => setStatusFilter('LEAD')}
            >
              <div className="stat-number">{leadCount}</div>
              <div className="stat-label">LEADS</div>
              <div className="stat-growth">+100% 28d</div>
            </div>
            <div 
              className="stat-card opportunities"
              onClick={() => setStatusFilter('OPPORTUNITY')}
            >
              <div className="stat-number">{opportunityCount}</div>
              <div className="stat-label">OPPORTUNITIES</div>
              <div className="stat-growth">+100% 28d</div>
            </div>
            <div 
              className="stat-card clients"
              onClick={() => setStatusFilter('CLIENT')}
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
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="status-filter-dropdown"
                  >
                    <option value="ALL">All Contacts ({contacts.length})</option>
                    <option value="PROSPECT">Prospects ({prospectCount})</option>
                    <option value="LEAD">Leads ({leadCount})</option>
                    <option value="OPPORTUNITY">Opportunities ({opportunityCount})</option>
                    <option value="CLIENT">Clients ({clientCount})</option>
                    <option value="UNQUALIFIED">Unqualified ({disqualifiedCount})</option>
                    <option value="DECLINED">Declined ({declinedCount})</option>
                    <option value="CHURNED">Churned ({churnedCount})</option>
                  </select>
                  <select 
                    value={ownerFilter} 
                    onChange={(e) => setOwnerFilter(e.target.value)}
                  >
                    <option>All Owners</option>
                    {Array.from(new Set(contacts.map(contact => contact.user.name))).map(owner => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
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
                  <select 
                    value={recentActivityFilter} 
                    onChange={(e) => setRecentActivityFilter(e.target.value)}
                  >
                    <option>All Activity</option>
                    <option value="Last Week">Active Last Week</option>
                    <option value="Last 28 Days">Active Last 28 Days</option>
                    <option value="Last 6 Months">Active Last 6 Months</option>
                    <option value="Last 12 Months">Active Last 12 Months</option>
                    <option value="No Activity">No Activity</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="contacts-layout">
              {/* Contacts Table - Full Width */}
              <div className="contacts-table-container">
                <div className="contacts-table-header">
                  <div className="table-info">
                    <span className="contacts-count">
                      {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
                      {statusFilter !== 'ALL' && ` • Filtered by ${getStatusLabel(statusFilter)}`}
                    </span>
                  </div>
                  <div className="table-actions">
                    <button 
                      className="refresh-table-btn"
                      onClick={() => {
                        fetchContacts();
                        fetchRecentTouchpoints();
                      }}
                      title="Refresh contacts"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                </div>
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
                    {/* Head Section: Name, Contact, Status, Actions, Source, Added */}
                    <div className="contact-head-section">
                      <div className="contact-avatar-large">
                        {selectedContact.name.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="contact-essential-info">
                        <h2 className="contact-name-primary">{selectedContact.name}</h2>
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

                    {/* Company Section */}
                    {(selectedContact.company || selectedContact.industry || selectedContact.website || selectedContact.address || (selectedContact.notes && selectedContact.notes.trim() !== '' && selectedContact.notes !== 'Nothing')) && (
                      <>
                        <div className="section-divider"></div>
                        <div className="contact-company-section">
                          <div className="company-main-info">
                            {selectedContact.company && (
                              <h3 className="company-name">{selectedContact.company}</h3>
                            )}
                             {selectedContact.address && (
                                <div className="company-detail">
                                  <span className="detail-value">{selectedContact.address}</span>
                                </div>
                              )}
                            <div className="company-details">
                              {selectedContact.website && (
                                <div className="company-detail">
                                  <span className="detail-value">
                                    <a href={selectedContact.website.startsWith('http') ? selectedContact.website : `https://${selectedContact.website}`} target="_blank" rel="noopener noreferrer">
                                      {selectedContact.website}
                                    </a>
                                  </span>
                                </div>
                              )}
                              {selectedContact.industry && (
                                <div className="company-detail">
                                  <span className="detail-value">{selectedContact.industry}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Notes on the right side */}
                          {selectedContact.notes && selectedContact.notes.trim() !== '' && selectedContact.notes !== 'Nothing' && (
                            <div className="company-notes">
                              <p className="notes-text">{selectedContact.notes}</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Social Media & Scores Section */}
                    {(selectedContact.linkedinUrl || selectedContact.facebookUrl || selectedContact.instagramUrl || selectedContact.youtubeUrl || selectedContact.tiktokUrl || selectedContact.sentiment || selectedContact.leadScore || selectedContact.opportunityScore) && (
                      <>
                        <div className="section-divider"></div>
                        <div className="contact-social-section">
                          
                          {/* Social Media Links */}
                          {(selectedContact.linkedinUrl || selectedContact.facebookUrl || selectedContact.instagramUrl || selectedContact.youtubeUrl || selectedContact.tiktokUrl) && (
                            <div className="social-media-links">
                              <h4 className="subsection-title">Social Media</h4>
                              <div className="social-links-grid">
                                {selectedContact.linkedinUrl && (
                                  <a href={selectedContact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="social-link linkedin">
                                    🔗 LinkedIn
                                  </a>
                                )}
                                {selectedContact.facebookUrl && (
                                  <a href={selectedContact.facebookUrl} target="_blank" rel="noopener noreferrer" className="social-link facebook">
                                    📘 Facebook
                                  </a>
                                )}
                                {selectedContact.instagramUrl && (
                                  <a href={selectedContact.instagramUrl} target="_blank" rel="noopener noreferrer" className="social-link instagram">
                                    📸 Instagram
                                  </a>
                                )}
                                {selectedContact.youtubeUrl && (
                                  <a href={selectedContact.youtubeUrl} target="_blank" rel="noopener noreferrer" className="social-link youtube">
                                    📺 YouTube
                                  </a>
                                )}
                                {selectedContact.tiktokUrl && (
                                  <a href={selectedContact.tiktokUrl} target="_blank" rel="noopener noreferrer" className="social-link tiktok">
                                    🎵 TikTok
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* CRM Metrics */}
                          {(selectedContact.sentiment || selectedContact.leadScore || selectedContact.opportunityScore) && (
                            <div className="crm-metrics">
                              <h4 className="subsection-title">CRM Metrics</h4>
                              <div className="metrics-grid">
                                {selectedContact.sentiment && (
                                  <div className="metric-item">
                                    <span className="metric-label">Sentiment:</span>
                                    <span className={`metric-value sentiment-${selectedContact.sentiment.toLowerCase()}`}>
                                      {selectedContact.sentiment === 'GOOD' ? '😊 Good' : 
                                       selectedContact.sentiment === 'NEUTRAL' ? '😐 Neutral' : '😞 Bad'}
                                    </span>
                                  </div>
                                )}
                                {selectedContact.leadScore !== undefined && selectedContact.leadScore !== null && (
                                  <div className="metric-item">
                                    <span className="metric-label">Lead Score:</span>
                                    <span className="metric-value">{Number(selectedContact.leadScore).toFixed(2)}</span>
                                  </div>
                                )}
                                {selectedContact.opportunityScore !== undefined && selectedContact.opportunityScore !== null && (
                                  <div className="metric-item">
                                    <span className="metric-label">Opportunity Score:</span>
                                    <span className="metric-value">{Number(selectedContact.opportunityScore).toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
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
                {/* Basic Information Section */}
                <div className="form-section">
                  <h3 className="form-section-title">Basic Information</h3>
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
                  </div>
                </div>

                {/* Contact Methods Section */}
                <div className="form-section">
                  <h3 className="form-section-title">Contact Methods</h3>
                  <div className="form-grid">
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
                      <Tooltip text="Optional alternative email address (personal, backup, etc.)">
                        <label>Secondary Email</label>
                      </Tooltip>
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
                  </div>
                </div>

                {/* Business Information Section */}
                <div className="form-section">
                  <h3 className="form-section-title">Business Information</h3>
                  <div className="form-grid">

                    <div className="form-group">
                      <Tooltip text="Select the primary industry this contact operates in">
                        <label>Industry</label>
                      </Tooltip>
                      <select
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      >
                        <option value="">Select industry...</option>
                        <option value="Technology">Technology</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Finance">Finance</option>
                        <option value="Education">Education</option>
                        <option value="Construction">Construction</option>
                        <option value="Manufacturing">Manufacturing</option>
                        <option value="Retail">Retail</option>
                        <option value="Consulting">Consulting</option>
                        <option value="Real Estate">Real Estate</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Other">Other</option>
                      </select>
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

                    <div className="form-group full-width">
                      <label>Address</label>
                      <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        rows={2}
                        placeholder="123 Main St, City, State 12345"
                      />
                    </div>
                  </div>
                </div>

                {/* Social Media Section */}
                <div className="form-section">
                  <h3 className="form-section-title">Social Media & Online Presence</h3>
                  <div className="form-grid">

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
                </div>

                {/* CRM Information Section */}
                <div className="form-section">
                  <h3 className="form-section-title">CRM Information</h3>
                  <div className="form-grid">

                    <div className="form-group">
                      <Tooltip text="How did you first discover or meet this contact?">
                        <label>Source</label>
                      </Tooltip>
                      <select 
                        value={formData.source}
                        onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      >
                        <option value="">How did you find this contact?</option>
                        <option value="WEBSITE">Website</option>
                        <option value="REFERRAL">Referral</option>
                        <option value="SOCIAL_MEDIA">Social Media</option>
                        <option value="EMAIL">Email Campaign</option>
                        <option value="PHONE">Phone Call</option>
                        <option value="EVENT">Event</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Status</label>
                      <select 
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      >
                        <option value="PROSPECT">Prospects</option>
                        <option value="LEAD">Leads</option>
                        <option value="OPPORTUNITY">Opportunities</option>
                        <option value="CLIENT">Clients</option>
                        <option value="UNQUALIFIED">Unqualified</option>
                        <option value="DECLINED">Declined</option>
                        <option value="CHURNED">Churned</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <Tooltip text="Overall sentiment or relationship quality with this contact">
                        <label>Sentiment</label>
                      </Tooltip>
                      <select 
                        value={formData.sentiment}
                        onChange={(e) => setFormData({ ...formData, sentiment: e.target.value as any })}
                      >
                        <option value="GOOD">😊 Good</option>
                        <option value="NEUTRAL">😐 Neutral</option>
                        <option value="BAD">😞 Bad</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <Tooltip text="Lead quality score from 0.00 to 1.00 (0 = poor, 1 = excellent)">
                        <label>Lead Score</label>
                      </Tooltip>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={formData.leadScore}
                        onChange={(e) => setFormData({ ...formData, leadScore: e.target.value })}
                        placeholder="0.75"
                      />
                    </div>

                    <div className="form-group">
                      <Tooltip text="Opportunity potential score from 0.00 to 1.00 (0 = low, 1 = high potential)">
                        <label>Opportunity Score</label>
                      </Tooltip>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={formData.opportunityScore}
                        onChange={(e) => setFormData({ ...formData, opportunityScore: e.target.value })}
                        placeholder="0.80"
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
