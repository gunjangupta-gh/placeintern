import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  DatePicker,
  Tag,
  Space,
  Popconfirm,
  message,
  Spin,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  NotificationOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  BellOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminService } from '../../../services/admin.service';

const { TextArea } = Input;
const { Text } = Typography;

const ALERT_TYPES = [
  { value: 'INFO', label: 'Information', color: 'blue', icon: <InfoCircleOutlined /> },
  { value: 'WARNING', label: 'Warning', color: 'orange', icon: <WarningOutlined /> },
  { value: 'ERROR', label: 'Error', color: 'red', icon: <ExclamationCircleOutlined /> },
  { value: 'SUCCESS', label: 'Success', color: 'green', icon: <CheckCircleOutlined /> },
  { value: 'ANNOUNCEMENT', label: 'Announcement', color: 'purple', icon: <NotificationOutlined /> },
];

const ALERT_PRIORITIES = [
  { value: 'LOW', label: 'Low', color: 'default' },
  { value: 'NORMAL', label: 'Normal', color: 'blue' },
  { value: 'HIGH', label: 'High', color: 'orange' },
  { value: 'URGENT', label: 'Urgent', color: 'red' },
];

const USER_ROLES = [
  { value: 'STUDENT', label: 'Students' },
  { value: 'TEACHER', label: 'Faculty' },
  { value: 'PRINCIPAL', label: 'Principals' },
  { value: 'STATE_DIRECTORATE', label: 'State Directorate' },
  { value: 'SYSTEM_ADMIN', label: 'System Admins' },
];

