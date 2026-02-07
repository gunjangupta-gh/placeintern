// ReportBuilderErrorBoundary Component - Catch and handle errors gracefully
import React from "react";
import { Result, Button, Typography, Card } from "antd";
import { ReloadOutlined, BugOutlined } from "@ant-design/icons";

const { Paragraph, Text } = Typography;

class ReportBuilderErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state to show fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error for debugging
    console.error("[ReportBuilder Error]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Optionally reload the page for a clean state
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;

      // If custom fallback is provided, use it
      if (fallback) {
        return typeof fallback === "function"
          ? fallback({ error: this.state.error, reset: this.handleReset })
          : fallback;
      }

      // Default error UI
      return (
        <Card className="m-4">
          <Result
            status="error"
            icon={<BugOutlined className="text-red-500" />}
            title="Something went wrong"
            subTitle="An error occurred in the Report Builder. Please try again."
            extra={[
              <Button
                key="retry"
                type="primary"
                icon={<ReloadOutlined />}
                onClick={this.handleReset}
              >
                Try Again
              </Button>,
              <Button key="reload" onClick={this.handleReload}>
                Reload Page
              </Button>,
            ]}
          >
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-4 text-left">
                <Paragraph>
                  <Text strong type="danger">Error Details:</Text>
                </Paragraph>
                <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm text-red-600 max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack && (
                    <div className="mt-2 text-gray-600">
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </pre>
              </div>
            )}
          </Result>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ReportBuilderErrorBoundary;