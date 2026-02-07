import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { DATE_FORMATS } from './constants';

dayjs.extend(relativeTime);

// Date formatting utilities
export const formatDate = (date, format = DATE_FORMATS.DISPLAY) => {
  if (!date) return '';
  return dayjs(date).format(format);
};

export const formatDateTime = (date) => {
  if (!date) return '';
  return dayjs(date).format(DATE_FORMATS.DISPLAY_TIME);
};

export const formatRelativeTime = (date) => {
  if (!date) return '';
  return dayjs(date).fromNow();
};

// Number formatting utilities
export const formatNumber = (number, decimals = 0) => {
  if (number === null || number === undefined) return '';
  return Number(number).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === null || amount === undefined) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined) return '';
  return `${Number(value).toFixed(decimals)}%`;
};

// String formatting utilities
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const capitalizeWords = (str) => {
  if (!str) return '';
  return str
    .split(' ')
    .map((word) => capitalize(word))
    .join(' ');
};

export const truncate = (str, length = 50) => {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
};

// File size formatting
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// Phone number formatting
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{5})(\d{5})/, '$1-$2');
  }
  return phone;
};

// Email validation
export const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// URL validation
export const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Generate initials from name
export const getInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

// Status badge color
export const getStatusColor = (status) => {
  const colors = {
    active: 'green',
    inactive: 'gray',
    pending: 'yellow',
    approved: 'blue',
    rejected: 'red',
    success: 'green',
    warning: 'orange',
    error: 'red',
    info: 'blue',
  };
  return colors[status?.toLowerCase()] || 'default';
};
