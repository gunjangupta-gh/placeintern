import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Typography, Space, Badge, List, Empty, Spin, Tag } from 'antd';
import {
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  NotificationOutlined,
  BellOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import SystemAlertsService from '../../services/systemAlerts.service';

const { Text, Title, Paragraph } = Typography;

const ALERT_CONFIG = {
  INFO: {
    icon: InfoCircleOutlined,
    color: '#1890ff',
    bgColor: 'rgba(24, 144, 255, 0.1)',
    borderColor: 'rgba(24, 144, 255, 0.3)',
    tagColor: 'blue',
    label: 'Information',
  },
  WARNING: {
    icon: WarningOutlined,
    color: '#faad14',
    bgColor: 'rgba(250, 173, 20, 0.1)',
    borderColor: 'rgba(250, 173, 20, 0.3)',
    tagColor: 'gold',
    label: 'Warning',
  },
  ERROR: {
    icon: CloseCircleOutlined,
    color: '#ff4d4f',
    bgColor: 'rgba(255, 77, 79, 0.1)',
    borderColor: 'rgba(255, 77, 79, 0.3)',
    tagColor: 'red',
    label: 'Critical',
  },
  SUCCESS: {
    icon: CheckCircleOutlined,
    color: '#52c41a',
    bgColor: 'rgba(82, 196, 26, 0.1)',
    borderColor: 'rgba(82, 196, 26, 0.3)',
    tagColor: 'green',
    label: 'Success',
  },
  ANNOUNCEMENT: {
    icon: NotificationOutlined,
    color: '#722ed1',
    bgColor: 'rgba(114, 46, 209, 0.1)',
    borderColor: 'rgba(114, 46, 209, 0.3)',
    tagColor: 'purple',
    label: 'Announcement',
  },
};

const PRIORITY_CONFIG = {
  LOW: { weight: 1, label: 'Low' },
  NORMAL: { weight: 2, label: 'Normal' },
  HIGH: { weight: 3, label: 'High' },
  URGENT: { weight: 4, label: 'Urgent' },
};

const SystemAlertModal = () => {
  const [visible, setVisible] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dismissing, setDismissing] = useState({});
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [showList, setShowList] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await SystemAlertsService.getMyAlerts();
      const alertsData = response.alerts || response || [];

      // Sort by priority (highest first) then by creation date (newest first)
      const sortedAlerts = alertsData.sort((a, b) => {
        const priorityDiff = (PRIORITY_CONFIG[b.priority]?.weight || 0) - (PRIORITY_CONFIG[a.priority]?.weight || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      setAlerts(sortedAlerts);

      // Auto-show modal if there are alerts
      if (sortedAlerts.length > 0 && !visible) {
        setVisible(true);
        setCurrentAlertIndex(0);
        setShowList(sortedAlerts.length > 1);
      }
    } catch (error) {
      console.error('Failed to fetch system alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [visible]);

  useEffect(() => {
    // Fetch alerts on mount
    fetchAlerts();

    // Poll for new alerts every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleDismiss = async (alertId, event) => {
    if (event) event.stopPropagation();

    try {
      setDismissing(prev => ({ ...prev, [alertId]: true }));
      await SystemAlertsService.dismissAlert(alertId);

      const remainingAlerts = alerts.filter(a => a.id !== alertId);
      setAlerts(remainingAlerts);

      if (remainingAlerts.length === 0) {
        setVisible(false);
      } else if (currentAlertIndex >= remainingAlerts.length) {
        setCurrentAlertIndex(remainingAlerts.length - 1);
      }
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    } finally {
      setDismissing(prev => ({ ...prev, [alertId]: false }));
    }
  };

  const handleDismissAll = async () => {
    const dismissibleAlerts = alerts.filter(a => a.isDismissible);

    try {
      await Promise.all(
        dismissibleAlerts.map(alert => SystemAlertsService.dismissAlert(alert.id))
      );

      const remainingAlerts = alerts.filter(a => !a.isDismissible);
      setAlerts(remainingAlerts);

      if (remainingAlerts.length === 0) {
        setVisible(false);
      }
    } catch (error) {
      console.error('Failed to dismiss alerts:', error);
    }
  };

  const handleClose = () => {
    // Only close if all remaining alerts are dismissible or user explicitly closes
    const nonDismissible = alerts.filter(a => !a.isDismissible);
    if (nonDismissible.length === 0) {
      setVisible(false);
    }
  };

  const currentAlert = alerts[currentAlertIndex];

  const renderAlertContent = (alert) => {
    const config = ALERT_CONFIG[alert.type] || ALERT_CONFIG.INFO;
    const IconComponent = config.icon;

    return (
      <div
        style={{
          padding: '20px',
          borderRadius: '8px',
          backgroundColor: config.bgColor,
          border: `1px solid ${config.borderColor}`,
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space align="start">
            <IconComponent style={{ fontSize: '24px', color: config.color }} />
            <div style={{ flex: 1 }}>
              <Space size="small" wrap>
                <Title level={5} style={{ margin: 0 }}>{alert.title}</Title>
                <Tag color={config.tagColor}>{config.label}</Tag>
                {alert.priority === 'URGENT' && (
                  <Tag color="red" icon={<ExclamationCircleOutlined />}>Urgent</Tag>
                )}
                {alert.priority === 'HIGH' && (
                  <Tag color="orange">High Priority</Tag>
                )}
              </Space>
            </div>
          </Space>

          <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {alert.message}
          </Paragraph>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {new Date(alert.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>

            {alert.isDismissible && (
              <Button
                type="text"
                size="small"
                loading={dismissing[alert.id]}
                onClick={(e) => handleDismiss(alert.id, e)}
                icon={<CloseOutlined />}
              >
                Dismiss
              </Button>
            )}
          </div>
        </Space>
      </div>
    );
  };

  const renderAlertList = () => (
    <List
      dataSource={alerts}
      renderItem={(alert, index) => {
        const config = ALERT_CONFIG[alert.type] || ALERT_CONFIG.INFO;
        const IconComponent = config.icon;

        return (
          <List.Item
            key={alert.id}
            onClick={() => setCurrentAlertIndex(index)}
            style={{
              cursor: 'pointer',
              backgroundColor: index === currentAlertIndex ? config.bgColor : 'transparent',
              borderRadius: '6px',
              marginBottom: '4px',
              padding: '8px 12px',
            }}
            actions={
              alert.isDismissible
                ? [
                    <Button
                      key="dismiss"
                      type="text"
                      size="small"
                      loading={dismissing[alert.id]}
                      onClick={(e) => handleDismiss(alert.id, e)}
                      icon={<CloseOutlined />}
                    />,
                  ]
                : undefined
            }
          >
            <List.Item.Meta
              avatar={<IconComponent style={{ color: config.color, fontSize: '18px' }} />}
              title={
                <Space size="small">
                  <span style={{ fontSize: '13px' }}>{alert.title}</span>
                  {alert.priority === 'URGENT' && <Tag color="red" style={{ fontSize: '10px' }}>Urgent</Tag>}
                </Space>
              }
              description={
                <Text type="secondary" style={{ fontSize: '11px' }} ellipsis>
                  {alert.message.substring(0, 50)}...
                </Text>
              }
            />
          </List.Item>
        );
      }}
    />
  );

  if (alerts.length === 0 && !loading) {
    return null;
  }

  const hasNonDismissible = alerts.some(a => !a.isDismissible);
  const dismissibleCount = alerts.filter(a => a.isDismissible).length;

  return (
    <Modal
      title={
        <Space>
          <Badge count={alerts.length} offset={[-5, 5]}>
            <BellOutlined style={{ fontSize: '20px' }} />
          </Badge>
          <span>System Alerts</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {alerts.length > 1 && (
              <Button
                type="link"
                size="small"
                onClick={() => setShowList(!showList)}
              >
                {showList ? 'Hide List' : `View All (${alerts.length})`}
              </Button>
            )}
          </div>
          <Space>
            {dismissibleCount > 1 && (
              <Button onClick={handleDismissAll}>
                Dismiss All ({dismissibleCount})
              </Button>
            )}
            {!hasNonDismissible && (
              <Button type="primary" onClick={handleClose}>
                Close
              </Button>
            )}
          </Space>
        </div>
      }
      width={600}
      closable={!hasNonDismissible}
      maskClosable={!hasNonDismissible}
      keyboard={!hasNonDismissible}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>Loading alerts...</div>
        </div>
      ) : alerts.length === 0 ? (
        <Empty description="No active alerts" />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {showList && alerts.length > 1 && (
            <div
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: '12px',
                marginBottom: '12px',
              }}
            >
              {renderAlertList()}
            </div>
          )}

          {currentAlert && renderAlertContent(currentAlert)}

          {alerts.length > 1 && !showList && (
            <div style={{ textAlign: 'center' }}>
              <Space>
                <Button
                  size="small"
                  disabled={currentAlertIndex === 0}
                  onClick={() => setCurrentAlertIndex(prev => prev - 1)}
                >
                  Previous
                </Button>
                <Text type="secondary">
                  {currentAlertIndex + 1} of {alerts.length}
                </Text>
                <Button
                  size="small"
                  disabled={currentAlertIndex === alerts.length - 1}
                  onClick={() => setCurrentAlertIndex(prev => prev + 1)}
                >
                  Next
                </Button>
              </Space>
            </div>
          )}
        </Space>
      )}
    </Modal>
  );
};

export default SystemAlertModal;
