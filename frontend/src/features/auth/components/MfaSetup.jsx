import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Steps,
  Button,
  Input,
  Typography,
  Spin,
  Alert,
  Divider,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  QrcodeOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { authService } from '../services/auth.service';

const { Title, Text, Paragraph } = Typography;

/**
 * Generate QR code image URL from otpauth URL
 * Uses free QR code API service
 */
const generateQrImageUrl = (otpauthUrl) => {
  if (!otpauthUrl) return null;
  const encodedUrl = encodeURIComponent(otpauthUrl);
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`;
};

const MfaSetup = ({ visible, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (visible) {
      initSetup();
    } else {
      // Reset state when modal closes
      setCurrentStep(0);
      setSetupData(null);
      setVerifyCode('');
    }
  }, [visible]);

  const initSetup = async () => {
    setLoading(true);
    try {
      const data = await authService.setupMfa();
      setSetupData(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to setup MFA');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      toast('⚠️ Please enter a 6-digit code', { icon: '⚠️' });
      return;
    }

    setVerifying(true);
    try {
      await authService.enableMfa(verifyCode);
      toast.success('Two-factor authentication enabled successfully!');
      setCurrentStep(2);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid verification code');
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleComplete = () => {
    onSuccess?.();
    onClose();
  };

  const steps = [
    { title: 'Scan QR', icon: <QrcodeOutlined /> },
    { title: 'Verify', icon: <SafetyOutlined /> },
    { title: 'Backup Codes', icon: <KeyOutlined /> },
  ];

  const renderStepContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Spin size="large" />
          <Text className="mt-4 text-gray-500">Setting up two-factor authentication...</Text>
        </div>
      );
    }

    switch (currentStep) {
      case 0:
        // Generate QR code image URL from otpauth URL
        const qrImageUrl = setupData?.qrCodeUrl ? generateQrImageUrl(setupData.qrCodeUrl) : null;

        return (
          <div className="text-center">
            <div className="mb-4">
              <Title level={5} className="!mb-2">Scan this QR code</Title>
              <Text className="text-gray-500">
                Use your authenticator app (Google Authenticator, Authy, etc.)
              </Text>
            </div>

            {qrImageUrl && (
              <div className="flex justify-center my-6">
                <div className="p-4 bg-white rounded-xl shadow-md">
                  <img
                    src={qrImageUrl}
                    alt="MFA QR Code"
                    className="w-48 h-48"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      toast.error('Failed to load QR code');
                    }}
                  />
                </div>
              </div>
            )}

            <Divider>Or enter manually</Divider>

            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <Text className="text-xs text-gray-500 block mb-1">Secret Key</Text>
              <div className="flex items-center justify-center gap-2">
                <code className="text-sm font-mono bg-white dark:bg-gray-700 px-3 py-1 rounded break-all">
                  {setupData?.manualEntryKey || setupData?.secret}
                </code>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(setupData?.secret)}
                />
              </div>
            </div>

            <div className="mt-6">
              <Button type="primary" onClick={() => setCurrentStep(1)}>
                I've scanned the code
              </Button>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="text-center">
            <div className="mb-6">
              <Title level={5} className="!mb-2">Enter verification code</Title>
              <Text className="text-gray-500">
                Enter the 6-digit code from your authenticator app
              </Text>
            </div>

            <div className="flex justify-center mb-6">
              <Input
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="text-center text-2xl font-mono tracking-widest w-48 h-12"
                autoFocus
              />
            </div>

            <div className="flex justify-center gap-3">
              <Button onClick={() => setCurrentStep(0)}>Back</Button>
              <Button
                type="primary"
                onClick={handleVerify}
                loading={verifying}
                disabled={verifyCode.length !== 6}
              >
                Verify & Enable
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="text-center">
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                <CheckCircleOutlined className="text-3xl" />
              </div>
              <Title level={5} className="!mb-2">MFA Enabled Successfully!</Title>
              <Text className="text-gray-500">
                Save these backup codes in a secure place
              </Text>
            </div>

            <Alert
              type="warning"
              className="mb-4 text-left"
              message="Important"
              description="Each backup code can only be used once. Store them securely - you won't see them again."
            />

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-2">
                {setupData?.backupCodes?.map((code, index) => (
                  <code
                    key={index}
                    className="text-sm font-mono bg-white dark:bg-gray-700 px-3 py-2 rounded"
                  >
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <Button
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(setupData?.backupCodes?.join('\n'))}
              >
                Copy All
              </Button>
              <Button type="primary" onClick={handleComplete}>
                Done
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={480}
      centered
      closable={currentStep !== 2}
      maskClosable={false}
      destroyOnClose
    >
      <div className="py-2">
        <Steps
          current={currentStep}
          items={steps}
          size="small"
          className="mb-6"
        />
        {renderStepContent()}
      </div>
    </Modal>
  );
};

export default MfaSetup;
