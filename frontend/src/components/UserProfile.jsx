import React, { useState, useEffect } from 'react';
import {
  Modal,
  Avatar,
  Form,
  Input,
  Button,
  Tag,
  Spin,
  message,
  Divider,
  Tabs,
  Popconfirm,
  Typography,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  IdcardOutlined,
  SafetyOutlined,
  EditOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LockOutlined,
  KeyOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import API from '../services/api';
import { authService } from '../features/auth/services/auth.service';
import MfaSetup from '../features/auth/components/MfaSetup';
import MaskedField from './common/MaskedField';

const { Title, Text } = Typography;

const UserProfile = ({ visible, onClose }) => {
  const [form] = Form.useForm();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const { darkMode } = useTheme();

  // MFA state
  const [activeTab, setActiveTab] = useState('profile');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  // Unmasked data cache
  const [unmaskedData, setUnmaskedData] = useState(null);

  // Function to reveal masked contact details
  const handleRevealContact = async (fieldName) => {
    // If we already have unmasked data, return the specific field
    if (unmaskedData) {
      return unmaskedData[fieldName] || null;
    }

    // Fetch unmasked data from API
    const response = await API.get('/auth/me/unmasked-contact');
    const data = response.data;
    setUnmaskedData(data);
    return data[fieldName] || null;
  };

  const fetchUserProfile = async () => {
    setFetchingProfile(true);
    try {
      const response = await API.get('/auth/me');
      const data = response.data;
      setUserData(data);
      setMfaEnabled(data.mfaEnabled || false);
      form.setFieldsValue({
        name: data.name,
        email: data.email,
        phoneNo: data.phoneNo || '',
        designation: data.designation || '',
        branchName: data.branchName || '',
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      message.error(error.response?.data?.message || 'Failed to load profile');
    } finally {
      setFetchingProfile(false);
    }
  };

  const handleMfaSetupSuccess = () => {
    setMfaEnabled(true);
    setShowMfaSetup(false);
    message.success('Two-factor authentication enabled');
  };

  const handleDisableMfa = async () => {
    if (!disableCode || disableCode.length !== 6) {
      message.warning('Please enter a 6-digit code');
      return;
    }

    setMfaLoading(true);
    try {
      await authService.disableMfa(disableCode);
      setMfaEnabled(false);
      setDisableCode('');
      message.success('Two-factor authentication disabled');
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to disable MFA');
    } finally {
      setMfaLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchUserProfile();
    } else {
      setEditing(false);
      setUserData(null);
      setActiveTab('profile');
      setDisableCode('');
      setUnmaskedData(null);
    }
  }, [visible]);

  const handleUpdate = async (values) => {
    setLoading(true);
    try {
      const response = await API.post('/auth/profile', values);
      if (response.data.success) {
        message.success('Profile updated successfully');
        setUserData(response.data.data);
        setEditing(false);

        if (values.name !== userData.name || values.email !== userData.email) {
          const loginResponse = localStorage.getItem('loginResponse');
          if (loginResponse) {
            const parsedResponse = JSON.parse(loginResponse);
            if (parsedResponse.user) {
              parsedResponse.user.name = response.data.data.name;
              parsedResponse.user.email = response.data.data.email;
              localStorage.setItem('loginResponse', JSON.stringify(parsedResponse));
            }
          }
          window.dispatchEvent(new Event('userProfileUpdated'));
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      message.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (editing) {
      form.setFieldsValue({
        name: userData.name,
        email: userData.email,
        phoneNo: userData.phoneNo || '',
        designation: userData.designation || '',
        branchName: userData.branchName || '',
      });
      setEditing(false);
    } else {
      onClose();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleConfig = (role) => {
    const config = {
      PRINCIPAL: { color: 'purple', label: 'Principal' },
      STUDENT: { color: 'blue', label: 'Student' },
      TEACHER: { color: 'green', label: 'Teacher' },
      FACULTY_SUPERVISOR: { color: 'cyan', label: 'Faculty Supervisor' },
      INDUSTRY: { color: 'orange', label: 'Industry' },
      STATE_DIRECTORATE: { color: 'red', label: 'State Directorate' },
      SYSTEM_ADMIN: { color: 'magenta', label: 'System Admin' },
      ACCOUNTANT: { color: 'gold', label: 'Accountant' },
      ADMISSION_OFFICER: { color: 'cyan', label: 'Admission Officer' },
    };
    return config[role] || { color: 'default', label: role?.replace(/_/g, ' ') || 'User' };
  };

  const roleConfig = userData ? getRoleConfig(userData.role) : {};

  return (
    <Modal
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={1100}
      centered
      destroyOnClose
      closable={!editing}
      maskClosable={!editing}
      styles={{
        content: { padding: 0, borderRadius: 16, maxHeight: '90vh' },
        body: { padding: 0, maxHeight: '90vh', overflow: 'hidden' },
      }}
    >
      {fetchingProfile ? (
        <div className="flex flex-col justify-center items-center py-16">
          <Spin size="large" />
          <Text className="mt-4 text-text-secondary">Loading profile...</Text>
        </div>
      ) : userData ? (
        <div>
          {/* Header Section */}
          <div className="relative bg-gradient-to-br from-primary/5 to-primary/10 px-6 pt-4 pb-16">
            {/* Action Buttons */}
            <div className="flex justify-end gap-2 mb-3">
              {editing ? (
                <>
                  <Button
                    size="small"
                    onClick={handleCancel}
                    icon={<CloseOutlined />}
                    className="rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    loading={loading}
                    onClick={() => form.submit()}
                    icon={<SaveOutlined />}
                    className="rounded-lg"
                  >
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  onClick={() => setEditing(true)}
                  icon={<EditOutlined />}
                  className="rounded-lg"
                >
                  Edit
                </Button>
              )}
            </div>

            {/* Avatar and Basic Info */}
            <div className="flex items-center gap-4">
              <Avatar
                size={64}
                icon={<UserOutlined />}
                src={userData.profileImage || userData.avatar}
                className="border-4 border-white shadow-lg bg-primary"
              />
              <div className="flex-1">
                <Title level={4} className="!mb-1 !text-text-primary">
                  {userData.name || 'User'}
                </Title>
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag color={roleConfig.color} className="!rounded-md !text-xs">
                    {roleConfig.label}
                  </Tag>
                  <Tag
                    icon={userData.active ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    color={userData.active ? 'success' : 'error'}
                    className="!rounded-md !text-xs"
                  >
                    {userData.active ? 'Active' : 'Inactive'}
                  </Tag>
                  {mfaEnabled && (
                    <Tag icon={<SafetyOutlined />} color="processing" className="!rounded-md !text-xs">
                      2FA Enabled
                    </Tag>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            className="px-6 -mt-6"
            size="small"
            items={[
              {
                key: 'profile',
                label: (
                  <span className="flex items-center gap-1.5 px-1">
                    <UserOutlined />
                    Profile
                  </span>
                ),
                children: (
                  <div className="pb-4">
                    {editing ? (
                      /* Edit Mode */
                      <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleUpdate}
                        requiredMark={false}
                        size="small"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Form.Item
                            name="name"
                            label="Full Name"
                            rules={[
                              { required: true, message: 'Name is required' },
                              { min: 2, message: 'Min 2 characters' }
                            ]}
                          >
                            <Input
                              size="small"
                              prefix={<UserOutlined className="text-text-tertiary" />}
                              placeholder="Enter your name"
                              className="rounded-lg"
                            />
                          </Form.Item>

                          <Form.Item
                            name="email"
                            label="Email Address"
                            rules={[
                              { required: true, message: 'Email is required' },
                              { type: 'email', message: 'Invalid email' }
                            ]}
                          >
                            <Input
                              size="small"
                              prefix={<MailOutlined className="text-text-tertiary" />}
                              placeholder="Enter your email"
                              className="rounded-lg"
                            />
                          </Form.Item>

                          <Form.Item
                            name="phoneNo"
                            label="Phone Number"
                            rules={[{ pattern: /^[0-9]{10}$/, message: 'Enter valid 10-digit number' }]}
                          >
                            <Input
                              size="small"
                              prefix={<PhoneOutlined className="text-text-tertiary" />}
                              placeholder="Enter phone number"
                              maxLength={10}
                              className="rounded-lg"
                            />
                          </Form.Item>

                          <Form.Item
                            name="designation"
                            label="Designation"
                          >
                            <Input
                              size="small"
                              prefix={<IdcardOutlined className="text-text-tertiary" />}
                              placeholder="Enter designation"
                              className="rounded-lg"
                            />
                          </Form.Item>

                          <Form.Item
                            name="branchName"
                            label="Branch / Department"
                            className="md:col-span-2"
                          >
                            <Input
                              size="small"
                              prefix={<BankOutlined className="text-text-tertiary" />}
                              placeholder="Enter branch or department"
                              className="rounded-lg"
                            />
                          </Form.Item>
                        </div>
                      </Form>
                    ) : (
                      /* View Mode */
                      <div className="space-y-4">
                        {/* Contact Information */}
                        <div>
                          <Text className="text-xs text-text-tertiary uppercase tracking-wider mb-2 block">
                            Contact Information
                          </Text>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex items-start gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-background-secondary flex items-center justify-center text-text-tertiary shrink-0 text-sm">
                                <MailOutlined />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Text className="text-xs text-text-tertiary block mb-0.5">Email</Text>
                                <MaskedField
                                  maskedValue={userData.email}
                                  fieldName="email"
                                  onReveal={handleRevealContact}
                                  className="text-sm font-medium text-text-primary"
                                />
                              </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-background-secondary flex items-center justify-center text-text-tertiary shrink-0 text-sm">
                                <PhoneOutlined />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Text className="text-xs text-text-tertiary block mb-0.5">Phone</Text>
                                <MaskedField
                                  maskedValue={userData.phoneNo}
                                  fieldName="phoneNo"
                                  onReveal={handleRevealContact}
                                  className="text-sm font-medium text-text-primary"
                                  placeholder="Not provided"
                                />
                              </div>
                            </div>
                            {userData.rollNumber && (
                              <InfoField
                                icon={<IdcardOutlined />}
                                label="Roll Number"
                                value={userData.rollNumber}
                              />
                            )}
                          </div>
                        </div>

                        {/* Professional Information */}
                        {(userData.designation || userData.branchName || userData.Institution?.name) && (
                          <>
                            <Divider className="!my-3" />
                            <div>
                              <Text className="text-xs text-text-tertiary uppercase tracking-wider mb-2 block">
                                Professional Information
                              </Text>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {userData.designation && (
                                  <InfoField
                                    icon={<SafetyOutlined />}
                                    label="Designation"
                                    value={userData.designation}
                                  />
                                )}
                                {userData.branchName && (
                                  <InfoField
                                    icon={<BankOutlined />}
                                    label="Branch"
                                    value={userData.branchName}
                                  />
                                )}
                                {userData.Institution?.name && (
                                  <InfoField
                                    icon={<BankOutlined />}
                                    label="Institution"
                                    value={userData.Institution.name}
                                  />
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Account Information */}
                        <Divider className="!my-3" />
                        <div>
                          <Text className="text-xs text-text-tertiary uppercase tracking-wider mb-2 block">
                            Account Information
                          </Text>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <InfoField
                              icon={<CalendarOutlined />}
                              label="Member Since"
                              value={formatDate(userData.createdAt)}
                            />
                            {userData.lastLoginAt && (
                              <InfoField
                                icon={<CalendarOutlined />}
                                label="Last Login"
                                value={formatDate(userData.lastLoginAt)}
                              />
                            )}
                            {userData.loginCount > 0 && (
                              <InfoField
                                icon={<UserOutlined />}
                                label="Total Logins"
                                value={userData.loginCount}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'security',
                label: (
                  <span className="flex items-center gap-1.5 px-1">
                    <LockOutlined />
                    Security
                  </span>
                ),
                children: (
                  <div className="pb-4 space-y-4">
                    {/* Two-Factor Authentication */}
                    <div className="p-3 rounded-xl bg-background-secondary border border-border">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-2.5 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <KeyOutlined />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-text-primary mb-0.5 text-sm">
                              Two-Factor Authentication
                            </h4>
                            <Text className="text-xs text-text-tertiary">
                              Add an extra layer of security to your account.
                            </Text>
                          </div>
                        </div>
                        <Tag color={mfaEnabled ? 'success' : 'default'} className="!rounded-md shrink-0 !text-xs">
                          {mfaEnabled ? 'Enabled' : 'Disabled'}
                        </Tag>
                      </div>

                      <Divider className="!my-2" />

                      {mfaEnabled ? (
                        <div>
                          <Text className="text-xs text-text-secondary block mb-2">
                            To disable 2FA, enter a code from your authenticator app:
                          </Text>
                          <div className="flex gap-2 flex-wrap">
                            <Input
                              size="small"
                              value={disableCode}
                              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="Enter 6-digit code"
                              maxLength={6}
                              className="w-36 font-mono rounded-lg"
                            />
                            <Popconfirm
                              title="Disable Two-Factor Authentication?"
                              description="Your account will be less secure without 2FA."
                              onConfirm={handleDisableMfa}
                              okText="Disable"
                              okButtonProps={{ danger: true }}
                            >
                              <Button
                                size="small"
                                danger
                                loading={mfaLoading}
                                disabled={disableCode.length !== 6}
                                className="rounded-lg"
                              >
                                Disable 2FA
                              </Button>
                            </Popconfirm>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="small"
                          type="primary"
                          icon={<SafetyOutlined />}
                          onClick={() => setShowMfaSetup(true)}
                          className="rounded-lg"
                        >
                          Enable Two-Factor Authentication
                        </Button>
                      )}
                    </div>

                    {/* Password Section */}
                    <div className="p-3 rounded-xl bg-background-secondary border border-border">
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <LockOutlined />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-text-primary mb-0.5 text-sm">
                            Password
                          </h4>
                          <Text className="text-xs text-text-tertiary block mb-2">
                            Change your password regularly for better security.
                          </Text>
                          <Button
                            size="small"
                            onClick={() => {
                              onClose();
                              window.location.href = '/app/change-password';
                            }}
                            className="rounded-lg"
                          >
                            Change Password
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },
            ]}
          />

          {/* Footer */}
          {!editing && (
            <div className="px-6 py-3 border-t border-border">
              <div className="flex justify-end">
                <Button size="small" onClick={onClose} className="rounded-lg">
                  Close
                </Button>
              </div>
            </div>
          )}

          {/* MFA Setup Modal */}
          <MfaSetup
            visible={showMfaSetup}
            onClose={() => setShowMfaSetup(false)}
            onSuccess={handleMfaSetupSuccess}
          />
        </div>
      ) : (
        <div className="text-center py-16">
          <Text className="text-text-tertiary">Unable to load profile data</Text>
        </div>
      )}
    </Modal>
  );
};

// Info Field Component
const InfoField = ({ icon, label, value }) => (
  <div className="flex items-start gap-2.5">
    <div className="w-8 h-8 rounded-lg bg-background-secondary flex items-center justify-center text-text-tertiary shrink-0 text-sm">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <Text className="text-xs text-text-tertiary block mb-0.5">{label}</Text>
      <Text className="text-sm font-medium text-text-primary block truncate">
        {value || <span className="text-text-tertiary font-normal italic text-xs">Not provided</span>}
      </Text>
    </div>
  </div>
);

export default UserProfile;
