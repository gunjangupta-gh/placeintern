import toast from 'react-hot-toast';
import { tokenStorage, getTokenPayload } from './tokenManager';

export const LogoutReason = {
  TOKEN_EXPIRED: 'token_expired',
  USER_LOGOUT: 'user_logout',
  UNAUTHORIZED: 'unauthorized',
  MANUAL: 'manual',
};

// Re-export from tokenManager for backwards compatibility
export { isTokenExpired, getTokenPayload } from './tokenManager';

export const logoutUser = (navigate, options = {}) => {
  const { showMessage = true, reason = LogoutReason.USER_LOGOUT, message } = options;

  // Clear all tokens via centralized manager (also clears persist:root)
  tokenStorage.clear();

  // Clear sessionStorage
  sessionStorage.clear();

  if (showMessage && message) {
    toast.info(message);
  }

  // Hard redirect to fully reset React state and cache
  window.location.href = '/login';
};

export const getUserRole = () => {
  const token = tokenStorage.getToken();
  if (!token) return null;
  try {
    const payload = getTokenPayload(token);
    return payload?.role || (Array.isArray(payload?.roles) ? payload.roles[0] : null);
  } catch {
    return null;
  }
};
