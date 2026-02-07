import React, { Component } from 'react';
import { Button, Result } from 'antd';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Log to error reporting service if available
    if (window.errorLogger) {
      window.errorLogger.logError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background-secondary">
          <Result
            status="error"
            title="Something went wrong"
            subTitle={this.state.error?.message || "We're sorry for the inconvenience. Please try again."}
            extra={[
              <Button type="primary" key="retry" onClick={this.handleRetry}>
                Try Again
              </Button>,
              <Button key="home" onClick={this.handleReset}>
                Go Home
              </Button>,
              <Button key="reload" onClick={() => window.location.reload()}>
                Reload Page
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
