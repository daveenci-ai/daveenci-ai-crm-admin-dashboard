import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Login from './Login';
import './App.css';

// Configure axios to send cookies
axios.defaults.withCredentials = true;

// Add request timeout
axios.defaults.timeout = 10000; // 10 seconds

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
  source?: string;
  status: 'PROSPECTS' | 'QUALIFIED_LEADS' | 'OPPORTUNITIES' | 'CONVERTED_CLIENTS' | 'DISQUALIFIED_LEADS' | 'DECLINED_OPPORTUNITIES' | 'CHURNED_CLIENTS';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  touchpoints: Touchpoint[];
  user: {
    id: number;
    name: string;
    email: string;
  };
  // Legacy fields for backward compatibility
  email?: string;
  phone?: string;
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
    primaryEmail: string;
    company?: string;
    status: 'PROSPECTS' | 'QUALIFIED_LEADS' | 'OPPORTUNITIES' | 'CONVERTED_CLIENTS' | 'DISQUALIFIED_LEADS' | 'DECLINED_OPPORTUNITIES' | 'CHURNED_CLIENTS';
  };
}

const API_BASE_URL = 'https://daveenci-ai-crm-admin-dashboard.onrender.com/api';

type ViewType = 'dashboard' | 'contacts' | 'email-campaigns' | 'calendar';

