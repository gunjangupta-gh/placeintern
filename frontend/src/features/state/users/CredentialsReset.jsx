import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Modal,
  Space,
  Tag,
  Alert,
  Progress,
  Switch,
  Tooltip,
  Typography,
  Divider,
  Badge,
  Select,
  Row,
  Col,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  SearchOutlined,
  LockOutlined,
  ReloadOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  BankOutlined,
  FilterOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { credentialsService } from '../../../services/credentials.service';
import { apiClient } from '../../../services/api';
import { debounce } from 'lodash';

const { Title, Text, Paragraph } = Typography;

const CredentialsReset = () => {
  const [users, setUsers] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [selectedRole, setSelectedRole] = useState(undefined);
  const [selectedInstitution, setSelectedInstitution] = useState(undefined);
  const [activeFilter, setActiveFilter] = useState(undefined);

  // Pagination
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [bulkResetModalVisible, setBulkResetModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [resetProgress, setResetProgress] = useState(0);
  const [resetResults, setResetResults] = useState(null);
  const [resultsModalVisible, setResultsModalVisible] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [pagination.current, pagination.pageSize, selectedRole, selectedInstitution, activeFilter]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value) => {
      setPagination(prev => ({ ...prev, current: 1 }));
      fetchUsers(value);
    }, 500),
    [selectedRole, selectedInstitution, activeFilter]
  );

  useEffect(() => {
    debouncedSearch(searchText);
    return () => debouncedSearch.cancel();
  }, [searchText, debouncedSearch]);

  const fetchInstitutions = async () => {
    setInstitutionsLoading(true);
    try {
      const response = await apiClient.get('/state/institutions', { params: { limit: 500 } });
      const data = response.data?.data || response.data || [];
      setInstitutions(data);
    } catch (error) {
      console.error('Failed to fetch institutions:', error);
    } finally {
      setInstitutionsLoading(false);
    }
  };

  const fetchUsers = async (search = searchText) => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
      };

      if (search) params.search = search;
      if (selectedRole) params.role = selectedRole;
      if (selectedInstitution) params.institutionId = selectedInstitution;
      if (activeFilter !== undefined) params.active = activeFilter;

      const response = await apiClient.get('/state/users', { params });
      const usersData = response.data?.data || response.data || [];
      const total = response.data?.total || usersData.length;

      setUsers(usersData);
      setPagination(prev => ({ ...prev, total }));
    } catch (error) {
      toast.error('Failed to fetch users: ' + (error.response?.data?.message || error.message));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (paginationConfig, filters, sorter) => {
    setPagination({
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
      total: pagination.total,
    });
  };

  const clearFilters = () => {
    setSearchText('');
    setSelectedRole(undefined);
    setSelectedInstitution(undefined);
    setActiveFilter(undefined);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleSingleReset = (user) => {
    setCurrentUser(user);
    setResetModalVisible(true);
  };

  const handleBulkReset = () => {
    const selected = users.filter(user => selectedRowKeys.includes(user.id));
    setSelectedUsers(selected);
    setBulkResetModalVisible(true);
  };

  const confirmSingleReset = async () => {
    if (!currentUser) return;

    setResetting(true);
    setResetModalVisible(false);

    try {
      const result = await credentialsService.resetUserPassword(currentUser.id);

      toast.success(
        <span>
          Password reset successfully for <strong>{currentUser.name}</strong>
          {result.newPassword && (
            <div style={{ marginTop: 8, fontSize: '12px' }}>
              New password: <code>{result.newPassword}</code>
            </div>
          )}
        </span>,
        { duration: 8000 }
      );

      setResetResults({
        total: 1,
        successful: 1,
        failed: 0,
        results: [result],
        errors: [],
      });
      setResultsModalVisible(true);
    } catch (error) {
      toast.error('Failed to reset password: ' + (error.response?.data?.message || error.message));
    } finally {
      setResetting(false);
      setCurrentUser(null);
    }
  };

  const confirmBulkReset = async () => {
    if (!selectedUsers.length) return;

    setResetting(true);
    setBulkResetModalVisible(false);
    setResetProgress(0);

    try {
      const userIds = selectedUsers.map(user => user.id);

      const progressInterval = setInterval(() => {
        setResetProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 300);

      const result = await credentialsService.bulkResetPasswords(userIds);

      clearInterval(progressInterval);
      setResetProgress(100);

      setTimeout(() => {
        setResetProgress(0);
        setResetResults(result);
        setResultsModalVisible(true);
        setSelectedRowKeys([]);
        setSelectedUsers([]);

        if (result.successful > 0) {
          toast.success(`Successfully reset ${result.successful} password(s)`);
        }
        if (result.failed > 0) {
          toast(`Failed to reset ${result.failed} password(s)`, { icon: '⚠️' });
        }
      }, 500);
    } catch (error) {
      toast.error('Bulk reset failed: ' + (error.response?.data?.message || error.message));
      setResetProgress(0);
    } finally {
      setResetting(false);
    }
  };

  const downloadResults = () => {
    if (!resetResults) return;

    const csvContent = [
      ['User ID', 'Name', 'Email', 'Status', 'New Password', 'Error'],
      ...resetResults.results.map(r => [
        r.userId,
        r.name || '',
        r.email || '',
        'Success',
        r.newPassword || 'Sent via email',
        '',
      ]),
      ...resetResults.errors.map(e => [
        e.userId,
        '',
        '',
        'Failed',
        '',
        e.error || '',
      ]),
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `password-reset-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const roleOptions = [
    { label: 'System Admin', value: 'SYSTEM_ADMIN' },
    { label: 'State Directorate', value: 'STATE_DIRECTORATE' },
    { label: 'Principal', value: 'PRINCIPAL' },
    { label: 'Teacher', value: 'TEACHER' },
    { label: 'Faculty Supervisor', value: 'FACULTY_SUPERVISOR' },
    { label: 'Placement Officer', value: 'PLACEMENT_OFFICER' },
    { label: 'Student', value: 'STUDENT' },
    { label: 'Industry', value: 'INDUSTRY' },
  ];

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <UserOutlined />
          <div>
            <div className="font-medium">{text}</div>
            <div className="text-gray-500 text-xs">{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 150,
      render: (role) => {
        const roleColors = {
          SYSTEM_ADMIN: 'red',
          STATE_DIRECTORATE: 'purple',
          PRINCIPAL: 'blue',
          TEACHER: 'green',
          FACULTY_SUPERVISOR: 'cyan',
          PLACEMENT_OFFICER: 'geekblue',
          STUDENT: 'default',
          INDUSTRY: 'orange',
        };
        return <Tag color={roleColors[role] || 'default'}>{role?.replace(/_/g, ' ')}</Tag>;
      },
    },
    {
      title: 'Institution',
      dataIndex: 'Institution',
      key: 'institution',
      width: 200,
      render: (institution) => (
        institution ? (
          <Space>
            <BankOutlined className="text-blue-500" />
            <span>{institution.name}</span>
          </Space>
        ) : (
          <Text type="secondary">Not Assigned</Text>
        )
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 160,
      render: (date) => date ? new Date(date).toLocaleString('en-IN') : <Text type="secondary">Never</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active) => (
        <Badge
          status={active ? 'success' : 'error'}
          text={active ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Tooltip title="Reset Password">
          <Button
            type="primary"
            icon={<LockOutlined />}
            size="small"
            onClick={() => handleSingleReset(record)}
            disabled={!record.active || resetting}
          >
            Reset
          </Button>
        </Tooltip>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys) => {
      setSelectedRowKeys(selectedKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: !record.active,
    }),
  };

  const hasActiveFilters = searchText || selectedRole || selectedInstitution || activeFilter !== undefined;

  return (
    <div className="p-6">
      <Card
        title={
          <Space>
            <LockOutlined style={{ fontSize: '24px' }} />
            <Title level={3} style={{ margin: 0 }}>Reset User Credentials</Title>
          </Space>
        }
        extra={
          <Space>
            <Tooltip title="Refresh user list">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchUsers()}
                loading={loading}
              >
                Refresh
              </Button>
            </Tooltip>
            {selectedRowKeys.length > 0 && (
              <Badge count={selectedRowKeys.length}>
                <Button
                  type="primary"
                  danger
                  icon={<LockOutlined />}
                  onClick={handleBulkReset}
                  disabled={resetting}
                >
                  Reset Selected
                </Button>
              </Badge>
            )}
          </Space>
        }
        variant="borderless"
      >
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            title="Password Reset Guidelines"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li>Passwords will be automatically generated (8 characters with uppercase, lowercase, and numbers)</li>
                <li>Users will be notified via email with their new credentials</li>
                <li>Users will be forced to change password on next login</li>
                <li>All active sessions will be terminated immediately</li>
                <li>Only active users can have their passwords reset</li>
              </ul>
            }
            type="info"
            showIcon
          />

          {resetting && resetProgress > 0 && (
            <Alert
              title="Resetting Passwords..."
              description={
                <Progress
                  percent={resetProgress}
                  status={resetProgress === 100 ? 'success' : 'active'}
                />
              }
              type="info"
              showIcon
            />
          )}

          {/* Filters Section */}
          <Card size="small" className="bg-gray-50 dark:bg-gray-800">
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={12} md={6}>
                <Input.Search
                  placeholder="Search by name or email..."
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={5}>
                <Select
                  placeholder="Filter by Role"
                  value={selectedRole}
                  onChange={(value) => {
                    setSelectedRole(value);
                    setPagination(prev => ({ ...prev, current: 1 }));
                  }}
                  allowClear
                  style={{ width: '100%' }}
                  options={roleOptions}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Filter by Institution"
                  value={selectedInstitution}
                  onChange={(value) => {
                    setSelectedInstitution(value);
                    setPagination(prev => ({ ...prev, current: 1 }));
                  }}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={institutionsLoading}
                  style={{ width: '100%' }}
                  options={institutions.map(inst => ({
                    label: inst.name,
                    value: inst.id,
                  }))}
                />
              </Col>
              <Col xs={24} sm={12} md={4}>
                <Select
                  placeholder="Status"
                  value={activeFilter}
                  onChange={(value) => {
                    setActiveFilter(value);
                    setPagination(prev => ({ ...prev, current: 1 }));
                  }}
                  allowClear
                  style={{ width: '100%' }}
                  options={[
                    { label: 'Active', value: true },
                    { label: 'Inactive', value: false },
                  ]}
                />
              </Col>
              <Col xs={24} sm={12} md={3}>
                {hasActiveFilters && (
                  <Button
                    icon={<ClearOutlined />}
                    onClick={clearFilters}
                    type="text"
                  >
                    Clear
                  </Button>
                )}
              </Col>
            </Row>
          </Card>

          <Table
            columns={columns}
            dataSource={users}
            loading={loading}
            rowKey="id"
            rowSelection={rowSelection}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            onChange={handleTableChange}
            scroll={{ x: 1000 }}
          />
        </Space>
      </Card>

      {/* Single Reset Confirmation Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined className="text-yellow-500" />
            <span>Confirm Password Reset</span>
          </Space>
        }
        open={resetModalVisible}
        onOk={confirmSingleReset}
        onCancel={() => {
          setResetModalVisible(false);
          setCurrentUser(null);
        }}
        okText="Reset Password"
        okButtonProps={{ danger: true }}
        confirmLoading={resetting}
      >
        {currentUser && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Paragraph>
              Are you sure you want to reset the password for:
            </Paragraph>
            <Card size="small">
              <p><strong>Name:</strong> {currentUser.name}</p>
              <p><strong>Email:</strong> {currentUser.email}</p>
              <p><strong>Role:</strong> <Tag color="blue">{currentUser.role}</Tag></p>
              {currentUser.Institution && (
                <p><strong>Institution:</strong> {currentUser.Institution.name}</p>
              )}
            </Card>
            <Alert
              title="This action will:"
              description={
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  <li>Generate a new random password</li>
                  <li>Logout the user from all devices</li>
                  <li>Send an email notification with new credentials</li>
                  <li>Require password change on next login</li>
                </ul>
              }
              type="warning"
              showIcon
            />
            <Divider style={{ margin: '12px 0' }} />
            <Space>
              <Switch checked={sendEmail} onChange={setSendEmail} />
              <Text>Send password reset email to user</Text>
            </Space>
          </Space>
        )}
      </Modal>

      {/* Bulk Reset Confirmation Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined className="text-yellow-500" />
            <span>Confirm Bulk Password Reset</span>
          </Space>
        }
        open={bulkResetModalVisible}
        onOk={confirmBulkReset}
        onCancel={() => {
          setBulkResetModalVisible(false);
          setSelectedUsers([]);
        }}
        okText={`Reset ${selectedUsers.length} Password(s)`}
        okButtonProps={{ danger: true }}
        confirmLoading={resetting}
        width={600}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Alert
            title={`You are about to reset passwords for ${selectedUsers.length} user(s)`}
            type="warning"
            showIcon
          />
          <Paragraph>
            <strong>Selected Users:</strong>
          </Paragraph>
          <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #f0f0f0', padding: 8, borderRadius: 4 }}>
            {selectedUsers.map(user => (
              <div key={user.id} style={{ padding: '4px 0' }}>
                <Tag color="blue">{user.role}</Tag> {user.name} - {user.email}
                {user.Institution && <Text type="secondary"> ({user.Institution.name})</Text>}
              </div>
            ))}
          </div>
          <Alert
            title="This action will:"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li>Generate new random passwords for all selected users</li>
                <li>Logout all users from all devices</li>
                <li>Send email notifications with new credentials</li>
                <li>Require password change on next login</li>
              </ul>
            }
            type="warning"
            showIcon
          />
          <Divider style={{ margin: '12px 0' }} />
          <Space>
            <Switch checked={sendEmail} onChange={setSendEmail} />
            <Text>Send password reset emails to users</Text>
          </Space>
        </Space>
      </Modal>

      {/* Results Modal */}
      <Modal
        title={
          <Space>
            {resetResults && resetResults.failed === 0 ? (
              <CheckCircleOutlined className="text-green-500" />
            ) : (
              <ExclamationCircleOutlined className="text-yellow-500" />
            )}
            <span>Password Reset Results</span>
          </Space>
        }
        open={resultsModalVisible}
        onCancel={() => {
          setResultsModalVisible(false);
          setResetResults(null);
        }}
        footer={[
          <Button
            key="download"
            icon={<DownloadOutlined />}
            onClick={downloadResults}
          >
            Download Report
          </Button>,
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setResultsModalVisible(false);
              setResetResults(null);
            }}
          >
            Close
          </Button>,
        ]}
        width={700}
      >
        {resetResults && (
          <Space orientation="vertical" style={{ width: '100%' }} size="large">
            <div style={{ display: 'flex', gap: 16 }}>
              <Card size="small" style={{ flex: 1 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold' }}>{resetResults.total}</div>
                  <div className="text-gray-500">Total</div>
                </div>
              </Card>
              <Card size="small" className="flex-1 border-green-500">
                <div style={{ textAlign: 'center' }}>
                  <div className="text-2xl font-bold text-green-500">
                    {resetResults.successful}
                  </div>
                  <div className="text-gray-500">Successful</div>
                </div>
              </Card>
              <Card size="small" className="flex-1 border-red-500">
                <div style={{ textAlign: 'center' }}>
                  <div className="text-2xl font-bold text-red-500">
                    {resetResults.failed}
                  </div>
                  <div className="text-gray-500">Failed</div>
                </div>
              </Card>
            </div>

            {resetResults.results.length > 0 && (
              <>
                <Divider plain>Successful Resets</Divider>
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {resetResults.results.map((result, index) => (
                    <Alert
                      key={index}
                      title={
                        <Space>
                          <CheckCircleOutlined className="text-green-500" />
                          <span>{result.name} ({result.email})</span>
                        </Space>
                      }
                      description={
                        result.newPassword && (
                          <Text copyable code style={{ fontSize: 12 }}>
                            New password: {result.newPassword}
                          </Text>
                        )
                      }
                      type="success"
                      style={{ marginBottom: 8 }}
                    />
                  ))}
                </div>
              </>
            )}

            {resetResults.errors.length > 0 && (
              <>
                <Divider plain>Failed Resets</Divider>
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {resetResults.errors.map((error, index) => (
                    <Alert
                      key={index}
                      title={
                        <Space>
                          <CloseCircleOutlined className="text-red-500" />
                          <span>User ID: {error.userId}</span>
                        </Space>
                      }
                      description={error.error}
                      type="error"
                      style={{ marginBottom: 8 }}
                    />
                  ))}
                </div>
              </>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default CredentialsReset;
