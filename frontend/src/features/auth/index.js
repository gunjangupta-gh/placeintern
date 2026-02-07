// Auth Feature - Consolidated exports

// Components
export { default as LoginForm } from './components/LoginForm';
export { default as Login } from './components/Login';
export { default as StudentLogin } from './components/StudentLogin';
export { default as Signup } from './components/Signup';
export { default as StudentSignup } from './components/StudentSignup';
export { default as ForgotPassword } from './components/ForgotPassword';
export { default as ResetPassword } from './components/ResetPassword';
export { default as ChangePassword } from './components/ChangePassword';
export { default as GoogleRedirectHandler } from './components/GoogleRedirectHandler';

// Services
export { authService } from './services/auth.service';

// Store
export {
  default as authReducer,
  login,
  logout,
  refreshToken,
  getCurrentUser,
  fetchProfile,
  setCredentials,
  clearError,
} from './store/authSlice';