const AlertGenerator = () => {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [form] = Form.useForm();

  const fetchAlerts = async (page = 1) => {
    try {
      setLoading(true);
      const response = await adminService.getSystemAlerts({ page, limit: pagination.limit });
      setAlerts(response.data || []);
      setPagination(prev => ({
        ...prev,
        page: response.pagination?.page || 1,
        total: response.pagination?.total || 0,
      }));
    } catch (error) {
      message.error('Failed to fetch alerts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await adminService.getSystemAlertStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchStats();
  }, []);

  const handleCreate = () => {
    setEditingAlert(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'INFO',
      priority: 'NORMAL',
      targetRoles: ['STUDENT', 'TEACHER', 'PRINCIPAL'],
      isDismissible: true,
      isActive: true,
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingAlert(record);
    form.setFieldsValue({
      title: record.title,
      message: record.message,
      type: record.type,
      priority: record.priority,
      targetRoles: record.targetRoles,
      isDismissible: record.isDismissible,
      isActive: record.isActive,
      startDate: record.startDate ? dayjs(record.startDate) : null,
      endDate: record.endDate ? dayjs(record.endDate) : null,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await adminService.deleteSystemAlert(id);
      message.success('Alert deleted successfully');
      fetchAlerts(pagination.page);
      fetchStats();
    } catch (error) {
      message.error('Failed to delete alert');
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      const data = {
        ...values,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
      };

      if (editingAlert) {
        await adminService.updateSystemAlert(editingAlert.id, data);
        message.success('Alert updated successfully');
      } else {
        await adminService.createSystemAlert(data);
        message.success('Alert created successfully');
      }

      setModalVisible(false);
      fetchAlerts(pagination.page);
      fetchStats();
    } catch (error) {
      message.error(editingAlert ? 'Failed to update alert' : 'Failed to create alert');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = async (record) => {
    try {
      const detail = await adminService.getSystemAlertById(record.id);
      setSelectedAlert(detail);
      setDetailModalVisible(true);
    } catch (error) {
      message.error('Failed to fetch alert details');
    }
  };

  const getTypeConfig = (type) => ALERT_TYPES.find(t => t.value === type) || ALERT_TYPES[0];
  const getPriorityConfig = (priority) => ALERT_PRIORITIES.find(p => p.value === priority) || ALERT_PRIORITIES[1];

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div className="flex items-center gap-2">
          {getTypeConfig(record.type).icon}
          <span className="font-medium">{text}</span>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (type) => {
        const config = getTypeConfig(type);
        return <Tag color={config.color}>{config.label}</Tag>;
      },
      filters: ALERT_TYPES.map(t => ({ text: t.label, value: t.value })),
      onFilter: (value, record) => record.type === value,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => {
        const config = getPriorityConfig(priority);
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Target Roles',
      dataIndex: 'targetRoles',
      key: 'targetRoles',
      width: 200,
      render: (roles) => (
        <div className="flex flex-wrap gap-1">
          {roles?.slice(0, 2).map(role => (
            <Tag key={role} className="text-xs">
              {USER_ROLES.find(r => r.value === role)?.label || role}
            </Tag>
          ))}
          {roles?.length > 2 && (
            <Tooltip title={roles.slice(2).map(r => USER_ROLES.find(ur => ur.value === r)?.label || r).join(', ')}>
              <Tag className="text-xs">+{roles.length - 2}</Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive) => (
        <Badge status={isActive ? 'success' : 'default'} text={isActive ? 'Active' : 'Inactive'} />
      ),
    },
    {
      title: 'Dismissals',
      key: 'dismissals',
      width: 100,
      render: (_, record) => (
        <span className="text-gray-500">{record._count?.dismissedBy || 0}</span>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => dayjs(date).format('MMM D, YYYY'),
      sorter: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this alert?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BellOutlined /> Alert Generator
          </h1>
          <p className="text-gray-500">Create and manage system-wide alerts for users</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchAlerts(); fetchStats(); }}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Alert
          </Button>
        </Space>
      </div>

      {/* Stats */}
      {stats && (
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={6}>
            <Card>
              <Statistic title="Total Alerts" value={stats.total} prefix={<NotificationOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="Active Alerts"
                value={stats.active}
                valueStyle={{ color: stats.active > 0 ? '#52c41a' : undefined }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="High Priority"
                value={(stats.byPriority?.HIGH || 0) + (stats.byPriority?.URGENT || 0)}
                valueStyle={{ color: '#fa8c16' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="Announcements"
                value={stats.byType?.ANNOUNCEMENT || 0}
                prefix={<NotificationOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Alerts Table */}
      <Card>
        <Table
          loading={loading}
          dataSource={alerts}
          columns={columns}
          rowKey="id"
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            onChange: (page) => fetchAlerts(page),
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} alerts`,
          }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingAlert ? 'Edit Alert' : 'Create New Alert'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="mt-4"
        >
          <Form.Item
            name="title"
            label="Alert Title"
            rules={[{ required: true, message: 'Please enter alert title' }]}
          >
            <Input placeholder="Enter alert title" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="message"
            label="Message"
            rules={[{ required: true, message: 'Please enter alert message' }]}
          >
            <TextArea
              rows={4}
              placeholder="Enter the alert message that users will see"
              maxLength={1000}
              showCount
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Alert Type">
                <Select>
                  {ALERT_TYPES.map(type => (
                    <Select.Option key={type.value} value={type.value}>
                      <Space>
                        {type.icon}
                        {type.label}
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Priority">
                <Select>
                  {ALERT_PRIORITIES.map(p => (
                    <Select.Option key={p.value} value={p.value}>
                      <Tag color={p.color}>{p.label}</Tag>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="targetRoles"
            label="Target User Roles"
            rules={[{ required: true, message: 'Please select at least one role' }]}
          >
            <Select mode="multiple" placeholder="Select roles that should see this alert">
              {USER_ROLES.map(role => (
                <Select.Option key={role.value} value={role.value}>
                  {role.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startDate" label="Start Date (Optional)">
                <DatePicker className="w-full" showTime />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endDate" label="End Date (Optional)">
                <DatePicker className="w-full" showTime />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="isDismissible" label="Allow Dismiss" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            {editingAlert && (
              <Col span={12}>
                <Form.Item name="isActive" label="Active" valuePropName="checked">
                  <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                </Form.Item>
              </Col>
            )}
          </Row>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setModalVisible(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {editingAlert ? 'Update Alert' : 'Create Alert'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="Alert Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={<Button onClick={() => setDetailModalVisible(false)}>Close</Button>}
        width={600}
      >
        {selectedAlert && (
          <div className="space-y-4">
            <div>
              <Text type="secondary">Title</Text>
              <div className="font-medium text-lg">{selectedAlert.title}</div>
            </div>
            <div>
              <Text type="secondary">Message</Text>
              <div className="bg-gray-50 p-3 rounded mt-1">{selectedAlert.message}</div>
            </div>
            <Row gutter={16}>
              <Col span={8}>
                <Text type="secondary">Type</Text>
                <div>
                  <Tag color={getTypeConfig(selectedAlert.type).color}>
                    {getTypeConfig(selectedAlert.type).label}
                  </Tag>
                </div>
              </Col>
              <Col span={8}>
                <Text type="secondary">Priority</Text>
                <div>
                  <Tag color={getPriorityConfig(selectedAlert.priority).color}>
                    {getPriorityConfig(selectedAlert.priority).label}
                  </Tag>
                </div>
              </Col>
              <Col span={8}>
                <Text type="secondary">Status</Text>
                <div>
                  <Badge
                    status={selectedAlert.isActive ? 'success' : 'default'}
                    text={selectedAlert.isActive ? 'Active' : 'Inactive'}
                  />
                </div>
              </Col>
            </Row>
            <div>
              <Text type="secondary">Target Roles</Text>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedAlert.targetRoles?.map(role => (
                  <Tag key={role}>
                    {USER_ROLES.find(r => r.value === role)?.label || role}
                  </Tag>
                ))}
              </div>
            </div>
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary">Created By</Text>
                <div>{selectedAlert.createdBy?.name || 'Unknown'}</div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Created At</Text>
                <div>{dayjs(selectedAlert.createdAt).format('MMM D, YYYY h:mm A')}</div>
              </Col>
            </Row>
            <div>
              <Text type="secondary">Dismissals ({selectedAlert._count?.dismissedBy || 0})</Text>
              {selectedAlert.dismissedBy?.length > 0 ? (
                <div className="max-h-40 overflow-y-auto mt-2">
                  {selectedAlert.dismissedBy.map(d => (
                    <div key={d.id} className="flex justify-between py-1 border-b border-gray-100">
                      <span>{d.user?.name}</span>
                      <span className="text-gray-400 text-sm">
                        {dayjs(d.dismissedAt).format('MMM D, h:mm A')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 text-sm mt-1">No dismissals yet</div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AlertGenerator;
