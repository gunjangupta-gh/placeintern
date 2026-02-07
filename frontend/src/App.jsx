import React, { useMemo } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { lightTheme, darkTheme } from './theme/antdTheme';
import AppRoutes from './app/routes/AppRoutes';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import SEO from './components/SEO';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/common/ErrorBoundary';

const AppContent = React.memo(() => {
  const { darkMode } = useTheme();

  // Memoize theme to prevent unnecessary re-renders
  const currentTheme = useMemo(() => darkMode ? darkTheme : lightTheme, [darkMode]);

  return (
    <ConfigProvider theme={currentTheme}>
      <AntApp>
        <ErrorBoundary>
          <SEO />
          <div className="min-h-screen bg-background-secondary text-text-primary">
            <AppRoutes />
            <PWAInstallPrompt />
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: 'rgb(var(--color-background))',
                  color: 'rgb(var(--color-text-primary))',
                  border: '1px solid rgb(var(--color-border))',
                },
              }}
            />
          </div>
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  );
});

AppContent.displayName = 'AppContent';

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
