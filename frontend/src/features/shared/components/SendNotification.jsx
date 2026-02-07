import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Checkbox,
  Space,
  Alert,
  Tag,
  Divider,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  SendOutlined,
  BellOutlined,
  TeamOutlined,
  GlobalOutlined,
  UserOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import NotificationService from '../../../services/notification.service';

const { TextArea } = Input;
const { Option } = Select;

// Role display names (matching backend Role enum)
const ROLE_LABELS = {
  STUDENT: 'Students',
  TEACHER: 'Teachers',
  FACULTY_SUPERVISOR: 'Faculty Supervisors',
  PRINCIPAL: 'Principals',
  STATE_DIRECTORATE: 'State Directorate',
  SYSTEM_ADMIN: 'System Admins',
  INDUSTRY: 'Industry Partners',
  INDUSTRY_SUPERVISOR: 'Industry Supervisors',
  ACCOUNTANT: 'Accountants',
  ADMISSION_OFFICER: 'Admission Officers',
  EXAMINATION_OFFICER: 'Examination Officers',
  PLACEMENT_OFFICER: 'Placement Officers',
  PMS_OFFICER: 'PMS Officers',
  EXTRACURRICULAR_HEAD: 'Extracurricular Heads',
};

const SendNotification = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sendType, setSendType] = useState(null);

  const { user } = useSelector((state) => state.auth);
  const userRole = user?.role;

  // Determine what send options are available based on user role
  const getSendOptions = () => {
    const options = [];

    if (['TEACHER', 'FACULTY_SUPERVISOR'].includes(userRole)) {
      options.push({
        key: 'student-reminder',
        label: 'Send to My Students',
        icon: <TeamOutlined />,
        description: 'Send a reminder to all your assigned students',
      });
    }

    if (userRole === 'PRINCIPAL') {
      options.push({
        key: 'institution',
        label: 'Institution Announcement',
        icon: <BellOutlined />,
        description: 'Send an announcement to your entire institution',
      });
    }

    if (['STATE_DIRECTORATE', 'SYSTEM_ADMIN'].includes(userRole)) {
      options.push({
        key: 'system',
        label: 'System Announcement',
        icon: <GlobalOutlined />,
        description: 'Send a system-wide announcement to all users',
      });
      options.push({
        key: 'role',
        label: 'Send to Specific Role',
        icon: <UserOutlined />,
        description: 'Send to all users with a specific role',
      });
    }

    return options;
  };

  const sendOptions = getSendOptions();

  const handleSendTypeChange = (type) => {
    setSendType(type);
    form.resetFields(['title', 'body', 'targetRoles', 'sendEmail', 'force']);
  };

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      let response;

      switch (sendType) {
        case 'student-reminder':
          response = await NotificationService.sendStudentReminder({
            title: values.title,
            body: values.body,
            sendEmail: values.sendEmail,
          });
          break;

        case 'institution':
          response = await NotificationService.sendInstitutionAnnouncement({
            title: values.title,
            body: values.body,
            targetRoles: values.targetRoles,
            sendEmail: values.sendEmail,
          });
          break;

        case 'system':
          response = await NotificationService.sendSystemAnnouncement({
            title: values.title,
            body: values.body,
            targetRoles: values.targetRoles,
            sendEmail: values.sendEmail,
            force: values.force,
          });
          break;

        case 'role':
          response = await NotificationService.send({
            target: 'role',
            role: values.targetRoles, // Single value from non-multiple Select
            title: values.title,
            body: values.body,
            sendEmail: values.sendEmail,
          });
          break;

        default:
          throw new Error('Please select a send type');
      }

      const data = response.data;
      toast.success(data.message || `Notification sent to ${data.sentCount || 0} users`);
      form.resetFields();
      setSendType(null);
    } catch (error) {
      console.error('Failed to send notification:', error);
      toast.error(error.response?.data?.message || 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  // Get available roles for targeting based on user's role
  const getTargetRoles = () => {
    if (userRole === 'PRINCIPAL') {
      // All institution staff and student roles
      return [
        'STUDENT',
        'TEACHER',
        'FACULTY_SUPERVISOR',
        'ACCOUNTANT',
        'ADMISSION_OFFICER',
        'EXAMINATION_OFFICER',
        'PLACEMENT_OFFICER',
        'PMS_OFFICER',
        'EXTRACURRICULAR_HEAD',
      ];
    }
    if (['STATE_DIRECTORATE', 'SYSTEM_ADMIN'].includes(userRole)) {
      return Object.keys(ROLE_LABELS);
    }
    return [];
  };

  if (sendOptions.length === 0) {
    return (
      <Card>
        <Alert
          title="Not Available"
          description="You don't have permission to send notifications."
          type="info"
          showIcon
        />
      </Card>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SendOutlined /> Send Notification
        </h1>
        <p className="text-gray-500">
          Send announcements and reminders to users
        </p>
      </div>

      {/* Send Type Selection */}
      {!sendType && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sendOptions.map((option) => (
            <Card
              key={option.key}
              hoverable
              className="cursor-pointer transition-all hover:border-blue-500"
              onClick={() => handleSendTypeChange(option.key)}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl text-blue-500">{option.icon}</div>
                <div>
                  <h3 className="text-lg font-semibold">{option.label}</h3>
                  <p className="text-gray-500">{option.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Notification Form */}
      {sendType && (
        <Card>
          <div className="mb-4">
            <Button type="link" onClick={() => setSendType(null)} className="p-0">
              &larr; Back to options
            </Button>
            <Tag color="blue" className="ml-2">
              {sendOptions.find((o) => o.key === sendType)?.label}
            </Tag>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ sendEmail: false, force: false }}
          >
            <Form.Item
              name="title"
              label="Title"
              rules={[
                { required: true, message: 'Please enter a title' },
                { min: 3, message: 'Title must be at least 3 characters' },
                { max: 100, message: 'Title cannot exceed 100 characters' },
              ]}
            >
              <Input
                placeholder="Enter notification title"
                prefix={<BellOutlined />}
                maxLength={100}
                showCount
              />
            </Form.Item>

            <Form.Item
              name="body"
              label="Message"
              rules={[
                { required: true, message: 'Please enter a message' },
                { min: 5, message: 'Message must be at least 5 characters' },
                { max: 1000, message: 'Message cannot exceed 1000 characters' },
              ]}
            >
              <TextArea
                placeholder="Enter your notification message..."
                rows={4}
                maxLength={1000}
                showCount
              />
            </Form.Item>

            {/* Role targeting for institution/system announcements */}
            {(sendType === 'institution' || sendType === 'system') && (
              <Form.Item
                name="targetRoles"
                label="Target Roles (optional)"
                extra="Leave empty to send to all users"
              >
                <Select
                  mode="multiple"
                  placeholder="Select specific roles to target"
                  allowClear
                >
                  {getTargetRoles().map((role) => (
                    <Option key={role} value={role}>
                      {ROLE_LABELS[role] || role}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            {/* Single role selection for role-based sending */}
            {sendType === 'role' && (
              <Form.Item
                name="targetRoles"
                label="Select Role"
                rules={[{ required: true, message: 'Please select a role' }]}
              >
                <Select placeholder="Select a role">
                  {getTargetRoles().map((role) => (
                    <Option key={role} value={role}>
                      {ROLE_LABELS[role] || role}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            <Divider />

            <Space direction="vertical" className="w-full">
              <Form.Item name="sendEmail" valuePropName="checked" className="mb-2">
                <Checkbox>
                  <Space>
                    <MailOutlined />
                    Also send email notification
                  </Space>
                </Checkbox>
              </Form.Item>

              {sendType === 'system' && (
                <Form.Item name="force" valuePropName="checked" className="mb-2">
                  <Checkbox>
                    Force send (bypass user notification settings)
                  </Checkbox>
                </Form.Item>
              )}
            </Space>

            <Divider />

            <Form.Item className="mb-0">
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={loading}
                  size="large"
                >
                  Send Notification
                </Button>
                <Button onClick={() => form.resetFields()}>
                  Clear
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}
    </div>
  );
};

export default SendNotification;
