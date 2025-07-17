// API Configuration
export const API_CONFIG = {
  BASE_URL: 'https://daveenci-ai-crm-admin-dashboard.onrender.com/api',
  TIMEOUT: 10000, // 10 seconds
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
} as const;

// Status values for consistent use across the app
export const CONTACT_STATUSES = [
  'PROSPECT',
  'LEAD', 
  'OPPORTUNITY',
  'CLIENT',
  'CHURNED',
  'DECLINED',
  'UNQUALIFIED'
] as const;

export type ContactStatus = typeof CONTACT_STATUSES[number];

// Sentiment values for contact evaluation
export const SENTIMENT_VALUES = [
  'GOOD',
  'NEUTRAL',
  'BAD'
] as const;

export type Sentiment = typeof SENTIMENT_VALUES[number];

// Industry options for forms
export const INDUSTRY_OPTIONS = [
  'Technology',
  'Healthcare', 
  'Finance',
  'Education',
  'Construction',
  'Manufacturing',
  'Retail',
  'Consulting',
  'Real Estate',
  'Marketing',
  'Other'
] as const;

export type Industry = typeof INDUSTRY_OPTIONS[number];

// Touchpoint sources
export const TOUCHPOINT_SOURCES = [
  'MANUAL',
  'EMAIL',
  'SMS', 
  'PHONE',
  'IN_PERSON',
  'EVENT',
  'OTHER'
] as const;

export type TouchpointSource = typeof TOUCHPOINT_SOURCES[number]; 