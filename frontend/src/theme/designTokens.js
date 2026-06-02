/**
 * Design System Tokens
 * Centralized design values for consistent UI
 * Professional compact design system
 */

export const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.375rem',   // 6px (was 8px)
  md: '0.5rem',     // 8px (was 12px)
  lg: '0.75rem',    // 12px (was 16px)
  xl: '1rem',       // 16px (was 24px)
  '2xl': '1.5rem',  // 24px (was 32px)
  '3xl': '2rem',    // 32px (was 48px)
};

export const borderRadius = {
  sm: '0.25rem',    // 4px
  md: '0.375rem',   // 6px (was 8px)
  lg: '0.5rem',     // 8px (was 12px)
  xl: '0.75rem',    // 12px (was 16px)
  '2xl': '1rem',    // 16px (was 24px)
  full: '9999px',
};

export const typography = {
  xs: '0.6875rem',  // 11px (was 12px)
  sm: '0.8125rem',  // 13px (was 14px)
  base: '0.875rem', // 14px (was 16px)
  lg: '1rem',       // 16px (was 18px)
  xl: '1.125rem',   // 18px (was 20px)
  '2xl': '1.375rem',// 22px (was 24px)
  '3xl': '1.75rem', // 28px (was 30px)
};

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
  md: '0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
  lg: '0 4px 8px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
  xl: '0 8px 16px -4px rgba(0, 0, 0, 0.1), 0 4px 8px -4px rgba(0, 0, 0, 0.06)',
};

// Semantic color helpers for status
export const statusColors = {
  success: {
    light: 'var(--ant-success-color)',
    bg: 'var(--ant-success-color-bg)',
    border: 'var(--ant-success-color-border)',
  },
  error: {
    light: 'var(--ant-error-color)',
    bg: 'var(--ant-error-color-bg)',
    border: 'var(--ant-error-color-border)',
  },
  warning: {
    light: 'var(--ant-warning-color)',
    bg: 'var(--ant-warning-color-bg)',
    border: 'var(--ant-warning-color-border)',
  },
  info: {
    light: 'var(--ant-info-color)',
    bg: 'var(--ant-info-color-bg)',
    border: 'var(--ant-info-color-border)',
  },
  purple: {
    light: 'var(--color-purple)',
    bg: 'var(--color-purple-bg)',
    border: 'var(--color-purple-border)',
  },
  cyan: {
    light: 'var(--color-cyan)',
    bg: 'var(--color-cyan-bg)',
    border: 'var(--color-cyan-border)',
  },
};

// Gradient configurations
export const gradients = {
  primary: 'linear-gradient(135deg, rgb(var(--color-primary)) 0%, rgb(var(--color-primary)) 100%)',
  success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  purple: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  cyan: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  pink: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
};

// Animation durations
export const transitions = {
  fast: '150ms',
  base: '200ms',
  slow: '300ms',
  slower: '500ms',
};
