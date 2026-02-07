import React, { Component } from 'react';
import { Button, Result } from 'antd';
import { HomeOutlined, ReloadOutlined, RollbackOutlined } from '@ant-design/icons';

/**
 * Enhanced Error Boundary specifically for route-level components
 * Provides better UX with route-specific error handling
 */
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Route Error Boundary caught error:', error, errorInfo);

    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Log to error reporting service if available
    if (window.errorLogger) {
      window.errorLogger.logError(error, errorInfo);
    }

    // Track error in analytics if available
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: false,
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/dashboard';
  };

  handleGoBack = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.history.back();
  };

  render() {
    const { hasError, error, errorCount } = this.state;
    const { fallback, routeName } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return typeof fallback === 'function'
          ? fallback(error, this.handleRetry)
          : fallback;
      }

      // Determine error severity
      const isCritical = errorCount > 2;
      const title = isCritical
        ? 'Persistent Error Detected'
        : 'Something went wrong';

      const subTitle = isCritical
        ? 'This page is experiencing repeated errors. Please try accessing a different page or contact support.'
        : error?.message || `We're sorry, but ${routeName || 'this page'} encountered an error. Please try again.`;

      return (
        <div className="flex items-center justify-center min-h-screen bg-background-secondary p-4">
          <div className="max-w-2xl w-full">
            <Result
              status={isCritical ? '500' : 'error'}
              title={title}
              subTitle={subTitle}
              extra={[
                <Button
                  type="primary"
                  key="retry"
                  icon={<ReloadOutlined />}
                  onClick={this.handleRetry}
                  disabled={isCritical}
                >
                  Try Again
                </Button>,
                <Button
                  key="back"
                  icon={<RollbackOutlined />}
                  onClick={this.handleGoBack}
                >
                  Go Back
                </Button>,
                <Button
                  key="home"
                  icon={<HomeOutlined />}
                  onClick={this.handleGoHome}
                >
                  Go to Dashboard
                </Button>,
              ]}
            />

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-red-800 font-semibold mb-2">
                  Development Error Details:
                </h3>
                <pre className="text-xs text-red-700 overflow-auto max-h-64">
                  {error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
