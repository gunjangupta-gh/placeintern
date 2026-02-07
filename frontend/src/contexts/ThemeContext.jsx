import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // Check system preference as fallback
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Ref for theme toggle animation (can be used with react-theme-switch-animation)
  const ref = useRef(null);

  useEffect(() => {
    // Persist preference
    localStorage.setItem('darkMode', JSON.stringify(darkMode));

    // Use requestAnimationFrame for smoother transitions
    requestAnimationFrame(() => {
      // Toggle dark class on document
      if (darkMode) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    });
  }, [darkMode]);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = (e) => {
        // Only update if user hasn't set a preference
        const saved = localStorage.getItem('darkMode');
        if (saved === null) {
          setDarkMode(e.matches);
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  // Memoize toggle function to prevent re-renders
  const toggleTheme = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);

  // Alias for backward compatibility
  const toggleDarkMode = toggleTheme;

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    darkMode,
    toggleTheme,
    toggleDarkMode,
    ref,
    isDark: darkMode,
    isLight: !darkMode,
  }), [darkMode, toggleTheme, toggleDarkMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;