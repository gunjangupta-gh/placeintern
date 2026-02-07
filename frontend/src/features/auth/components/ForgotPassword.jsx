import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Result } from 'antd';
import { MailOutlined, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import API from '../../../services/api';
import { toast } from 'react-hot-toast';

const { Title, Text } = Typography;

const ForgotPassword = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const response = await API.post('/auth/forgot-password', { email: values.email });
      if (response.data.success) {
        setSubmittedEmail(values.email);
        setEmailSent(true);
        toast.success('Reset link sent!');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="flex items-center justify-center min-h-screen  p-4">
        <Card
          bordered={false}
          className="w-full max-w-sm rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
          styles={{ body: { padding: '24px' } }}
        >
          <Result
            icon={<div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center mx-auto"><CheckCircleOutlined className="text-xl" /></div>}
            title={<Title level={5} className="!mt-3 !mb-1 !text-slate-800 dark:!text-white">Check Your Email</Title>}
            subTitle={
              <div className="space-y-2">
                <Text className="text-slate-500 dark:text-slate-400 text-sm block">
                  We sent a reset link to
                </Text>
                <Text strong className="text-blue-600 text-sm">{submittedEmail}</Text>
              </div>
            }
            extra={[
              <Button key="back" type="primary" onClick={() => navigate('/login')} className="h-9 rounded-lg font-medium w-full">
                Back to Login
              </Button>,
              <Button key="retry" type="text" size="small" onClick={() => setEmailSent(false)} className="mt-2 text-slate-500 text-xs">
                Try different email
              </Button>
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen  p-4">
      <Card
        bordered={false}
        className="w-full max-w-sm rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
        styles={{ body: { padding: '24px' } }}
      >
        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl mb-3 shadow-lg shadow-blue-500/25">
            <MailOutlined />
          </div>
          <Title level={4} className="!mb-1 !text-slate-800 dark:!text-white !font-semibold">
            Forgot Password?
          </Title>
          <Text className="text-slate-500 dark:text-slate-400 text-sm">
            Enter your email for reset instructions
          </Text>
        </div>

        {/* Form */}
        <Form form={form} onFinish={handleSubmit} layout="vertical" size="middle" requiredMark={false}>
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Enter email' },
              { type: 'email', message: 'Invalid email' },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-slate-400" />}
              placeholder="Email address"
              className="rounded-lg h-10"
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading} className="h-10 rounded-lg font-semibold shadow-md shadow-blue-500/20 mb-3">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>

          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/login')} className="w-full text-slate-500 hover:text-blue-600 text-sm">
            Back to Login
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default ForgotPassword;