// Cache utilities
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCachedData = (key: string) => {
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch (error) {
    console.error('Error reading cache:', error);
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
    console.error('Error setting cache:', error);
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
  const [recentTouchpoints, setRecentTouchpoints] = useState<RecentTouchpoint[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isContactsLoading, setIsContactsLoading] = useState(true);
  const [isTouchpointsLoading, setIsTouchpointsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Progressive loading state
  const [hasInitialData, setHasInitialData] = useState(false);
  
  // Contact filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All Types');
  const [ownerFilter, setOwnerFilter] = useState<string>('All Owners');
  const [timeFilter, setTimeFilter] = useState<string>('All Time');
  const [recentActivityFilter, setRecentActivityFilter] = useState<string>('All Activity');
  
  // Dashboard breakdown filters
  const [breakdownType, setBreakdownType] = useState<string>('Industry');
  const [breakdownPeriod, setBreakdownPeriod] = useState<string>('All Time');
  const [breakdownContactFilter, setBreakdownContactFilter] = useState<string>('All Contacts');

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
    source: string;
    status: 'PROSPECTS' | 'QUALIFIED_LEADS' | 'OPPORTUNITIES' | 'CONVERTED_CLIENTS' | 'DISQUALIFIED_LEADS' | 'DECLINED_OPPORTUNITIES' | 'CHURNED_CLIENTS';
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
    source: '',
    status: 'PROSPECTS',
    notes: ''
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);

  // Touchpoint form state
  const [showTouchpointForm, setShowTouchpointForm] = useState(false);
  const [isEditingTouchpoint, setIsEditingTouchpoint] = useState(false);
  const [editingTouchpointId, setEditingTouchpointId] = useState<number | null>(null);
  const [touchpointData, setTouchpointData] = useState({
    note: '',
    source: 'MANUAL' as 'MANUAL' | 'EMAIL' | 'SMS' | 'PHONE' | 'IN_PERSON' | 'EVENT' | 'OTHER',
    date: new Date().toISOString().split('T')[0] // Default to today's date
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
      // Load cached data first for instant UI
      const cachedContacts = getCachedData('contacts');
      const cachedTouchpoints = getCachedData('touchpoints');
      
      if (cachedContacts) {
        setContacts(cachedContacts);
        setIsContactsLoading(false);
        setHasInitialData(true);
      }
      
      if (cachedTouchpoints) {
        setRecentTouchpoints(cachedTouchpoints);
        setIsTouchpointsLoading(false);
      }
      
      // Then fetch fresh data in parallel
      Promise.all([
        fetchContacts(),
        fetchRecentTouchpoints()
      ]).catch(err => {
        console.error('Error loading data:', err);
        setError('Failed to load data. Please try refreshing the page.');
      });
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

  const fetchContacts = useCallback(async (retryCount = 0) => {
    try {
      setIsContactsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/contacts`);
      setContacts(response.data);
      setCachedData('contacts', response.data);
      setHasInitialData(true);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Error fetching contacts:', err);
      
      // Retry logic for network errors
      if (retryCount < 2 && axios.isAxiosError(err) && (!err.response || err.response.status >= 500)) {
        console.log(`Retrying contacts fetch (attempt ${retryCount + 1})`);
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
      const response = await axios.get(`${API_BASE_URL}/touchpoints/recent?limit=10`);
      setRecentTouchpoints(response.data);
      setCachedData('touchpoints', response.data);
    } catch (err) {
      console.error('Error fetching recent touchpoints:', err);
      
      // Retry logic for network errors
      if (retryCount < 2 && axios.isAxiosError(err) && (!err.response || err.response.status >= 500)) {
        console.log(`Retrying touchpoints fetch (attempt ${retryCount + 1})`);
        setTimeout(() => fetchRecentTouchpoints(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
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
      contact.primaryEmail || contact.email || '',
      contact.secondaryEmail || '',
      contact.primaryPhone || contact.phone || '',
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
      const response = await axios.post(`${API_BASE_URL}/contacts`, formData);
      setContacts([response.data, ...contacts]);
      resetForm();
      setCurrentView('contacts');
    } catch (err) {
      setError('Failed to create contact');
      console.error('Error creating contact:', err);
    }
  };

  const updateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingContactId) return;
    
    try {
      const response = await axios.put(`${API_BASE_URL}/contacts/${editingContactId}`, formData);
      setContacts(contacts.map(c => c.id === editingContactId ? response.data : c));
      
      // Update selected contact if it's the one being edited
      if (selectedContact?.id === editingContactId) {
        setSelectedContact(response.data);
      }
      
      resetForm();
    } catch (err) {
      setError('Failed to update contact');
      console.error('Error updating contact:', err);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    if (isEditMode) {
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
      source: '',
      status: 'PROSPECTS',
      notes: ''
    });
    setShowCreateForm(false);
    setIsEditMode(false);
    setEditingContactId(null);
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
      source: contact.source || '',
      status: contact.status,
      notes: contact.notes || ''
    });
    setIsEditMode(true);
    setEditingContactId(contact.id);
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
      
      const response = await axios.post(`${API_BASE_URL}/contacts/${selectedContact.id}/touchpoints`, createData);
      
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
    
    if (!selectedContact || !editingTouchpointId) return;
    
    try {
      // Only send note and source to backend (date is not supported for updates)
      const updateData = {
        note: touchpointData.note,
        source: touchpointData.source
      };
      
      const response = await axios.put(`${API_BASE_URL}/touchpoints/${editingTouchpointId}`, updateData);
      
      // Update the contact's touchpoints in the local state
      const updatedContact = {
        ...selectedContact,
        touchpoints: selectedContact.touchpoints.map(t => 
          t.id === editingTouchpointId ? response.data : t
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
    if (isEditingTouchpoint) {
      updateTouchpoint(e);
    } else {
      createTouchpoint(e);
    }
  };

  const resetTouchpointForm = () => {
    setTouchpointData({ 
      note: '', 
      source: 'MANUAL',
      date: new Date().toISOString().split('T')[0]
    });
    setShowTouchpointForm(false);
    setIsEditingTouchpoint(false);
    setEditingTouchpointId(null);
  };

  const openEditTouchpoint = (touchpoint: any) => {
    setTouchpointData({
      note: touchpoint.note,
      source: touchpoint.source,
      date: touchpoint.createdAt.split('T')[0] // Use the touchpoint's date
    });
    setIsEditingTouchpoint(true);
    setEditingTouchpointId(touchpoint.id);
    setShowTouchpointForm(true);
  };

  const openCreateTouchpoint = () => {
    resetTouchpointForm();
    setShowTouchpointForm(true);
  };

  const deleteTouchpoint = async (touchpointId: number) => {
    if (!selectedContact || !window.confirm('Are you sure you want to delete this touchpoint?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/touchpoints/${touchpointId}`);
      
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
      await axios.delete(`${API_BASE_URL}/contacts/${contactId}`);
      setContacts(contacts.filter(c => c.id !== contactId));
    } catch (err) {
      setError('Failed to delete contact');
      console.error('Error deleting contact:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROSPECTS': return '#8FA4D4';           // Light blue
      case 'QUALIFIED_LEADS': return '#F6D479';     // Yellow  
      case 'OPPORTUNITIES': return '#F4A261';       // Orange
      case 'CONVERTED_CLIENTS': return '#7BC47F';   // Green
      case 'DISQUALIFIED_LEADS': return '#A9A9A9';  // Gray
      case 'DECLINED_OPPORTUNITIES': return '#D32F2F'; // Red
      case 'CHURNED_CLIENTS': return '#000000';     // Black
      default: return '#6b7280'; // Gray
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PROSPECTS': return 'Prospects';
      case 'QUALIFIED_LEADS': return 'Qualified Leads';
      case 'OPPORTUNITIES': return 'Opportunities';
      case 'CONVERTED_CLIENTS': return 'Converted Clients';
      case 'DISQUALIFIED_LEADS': return 'Disqualified Leads';
      case 'DECLINED_OPPORTUNITIES': return 'Declined Opportunities';
      case 'CHURNED_CLIENTS': return 'Churned Clients';
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

  // Calculate dashboard stats
  const totalLeads = contacts.length;
  const convertedLeads = contacts.filter(contact => contact.status === 'CONVERTED_CLIENTS').length;

  // Calculate funnel data
  const prospectCount = contacts.filter(c => c.status === 'PROSPECTS').length;
  const leadCount = contacts.filter(c => c.status === 'QUALIFIED_LEADS').length;
  const opportunityCount = contacts.filter(c => c.status === 'OPPORTUNITIES').length;
  const clientCount = contacts.filter(c => c.status === 'CONVERTED_CLIENTS').length;
  const disqualifiedCount = contacts.filter(c => c.status === 'DISQUALIFIED_LEADS').length;
  const declinedCount = contacts.filter(c => c.status === 'DECLINED_OPPORTUNITIES').length;
  const churnedCount = contacts.filter(c => c.status === 'CHURNED_CLIENTS').length;

  // Calculate new contacts (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newContacts = contacts.filter(contact => new Date(contact.createdAt) >= sevenDaysAgo);

  // Calculate 28-day growth for each stage
  const twentyEightDaysAgo = new Date();
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
  
  const newProspects28Days = contacts.filter(contact => 
    contact.status === 'PROSPECTS' && new Date(contact.createdAt) >= twentyEightDaysAgo
  ).length;
  
  const newLeads28Days = contacts.filter(contact => 
    contact.status === 'QUALIFIED_LEADS' && new Date(contact.createdAt) >= twentyEightDaysAgo
  ).length;
  
  const newOpportunities28Days = contacts.filter(contact => 
    contact.status === 'OPPORTUNITIES' && new Date(contact.createdAt) >= twentyEightDaysAgo
  ).length;
  
  const newClients28Days = contacts.filter(contact => 
    contact.status === 'CONVERTED_CLIENTS' && new Date(contact.createdAt) >= twentyEightDaysAgo
  ).length;

  const newDisqualified28Days = contacts.filter(contact => 
    contact.status === 'DISQUALIFIED_LEADS' && new Date(contact.createdAt) >= twentyEightDaysAgo
  ).length;

  const newDeclined28Days = contacts.filter(contact => 
    contact.status === 'DECLINED_OPPORTUNITIES' && new Date(contact.createdAt) >= twentyEightDaysAgo
  ).length;

  const newChurned28Days = contacts.filter(contact => 
    contact.status === 'CHURNED_CLIENTS' && new Date(contact.createdAt) >= twentyEightDaysAgo
  ).length;

  // Calculate growth percentages (dummy calculation for now since we don't have historical data)
  const prospectGrowth = prospectCount > 0 ? Math.min(Math.round((newProspects28Days / prospectCount) * 100), 100) : 0;
  const leadGrowth = leadCount > 0 ? Math.min(Math.round((newLeads28Days / leadCount) * 100), 100) : 0;
  const opportunityGrowth = opportunityCount > 0 ? Math.min(Math.round((newOpportunities28Days / opportunityCount) * 100), 100) : 0;
  const clientGrowth = clientCount > 0 ? Math.min(Math.round((newClients28Days / clientCount) * 100), 100) : 0;
  const disqualifiedGrowth = disqualifiedCount > 0 ? Math.min(Math.round((newDisqualified28Days / disqualifiedCount) * 100), 100) : 0;
  const declinedGrowth = declinedCount > 0 ? Math.min(Math.round((newDeclined28Days / declinedCount) * 100), 100) : 0;
  const churnedGrowth = churnedCount > 0 ? Math.min(Math.round((newChurned28Days / churnedCount) * 100), 100) : 0;

  // Calculate breakdown data based on filters
  const getBreakdownData = () => {
    // First filter contacts by time period
    let breakdownContacts = contacts;
    if (breakdownPeriod !== 'All Time') {
      const now = new Date();
      let daysBack = 0;
      switch (breakdownPeriod) {
        case 'Last 7 Days': daysBack = 7; break;
        case 'Last 28 Days': daysBack = 28; break;
        case 'Last 3 Months': daysBack = 90; break;
        case 'Last 6 Months': daysBack = 180; break;
        case 'Last 12 Months': daysBack = 365; break;
      }
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      breakdownContacts = contacts.filter(contact => new Date(contact.createdAt) >= cutoffDate);
    }

    // Then filter by contact type
    if (breakdownContactFilter !== 'All Contacts') {
      const statusMap = {
        'Prospects': 'PROSPECTS',
        'Qualified Leads': 'QUALIFIED_LEADS', 
        'Opportunities': 'OPPORTUNITIES',
        'Converted Clients': 'CONVERTED_CLIENTS',
        'Disqualified Leads': 'DISQUALIFIED_LEADS',
        'Declined Opportunities': 'DECLINED_OPPORTUNITIES',
        'Churned Clients': 'CHURNED_CLIENTS'
      };
      const targetStatus = statusMap[breakdownContactFilter as keyof typeof statusMap];
      if (targetStatus) {
        breakdownContacts = breakdownContacts.filter(contact => contact.status === targetStatus);
      }
    }

    // Group by breakdown type and calculate percentages
    const counts: { [key: string]: number } = {};
    const total = breakdownContacts.length;

    if (total === 0) return [];

    breakdownContacts.forEach(contact => {
      let key = '';
      switch (breakdownType) {
        case 'Industry':
          key = contact.industry || 'Not specified';
          break;
        case 'Source':
          key = contact.source || 'Not specified';
          break;
        case 'Status':
          key = getStatusLabel(contact.status);
          break;
        case 'Location':
          // Extract city/state from address, or use "Not specified"
          if (contact.address) {
            const addressParts = contact.address.split(',');
            key = addressParts.length > 1 ? addressParts[addressParts.length - 1].trim() : contact.address;
          } else {
            key = 'Not specified';
          }
          break;
        default:
          key = 'Unknown';
      }
      counts[key] = (counts[key] || 0) + 1;
    });

    // Convert to array and sort by count
    const results = Object.entries(counts)
      .map(([label, count]) => ({
        label,
        count,
        percentage: ((count / total) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6); // Show top 6 categories

    return results;
  };

  const breakdownData = getBreakdownData();

  // Get colors for breakdown stats
  const getBreakdownColor = (index: number) => {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
    return colors[index % colors.length];
  };

  // Generate upcoming events (mock data for now)
  const getUpcomingEvents = () => {
    const events = [];
    const today = new Date();
    
    // Generate 10 mock events over the next 14 days
    const eventTypes = [
      { title: 'Follow-up call', location: '📞 Phone Call', icon: '📞' },
      { title: 'Product demo', location: '💻 Virtual Meeting', icon: '💻' },
      { title: 'Client meeting', location: '📍 Conference Room', icon: '🤝' },
      { title: 'Sales presentation', location: '🏢 Client Office', icon: '📊' },
      { title: 'Contract review', location: '📞 Phone Call', icon: '📄' },
      { title: 'Quarterly check-in', location: '💻 Zoom Meeting', icon: '📈' },
      { title: 'Project kickoff', location: '📍 Meeting Room B', icon: '🚀' },
      { title: 'Training session', location: '💻 Virtual Training', icon: '🎓' },
      { title: 'Proposal discussion', location: '📞 Conference Call', icon: '💼' },
      { title: 'Partnership meeting', location: '🏢 Partner Office', icon: '🤝' }
    ];

    const times = [
      '9:00 AM - 10:00 AM',
      '10:30 AM - 11:30 AM', 
      '1:00 PM - 2:00 PM',
      '2:30 PM - 3:30 PM',
      '3:30 PM - 4:30 PM',
      '4:00 PM - 5:00 PM'
    ];

    // Create some contacts that have opportunities/leads for realistic events
    const potentialContacts = contacts.filter(c => 
      c.status === 'QUALIFIED_LEADS' || c.status === 'OPPORTUNITIES' || c.status === 'CONVERTED_CLIENTS'
    );

    for (let i = 0; i < 10; i++) {
      const eventDate = new Date(today);
      eventDate.setDate(today.getDate() + Math.floor(i / 2) + 1); // Spread over next 7 days
      
      const eventType = eventTypes[i];
      const contact = potentialContacts[i % Math.max(1, potentialContacts.length)];
      const time = times[i % times.length];
      
      events.push({
        id: `event-${i}`,
        title: contact ? `${eventType.title} with ${contact.name}` : eventType.title,
        location: eventType.location,
        time: time,
        date: eventDate,
        contact: contact
      });
    }
    
    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const upcomingEvents = getUpcomingEvents();

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.primaryEmail || contact.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.secondaryEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.website?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All Types' || contact.status === statusFilter;
    
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
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-item ${currentView === 'contacts' ? 'active' : ''}`}
            onClick={() => setCurrentView('contacts')}
          >
            All Contacts
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

      {/* Sales Pipeline Bar */}
      <div className="pipeline-bar">
        <div className="pipeline-container">
          {/* Inactive Pipeline - Left Side */}
          <div className="pipeline-group inactive-group">
            <div className="pipeline-card churned" onClick={() => setCurrentView('contacts')}>
              <div className="pipeline-number">{churnedCount}</div>
              <div className="pipeline-label">Churned</div>
              <div className="pipeline-growth">+{churnedGrowth}% 28d</div>
            </div>
            <div className="pipeline-card declined" onClick={() => setCurrentView('contacts')}>
              <div className="pipeline-number">{declinedCount}</div>
              <div className="pipeline-label">Declined</div>
              <div className="pipeline-growth">+{declinedGrowth}% 28d</div>
            </div>
            <div className="pipeline-card disqualified" onClick={() => setCurrentView('contacts')}>
              <div className="pipeline-number">{disqualifiedCount}</div>
              <div className="pipeline-label">Disqualified</div>
              <div className="pipeline-growth">+{disqualifiedGrowth}% 28d</div>
            </div>
          </div>

          {/* Pipeline Flow Arrows */}
          <div className="pipeline-flow">
            <div className="flow-arrow left">←</div>
            <div className="pipeline-card prospects center-card" onClick={() => setCurrentView('contacts')}>
              <div className="pipeline-number">{prospectCount}</div>
              <div className="pipeline-label">Prospects</div>
              <div className="pipeline-growth">+{prospectGrowth}% 28d</div>
            </div>
            <div className="flow-arrow right">→</div>
          </div>

          {/* Active Pipeline - Right Side */}
          <div className="pipeline-group active-group">
            <div className="pipeline-card leads" onClick={() => setCurrentView('contacts')}>
              <div className="pipeline-number">{leadCount}</div>
              <div className="pipeline-label">Leads</div>
              <div className="pipeline-growth">+{leadGrowth}% 28d</div>
            </div>
            <div className="pipeline-card opportunities" onClick={() => setCurrentView('contacts')}>
              <div className="pipeline-number">{opportunityCount}</div>
              <div className="pipeline-label">Opportunities</div>
              <div className="pipeline-growth">+{opportunityGrowth}% 28d</div>
            </div>
            <div className="pipeline-card clients" onClick={() => setCurrentView('contacts')}>
              <div className="pipeline-number">{clientCount}</div>
              <div className="pipeline-label">Clients</div>
              <div className="pipeline-growth">+{clientGrowth}% 28d</div>
            </div>
          </div>
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

            {/* Three Column Section */}
            <div className="dashboard-section">
              <div className="three-column-grid">
                {/* New Contacts Column */}
                <div className="column-section">
                  <div className="column-header">
                    <h3>New Contacts</h3>
                    <span className="column-subtitle">Last 7 Days</span>
                    {isContactsLoading && <div className="small-spinner"></div>}
                  </div>
                  <div className="column-content">
                    {isContactsLoading && contacts.length === 0 ? (
                      <div className="skeleton-loading">
                        <div className="skeleton-item"></div>
                        <div className="skeleton-item"></div>
                        <div className="skeleton-item"></div>
                      </div>
                    ) : newContacts.length === 0 ? (
                      <div className="empty-state-small">
                        <p>No new contacts this week</p>
                        <span>Add contacts to see them here</span>
                      </div>
                    ) : (
                      newContacts.slice(0, 10).map((contact) => (
                        <div 
                          key={contact.id} 
                          className="contact-item-small"
                          onClick={() => {
                            setSelectedContact(contact);
                            setCurrentView('contacts');
                          }}
                        >
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
                    <span className="column-subtitle">All Recent Activity</span>
                    {isTouchpointsLoading && <div className="small-spinner"></div>}
                  </div>
                  <div className="column-content">
                    {isTouchpointsLoading && recentTouchpoints.length === 0 ? (
                      <div className="skeleton-loading">
                        <div className="skeleton-item"></div>
                        <div className="skeleton-item"></div>
                        <div className="skeleton-item"></div>
                      </div>
                    ) : recentTouchpoints.length === 0 ? (
                      <div className="empty-state-small">
                        <p>No recent touchpoints</p>
                        <span>Interactions will appear here</span>
                      </div>
                    ) : (
                      recentTouchpoints.slice(0, 10).map((touchpoint) => (
                        <div 
                          key={touchpoint.id} 
                          className="touchpoint-item-small"
                          onClick={() => {
                            const contact = contacts.find(c => c.id === touchpoint.contact.id);
                            if (contact) {
                              setSelectedContact(contact);
                              setCurrentView('contacts');
                            }
                          }}
                        >
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
                    {upcomingEvents.length === 0 ? (
                      <div className="empty-state-small">
                        <p>No upcoming events</p>
                        <span>Schedule meetings to see them here</span>
                      </div>
                    ) : (
                      upcomingEvents.map((event) => (
                        <div key={event.id} className="event-item-small">
                          <div className="event-date-small">
                            <div className="event-day">{event.date.getDate()}</div>
                            <div className="event-month">
                              {event.date.toLocaleDateString('en-US', { month: 'short' })}
                            </div>
                          </div>
                          <div className="event-info-small">
                            <div className="event-title-small">{event.title}</div>
                            <div className="event-location-small">{event.location}</div>
                            <div className="event-time-small">⏰ {event.time}</div>
                          </div>
                        </div>
                      ))
                    )}
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
                    <option value="Qualified Leads">Qualified Leads</option>
                    <option value="Opportunities">Opportunities</option>
                    <option value="Converted Clients">Converted Clients</option>
                    <option value="Disqualified Leads">Disqualified Leads</option>
                    <option value="Declined Opportunities">Declined Opportunities</option>
                    <option value="Churned Clients">Churned Clients</option>
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
                    <option value="All Time">All Time</option>
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
                  {breakdownData.length === 0 ? (
                    <div className="breakdown-empty">
                      <p>No data available</p>
                      <span>Try adjusting your filter criteria</span>
                    </div>
                  ) : (
                    breakdownData.map((item, index) => (
                      <div key={item.label} className="breakdown-stat">
                        <div className="stat-color" style={{backgroundColor: getBreakdownColor(index)}}></div>
                        <div className="stat-info">
                          <div className="stat-label">{item.label}</div>
                          <div className="stat-percentage">{item.percentage}%</div>
                        </div>
                        <div className="stat-count">({item.count})</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contacts View */}
        {currentView === 'contacts' && (
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
                  >
                    <option>All Types</option>
                    <option value="PROSPECTS">Prospects</option>
                    <option value="QUALIFIED_LEADS">Qualified Leads</option>
                    <option value="OPPORTUNITIES">Opportunities</option>
                    <option value="CONVERTED_CLIENTS">Converted Clients</option>
                    <option value="DISQUALIFIED_LEADS">Disqualified Leads</option>
                    <option value="DECLINED_OPPORTUNITIES">Declined Opportunities</option>
                    <option value="CHURNED_CLIENTS">Churned Clients</option>
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
              {/* Contacts List */}
              <div className="contacts-list-panel">
                <div className="contacts-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Contact</th>
                        <th>Recent Touchpoints</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContacts.map(contact => {
                        const recentTouchpoints = contact.touchpoints
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .slice(0, 3);
                        
                        return (
                          <tr 
                            key={contact.id} 
                            className={selectedContact?.id === contact.id ? 'selected' : ''}
                            onClick={() => setSelectedContact(contact)}
                          >
                            <td>
                              <div className="contact-info-expanded">
                                <div className="contact-avatar">
                                  {contact.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="contact-details-expanded">
                                  <div className="contact-status-line">
                                    <span 
                                      className="status-badge-inline"
                                      style={{ backgroundColor: getStatusColor(contact.status) }}
                                    >
                                      {getStatusLabel(contact.status)}
                                    </span>
                                  </div>
                                  <div className="contact-name-line">{contact.name}</div>
                                  <div className="contact-email-line">{contact.primaryEmail || contact.email}</div>
                                  <div className="contact-phone-line">{contact.primaryPhone || contact.phone || 'No phone'}</div>
                                  <div className="contact-created-line">Added: {formatDate(contact.createdAt)}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="recent-touchpoints">
                                {recentTouchpoints.length === 0 ? (
                                  <div className="no-touchpoints">No activity</div>
                                ) : (
                                  recentTouchpoints.map((touchpoint, index) => (
                                    <div key={touchpoint.id} className="touchpoint-line">
                                      <span className="touchpoint-date-short">
                                        {new Date(touchpoint.createdAt).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric'
                                        })}
                                      </span>
                                      <span className="touchpoint-text-short">
                                        {touchpoint.note.length > 40 ? 
                                          `${touchpoint.note.substring(0, 40)}...` : 
                                          touchpoint.note
                                        }
                                      </span>
                                    </div>
                                  ))
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

              {/* Contact Details Panel */}
              <div className="contact-details-panel">
                {selectedContact ? (
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
                            📧 {selectedContact.primaryEmail || selectedContact.email}
                            {selectedContact.secondaryEmail && <span className="secondary-info"> • {selectedContact.secondaryEmail}</span>}
                          </div>
                          <div className="contact-method">
                            📞 {selectedContact.primaryPhone || selectedContact.phone || 'No phone'}
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
                            <div className="company-details">
                              {selectedContact.industry && (
                                <div className="company-detail">
                                  <span className="detail-label">Industry:</span>
                                  <span className="detail-value">{selectedContact.industry}</span>
                                </div>
                              )}
                              {selectedContact.website && (
                                <div className="company-detail">
                                  <span className="detail-label">Website:</span>
                                  <span className="detail-value">
                                    <a href={selectedContact.website.startsWith('http') ? selectedContact.website : `https://${selectedContact.website}`} target="_blank" rel="noopener noreferrer">
                                      {selectedContact.website}
                                    </a>
                                  </span>
                                </div>
                              )}
                              {selectedContact.address && (
                                <div className="company-detail">
                                  <span className="detail-label">Location:</span>
                                  <span className="detail-value">{selectedContact.address}</span>
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
                <h2>{isEditMode ? 'Edit Contact' : 'Add New Contact'}</h2>
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
                        <option value="PROSPECTS">Prospects</option>
                        <option value="QUALIFIED_LEADS">Qualified Leads</option>
                        <option value="OPPORTUNITIES">Opportunities</option>
                        <option value="CONVERTED_CLIENTS">Converted Clients</option>
                        <option value="DISQUALIFIED_LEADS">Disqualified Leads</option>
                        <option value="DECLINED_OPPORTUNITIES">Declined Opportunities</option>
                        <option value="CHURNED_CLIENTS">Churned Clients</option>
                      </select>
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
                    {isEditMode ? 'Update Contact' : 'Add Contact'}
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
                <h2>{isEditingTouchpoint ? 'Edit Touchpoint' : `Add Touchpoint for ${selectedContact.name}`}</h2>
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
                        value={touchpointData.date}
                        onChange={(e) => setTouchpointData({ ...touchpointData, date: e.target.value })}
                        required
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
                    {isEditingTouchpoint ? 'Update Touchpoint' : 'Add Touchpoint'}
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
