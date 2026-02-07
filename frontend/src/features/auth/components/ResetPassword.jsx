import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Result, Spin } from 'antd';
import { LockOutlined, CheckCircleOutlined, CloseCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import API from '../../../services/api';
import { toast } from 'react-hot-toast';
import PasswordRequirements, { validatePassword } from '../../../components/common/PasswordRequirements';

const { Title, Text } = Typography;

const ResetPassword = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const navigate = useNavigate();

  const { token: paramToken } = useParams();
  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get('token');
  const token = paramToken || queryToken;

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setVerifying(false);
      setTokenError('No reset token provided');
    }
  }, [token]);

  const verifyToken = async () => {
    setVerifying(true);
    try {
      const response = await API.get(`/auth/verify-reset-token/${token}`);
      if (response.data.valid) {
        setTokenValid(true);
        setUserEmail(response.data.email);
      } else {
        setTokenValid(false);
        setTokenError('Invalid or expired reset token');
      }
    } catch (error) {
      setTokenValid(false);
      setTokenError(error.response?.data?.message || 'Invalid or expired reset token');
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const response = await API.post('/auth/reset-password', {
        token: token,
        newPassword: values.newPassword,
      });

      if (response.data.success) {
        setResetSuccess(true);
        toast.success('Password reset successfully!');
        setTimeout(() => navigate('/login'), 3000);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
      if (error.response?.status === 400) {
        setTokenValid(false);
        setTokenError(error.response?.data?.message || 'Token has expired');
      }
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (verifying) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
        <Card
          bordered={false}
          className="w-full max-w-sm rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
          styles={{ body: { padding: '24px' } }}
        >
          <div className="text-center py-4">
            <Spin size="large" className="mb-4" />
            <Title level={5} className="!mb-1 !text-slate-800 dark:!text-white">Verifying...</Title>
            <Text className="text-slate-500 dark:text-slate-400 text-sm">Please wait</Text>
          </div>
        </Card>
      </div>
    );
  }

  // Success state
  if (resetSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
        <Card
          bordered={false}
          className="w-full max-w-sm rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
          styles={{ body: { padding: '24px' } }}
        >
          <Result
            icon={<div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center mx-auto"><CheckCircleOutlined className="text-xl" /></div>}
            title={<Title level={5} className="!mt-3 !mb-1 !text-slate-800 dark:!text-white">Password Reset!</Title>}
            subTitle={<Text className="text-slate-500 dark:text-slate-400 text-sm">Redirecting to login...</Text>}
            extra={[
              <Button key="login" type="primary" onClick={() => navigate('/login')} className="h-9 rounded-lg font-medium w-full">
                Go to Login
              </Button>
            ]}
          />
        </Card>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
        <Card
          bordered={false}
          className="w-full max-w-sm rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
          styles={{ body: { padding: '24px' } }}
        >
          <Result
            icon={<div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center mx-auto"><CloseCircleOutlined className="text-xl" /></div>}
            title={<Title level={5} className="!mt-3 !mb-1 !text-slate-800 dark:!text-white">Invalid Link</Title>}
            subTitle={<Text className="text-slate-500 dark:text-slate-400 text-sm">{tokenError || 'This link has expired'}</Text>}
            extra={[
              <Button key="forgot" type="primary" onClick={() => navigate('/forgot-password')} className="h-9 rounded-lg font-medium w-full">
                Request New Link
              </Button>,
              <Button key="login" type="text" size="small" onClick={() => navigate('/login')} className="mt-2 text-slate-500 text-xs">
                Back to Login
              </Button>
            ]}
          />
        </Card>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <Card
        bordered={false}
        className="w-full max-w-sm rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
        styles={{ body: { padding: '24px' } }}
      >
        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white text-xl mb-3 shadow-lg shadow-green-500/25">
            <SafetyOutlined />
          </div>
          <Title level={4} className="!mb-1 !text-slate-800 dark:!text-white !font-semibold">
            Reset Password
          </Title>
          <Text className="text-slate-500 dark:text-slate-400 text-sm">
            {userEmail ? `For ${userEmail}` : 'Create a new password'}
          </Text>
        </div>

        {/* Form */}
        <Form form={form} onFinish={handleSubmit} layout="vertical" size="middle" requiredMark={false}>
          <Form.Item
            name="newPassword"
            rules={[
              { required: true, message: 'Enter new password' },
              () => ({
                validator(_, value) {
                  if (!value) return Promise.resolve();
                  const { isValid, errors } = validatePassword(value);
                  if (!isValid) {
                    return Promise.reject(new Error(errors[0]));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Input.Password
              placeholder="New password"
              prefix={<LockOutlined className="text-slate-400" />}
              className="rounded-lg h-10"
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Form.Item>

          <PasswordRequirements password={newPassword} />

          <Form.Item
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Confirm password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              placeholder="Confirm new password"
              prefix={<LockOutlined className="text-slate-400" />}
              className="rounded-lg h-10"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            className="h-10 rounded-lg font-semibold shadow-md shadow-blue-500/20"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </Form>

        {/* Footer */}
        <div className="text-center mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="text" size="small" onClick={() => navigate('/login')} className="text-slate-500 text-xs">
            Back to Login
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ResetPassword;
