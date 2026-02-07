import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  Badge,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  LockOutlined,
  UserOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { adminService } from '../../../services/admin.service';
import { Progress } from 'antd';

const { Text } = Typography;

const ROLES = [
  { value: 'SYSTEM_ADMIN', label: 'System Admin', color: 'red' },
  { value: 'STATE_DIRECTORATE', label: 'State Directorate', color: 'purple' },
  { value: 'PRINCIPAL', label: 'Principal', color: 'blue' },
  { value: 'FACULTY', label: 'Faculty', color: 'cyan' },
  { value: 'FACULTY_SUPERVISOR', label: 'Faculty Supervisor', color: 'cyan' },
  { value: 'TEACHER', label: 'Teacher', color: 'geekblue' },
  { value: 'STUDENT', label: 'Student', color: 'green' },
  { value: 'INDUSTRY', label: 'Industry', color: 'orange' },
  { value: 'INDUSTRY_PARTNER', label: 'Industry Partner', color: 'orange' },
];

const UserManagement = ({ bulkOperationProgress, connected }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [roleStats, setRoleStats] = useState({});
  const [filters, setFilters] = useState({ search: '', role: undefined, isActive: undefined });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [form] = Form.useForm();

  const fetchUsers = useCallback(async (page = 1, limit = 20) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        ...filters,
      };
      const data = await adminService.getUsers(params);
      setUsers(data.users || []);
      setRoleStats(data.roleStats || {});
      setPagination({
        current: data.page || 1,
        pageSize: data.limit || 20,
        total: data.total || 0,
      });
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Refresh users when bulk operation completes via WebSocket
  useEffect(() => {
    if (bulkOperationProgress?.completed === bulkOperationProgress?.total && bulkOperationProgress?.total > 0) {
      fetchUsers();
    }
  }, [bulkOperationProgress, fetchUsers]);

  const handleTableChange = (paginationConfig) => {
    fetchUsers(paginationConfig.current, paginationConfig.pageSize);
  };

  const handleSearch = (value) => {
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleRoleFilter = (value) => {
    setFilters((prev) => ({ ...prev, role: value }));
  };

  const handleStatusFilter = (value) => {
    setFilters((prev) => ({ ...prev, isActive: value }));
  };

  const handleCreateOrUpdate = async (values) => {
    try {
      setSubmitLoading(true);
      if (editingUser) {
        await adminService.updateUser(editingUser.id, values);
        toast.success('User updated successfully');
      } else {
        const result = await adminService.createUser(values);
        if (result.temporaryPassword) {
          Modal.success({
            title: 'User Created',
            content: (
              <div>
                <p>User has been created successfully.</p>
                <p>
                  <strong>Temporary Password:</strong>{' '}
                  <code className="bg-gray-100 px-2 py-1 rounded">{result.temporaryPassword}</code>
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Please share this password securely with the user.
                </p>
              </div>
            ),
          });
        } else {
          toast.success('User created successfully');
        }
      }
      setModalOpen(false);
      setEditingUser(null);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      toast.error(error.response?.data?.message || 'Failed to save user');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      role: user.role,
      phoneNo: user.phoneNo,
      active: user.active,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id, permanent = false) => {
    try {
      await adminService.deleteUser(id, permanent);
      toast.success(permanent ? 'User permanently deleted' : 'User deactivated');
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleResetPassword = async (id) => {
    try {
      const result = await adminService.resetUserPassword(id);
      Modal.success({
        title: 'Password Reset',
        content: (
          <div>
            <p>Password has been reset successfully.</p>
            <p>
              <strong>New Temporary Password:</strong>{' '}
              <code className="bg-gray-100 px-2 py-1 rounded">{result.temporaryPassword}</code>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Please share this password securely with the user.
            </p>
          </div>
        ),
      });
    } catch (error) {
      console.error('Failed to reset password:', error);
      toast.error('Failed to reset password');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedRowKeys.length === 0) {
      toast.warning('Please select users first');
      return;
    }
    try {
      await adminService.bulkUserAction({ action, userIds: selectedRowKeys });
      toast.success(`Bulk ${action} completed`);
      setSelectedRowKeys([]);
      fetchUsers();
    } catch (error) {
      console.error('Bulk action failed:', error);
      toast.error('Bulk action failed');
    }
  };

  const getRoleTag = (role) => {
    const roleConfig = ROLES.find((r) => r.value === role);
    return (
      <Tag color={roleConfig?.color || 'default'}>
        {roleConfig?.label || role}
      </Tag>
    );
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <UserOutlined className="text-primary" />
          </div>
          <div>
            <Text strong className="block">{record.name}</Text>
            <Text className="text-text-tertiary text-sm">{record.email}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      render: (role) => getRoleTag(role),
    },
    {
      title: 'Institution',
      dataIndex: 'institutionName',
      key: 'institutionName',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active) =>
        active ? (
          <Badge status="success" text="Active" />
        ) : (
          <Badge status="error" text="Inactive" />
        ),
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 160,
      render: (date) => (date ? new Date(date).toLocaleDateString() : 'Never'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Reset password?"
            description="A new temporary password will be generated."
            onConfirm={() => handleResetPassword(record.id)}
            okText="Reset"
            cancelText="Cancel"
          >
            <Button type="link" size="small" icon={<LockOutlined />} />
          </Popconfirm>
          <Popconfirm
            title="Deactivate user?"
            description="All mentor assignments will be permanently deleted and new assignments will need to be created. Faculty visits will be preserved."
            onConfirm={() => handleDelete(record.id, false)}
            okText="Deactivate"
            cancelText="Cancel"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  return (
    <div className="space-y-6">
      {/* Real-time Bulk Operation Progress */}
      {bulkOperationProgress && bulkOperationProgress.completed < bulkOperationProgress.total && (
        <Card className="shadow-sm border-primary/50 rounded-xl bg-primary/5">
          <div className="flex items-center gap-4">
            <SyncOutlined spin className="text-primary text-2xl" />
            <div className="flex-1">
              <Text strong className="text-text-primary block">
                Bulk {bulkOperationProgress.type || 'Operation'} in Progress
              </Text>
              <Text className="text-text-secondary text-sm">
                Processing {bulkOperationProgress.completed} of {bulkOperationProgress.total} users...
              </Text>
              <Progress
                percent={Math.round((bulkOperationProgress.completed / bulkOperationProgress.total) * 100)}
                status="active"
                className="mt-2 mb-0"
                strokeColor={{ from: '#1890ff', to: '#52c41a' }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Stats Row */}
      <Row gutter={[16, 16]}>
        {Object.entries(roleStats).slice(0, 6).map(([role, count]) => {
          const roleConfig = ROLES.find((r) => r.value === role);
          return (
            <Col xs={12} sm={8} md={4} key={role}>
              <Card className="shadow-sm border-border rounded-xl bg-surface text-center">
                <Statistic
                  title={<span className="text-xs">{roleConfig?.label || role}</span>}
                  value={count}
                  valueStyle={{ fontSize: '1.5rem' }}
                />
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Filters and Actions */}
      <Card className="shadow-sm border-border rounded-xl bg-surface">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3">
            <Input.Search
              placeholder="Search users..."
              allowClear
              onSearch={handleSearch}
              style={{ width: 250 }}
              prefix={<SearchOutlined className="text-text-tertiary" />}
            />
            <Select
              placeholder="Filter by Role"
              allowClear
              onChange={handleRoleFilter}
              style={{ width: 180 }}
            >
              {ROLES.map((role) => (
                <Select.Option key={role.value} value={role.value}>
                  {role.label}
                </Select.Option>
              ))}
            </Select>
            <Select
              placeholder="Status"
              allowClear
              onChange={handleStatusFilter}
              style={{ width: 120 }}
            >
              <Select.Option value={true}>Active</Select.Option>
              <Select.Option value={false}>Inactive</Select.Option>
            </Select>
          </div>
          <div className="flex gap-2">
            {selectedRowKeys.length > 0 && (
              <>
                <Button onClick={() => handleBulkAction('activate')}>
                  <CheckCircleOutlined /> Activate
                </Button>
                <Button onClick={() => handleBulkAction('deactivate')}>
                  <CloseCircleOutlined /> Deactivate
                </Button>
              </>
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingUser(null);
                form.resetFields();
                setModalOpen(true);
              }}
            >
              Create User
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => fetchUsers()}>
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="shadow-sm border-border rounded-2xl bg-surface">
        <Table
          columns={columns}
          dataSource={users}
          loading={loading}
          rowKey="id"
          rowSelection={rowSelection}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} users`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* Create/Edit User Modal */}
      <Modal
        title={editingUser ? 'Edit User' : 'Create New User'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingUser(null);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateOrUpdate}>
          <Form.Item
            name="name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter name' }]}
          >
            <Input placeholder="Enter full name" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input placeholder="Enter email address" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select role' }]}
          >
            <Select placeholder="Select role">
              {ROLES.map((role) => (
                <Select.Option key={role.value} value={role.value}>
                  {role.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="phoneNo" label="Phone Number">
            <Input placeholder="Enter phone number" />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="password"
              label="Password"
              extra="Leave empty to auto-generate a temporary password"
            >
              <Input.Password placeholder="Enter password (optional)" />
            </Form.Item>
          )}
          {editingUser && (
            <Form.Item name="active" label="Status">
              <Select>
                <Select.Option value={true}>Active</Select.Option>
                <Select.Option value={false}>Inactive</Select.Option>
              </Select>
            </Form.Item>
          )}
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setModalOpen(false);
                  setEditingUser(null);
                }}
              >
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={submitLoading}>
                {editingUser ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
