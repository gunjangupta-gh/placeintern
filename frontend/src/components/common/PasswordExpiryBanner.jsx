import React from 'react';
import { Alert, Button } from 'antd';
import { WarningOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

/**
 * Password Expiry Banner Component
 * Shows a warning when the user's password is about to expire
 */
const PasswordExpiryBanner = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // Check if password is expiring soon (within 7 days)
  const getExpiryInfo = () => {
    if (!user?.passwordExpiresAt) {
      return null;
    }

    const expiryDate = new Date(user.passwordExpiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 0) {
      return {
        type: 'error',
        message: 'Your password has expired',
        description: 'Please change your password immediately to continue using the system.',
        urgent: true,
      };
    }

    if (daysUntilExpiry <= 7) {
      return {
        type: 'warning',
        message: `Your password expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
        description: 'Please update your password to maintain access to your account.',
        urgent: daysUntilExpiry <= 3,
      };
    }

    return null;
  };

  const expiryInfo = getExpiryInfo();

  if (!expiryInfo) {
    return null;
  }

  return (
    <Alert
      type={expiryInfo.type}
      showIcon
      icon={expiryInfo.urgent ? <WarningOutlined /> : <LockOutlined />}
      message={expiryInfo.message}
      description={expiryInfo.description}
      className="mb-4"
      action={
        <Button
          size="small"
          type={expiryInfo.urgent ? 'primary' : 'default'}
          danger={expiryInfo.type === 'error'}
          onClick={() => navigate('/app/change-password')}
        >
          Change Password
        </Button>
      }
    />
  );
};

export default PasswordExpiryBanner;
