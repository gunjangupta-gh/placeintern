import React from 'react';
import { Modal, Button, theme } from 'antd';
import {
  ExclamationCircleOutlined,
  LogoutOutlined,
  UserOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

const LogoutModal = ({
  visible,
  onCancel,
  onConfirm,
  loading,
  userName,
  role,
  sessionInfo,
  darkMode,
}) => {
  const { token } = theme.useToken();

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <ExclamationCircleOutlined className="text-warning text-xl" />
          <span>Confirm Logout</span>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading} className="rounded-lg">
          Cancel
        </Button>,
        <Button
          key="logout"
          type="primary"
          danger
          icon={<LogoutOutlined />}
          loading={loading}
          onClick={onConfirm}
          className="rounded-lg"
        >
          {loading ? 'Logging out...' : 'Yes, Logout'}
        </Button>,
      ]}
      centered
      maskClosable={!loading}
      closable={!loading}
      className="rounded-xl overflow-hidden"
    >
      <div className="py-4">
        <p className="text-base mb-3 text-text-primary">Are you sure you want to logout from your account?</p>
        <div
          className="p-3 rounded-lg bg-background-tertiary/50 border border-border/50"
        >
          <div className="flex items-center gap-2 text-sm">
            <UserOutlined className="text-primary" />
            <span className="font-medium text-text-primary">{userName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm mt-1 text-text-secondary">
            <SafetyOutlined />
            <span>{role?.replace('_', ' ') || 'Guest'}</span>
          </div>
          {sessionInfo && (
            <div className="flex items-center gap-2 text-sm mt-1 text-text-secondary">
              <ClockCircleOutlined />
              <span>Session expires in: {sessionInfo.formattedTime}</span>
            </div>
          )}
        </div>
        <p className="text-sm mt-3 text-text-tertiary">
          You will need to sign in again to access your account.
        </p>
      </div>
    </Modal>
  );
};

export default LogoutModal;