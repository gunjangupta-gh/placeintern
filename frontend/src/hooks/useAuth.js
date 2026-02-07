import { useSelector, useDispatch } from 'react-redux';
import { logout as logoutAction } from '../features/auth/store/authSlice';
import { tokenStorage } from '../utils/tokenManager';
import { authService } from '../features/auth/services/auth.service';

// Backend role constants
const ROLES = {
  STATE: 'STATE_DIRECTORATE',
  PRINCIPAL: 'PRINCIPAL',
  FACULTY: ['FACULTY', 'TEACHER', 'FACULTY_SUPERVISOR'],
  STUDENT: 'STUDENT',
  INDUSTRY: ['INDUSTRY', 'INDUSTRY_PARTNER', 'INDUSTRY_SUPERVISOR'],
};

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated, loading } = useSelector((state) => state.auth);

  const logout = async () => {
    try {
      // Call backend to invalidate token server-side
      await authService.logout().catch(() => {});
    } catch (error) {
      console.error('Logout API error:', error);
    }

    // Clear all storage (localStorage, sessionStorage, cookies) except theme
    // tokenStorage.clear() now handles everything comprehensively
    tokenStorage.clear();

    // Dispatch Redux logout action
    dispatch(logoutAction());

    // Hard redirect to fully reset React state
    window.location.href = '/login';
  };

  const hasRole = (role) => {
    return user?.role === role;
  };

  const hasAnyRole = (roles) => {
    return roles.includes(user?.role);
  };

  const hasPermission = (permission) => {
    return user?.permissions?.includes(permission);
  };

  const isState = user?.role === ROLES.STATE;
  const isPrincipal = user?.role === ROLES.PRINCIPAL;
  const isFaculty = ROLES.FACULTY.includes(user?.role);
  const isStudent = user?.role === ROLES.STUDENT;
  const isIndustry = ROLES.INDUSTRY.includes(user?.role);

  return {
    user,
    isAuthenticated,
    loading,
    logout,
    hasRole,
    hasAnyRole,
    hasPermission,
    isState,
    isPrincipal,
    isFaculty,
    isStudent,
    isIndustry,
  };
};

export default useAuth;
