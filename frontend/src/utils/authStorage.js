/**
 * Centralized auth storage utilities
 * Replaces 15+ duplicate localStorage parsing patterns
 */

export const getStoredLoginResponse = () => {
  try {
    return JSON.parse(localStorage.getItem('loginResponse') || '{}');
  } catch {
    return {};
  }
};

export const getStoredUser = () => {
  const response = getStoredLoginResponse();
  return response?.data?.user || null;
};

export const getStoredToken = () => {
  const response = getStoredLoginResponse();
  return response?.data?.token || null;
};

export const getStoredUserId = () => {
  const user = getStoredUser();
  return user?.id || user?._id || null;
};

export const getStoredUserRole = () => {
  const user = getStoredUser();
  return user?.role || null;
};

export const getStoredInstitutionId = () => {
  const user = getStoredUser();
  return user?.institutionId || null;
};

export const clearStoredAuth = () => {
  localStorage.removeItem('loginResponse');
  localStorage.removeItem('token');
};
