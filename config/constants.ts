/**
 * Application Constants
 * HTTP status codes and database states
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const DB_STATUS = {
  DISCONNECTED: 0,
  CONNECTED: 1,
  CONNECTING: 2,
  DISCONNECTING: 3,
} as const;

export const APP_NAME = 'Virtual Library';
export const API_VERSION = 'v1';

// File Upload Configuration
export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
} as const;

// Ranking Configuration
export const RANKING = {
  EXCLUDED_NAMES: ['Virtual Library Admin'],
  MAX_TOP_RANKS: 10000, // Allow up to 10,000 users in rankings
  DEFAULT_LIMIT: 10000, // Default API limit for fetching rankings
} as const;

// Pricing Configuration
export const PRICING = {
  MEMBERSHIP_FEE: 1999, // in rupees
  ORIGINAL_PRICE: 3000, // in rupees (strikethrough price)
  CURRENCY: 'INR',
} as const;
