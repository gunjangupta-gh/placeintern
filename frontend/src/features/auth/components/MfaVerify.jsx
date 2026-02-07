import React, { useState, useRef, useEffect } from 'react';
import { Card, Input, Button, Typography, Divider, ConfigProvider, theme } from 'antd';
import { SafetyOutlined, ArrowLeftOutlined, KeyOutlined } from '@ant-design/icons';
import toast from 'react-hot-toast';
import { authService } from '../services/auth.service';
import { useTheme } from '../../../contexts/ThemeContext';

const { Title, Text } = Typography;

const MfaVerify = ({ userId, onSuccess, onBack }) => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const inputRefs = useRef([]);
  const { darkMode } = useTheme();

  // Dark mode theme config for Ant Design
  const darkThemeConfig = {
    algorithm: theme.darkAlgorithm,
    token: {
      colorBgContainer: '#1e293b', // slate-800
      colorBgElevated: '#334155', // slate-700
      colorBorder: '#475569', // slate-600
      colorText: '#f1f5f9', // slate-100
      colorTextPlaceholder: '#94a3b8', // slate-400
      colorPrimary: '#10b981', // emerald-500 (matching the MFA theme)
    },
  };

  const lightThemeConfig = {
    algorithm: theme.defaultAlgorithm,
  };

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index, value) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (digit && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);

    if (pastedData) {
      const newCode = [...code];
      pastedData.split('').forEach((digit, i) => {
        if (i < 6) newCode[i] = digit;
      });
      setCode(newCode);

      // Focus last filled input or submit if complete
      const lastIndex = Math.min(pastedData.length - 1, 5);
      inputRefs.current[lastIndex]?.focus();

      if (pastedData.length === 6) {
        handleVerify(pastedData);
      }
    }
  };

  const handleVerify = async (verifyCode) => {
    const codeToVerify = verifyCode || code.join('');

    if (codeToVerify.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    try {
      // Use loginWithMfa to complete the login flow
      const response = await authService.loginWithMfa(userId, codeToVerify);
      toast.success('Verification successful!');
      onSuccess(response);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid verification code');
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleBackupCodeVerify = async () => {
    if (!backupCode.trim()) {
      toast.error('Please enter a backup code');
      return;
    }

    setLoading(true);
    try {
      // Use loginWithMfa with backup code
      const response = await authService.loginWithMfa(userId, backupCode.trim());
      toast.success('Verification successful!');
      onSuccess(response);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid backup code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider theme={darkMode ? darkThemeConfig : lightThemeConfig}>
      <div className="flex items-center justify-center h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
        <Card
          bordered={false}
          className="w-full max-w-md rounded-2xl shadow-2xl shadow-slate-300/50 dark:shadow-black/30 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50"
          styles={{ body: { padding: '28px 32px' } }}
        >
          {/* Back Button */}
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            className="absolute top-4 left-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Back
          </Button>

          {/* Header */}
          <div className="text-center mb-6 mt-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-2xl mb-4 shadow-lg shadow-emerald-500/25">
              <SafetyOutlined />
            </div>
            <Title level={4} className="!mb-1 !text-slate-800 dark:!text-white !font-bold">
              Two-Factor Authentication
            </Title>
            <Text className="text-slate-500 dark:text-slate-400 text-sm">
              {useBackupCode
                ? 'Enter one of your backup codes'
                : 'Enter the code from your authenticator app'}
            </Text>
          </div>

          {!useBackupCode ? (
            <>
              {/* 6-Digit Code Input */}
              <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    maxLength={1}
                    className="w-12 h-14 text-center text-2xl font-mono rounded-lg"
                    disabled={loading}
                  />
                ))}
              </div>

              <Button
                type="primary"
                block
                size="large"
                loading={loading}
                onClick={() => handleVerify()}
                disabled={code.some((d) => !d)}
                className="h-11 rounded-lg font-semibold shadow-lg shadow-emerald-500/25"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </Button>

              <Divider className="!my-4">
                <Text className="text-gray-400 dark:text-gray-500 text-xs">or</Text>
              </Divider>

              <Button
                type="link"
                block
                icon={<KeyOutlined />}
                onClick={() => setUseBackupCode(true)}
                className="text-gray-500 dark:text-gray-400"
              >
                Use a backup code
              </Button>
            </>
          ) : (
            <>
              {/* Backup Code Input */}
              <Input
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                placeholder="Enter backup code"
                className="mb-4 h-12 text-center font-mono text-lg"
                disabled={loading}
                autoFocus
              />

              <Button
                type="primary"
                block
                size="large"
                loading={loading}
                onClick={handleBackupCodeVerify}
                disabled={!backupCode.trim()}
                className="h-11 rounded-lg font-semibold shadow-lg shadow-emerald-500/25"
              >
                {loading ? 'Verifying...' : 'Verify Backup Code'}
              </Button>

              <Button
                type="link"
                block
                onClick={() => {
                  setUseBackupCode(false);
                  setBackupCode('');
                }}
                className="mt-3 text-gray-500 dark:text-gray-400"
              >
                Use authenticator code instead
              </Button>
            </>
          )}

          {/* Help Text */}
          <div className="text-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Text className="text-slate-400 dark:text-slate-500 text-xs">
              Lost access to your authenticator?{' '}
              <a href="/support" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">
                Contact Support
              </a>
            </Text>
          </div>
        </Card>
      </div>
    </ConfigProvider>
  );
};

export default MfaVerify;
