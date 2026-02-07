import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  Typography,
  Tabs,
  Tag,
  Popconfirm,
  Row,
  Col,
  Tooltip,
  Switch,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  ApartmentOutlined,
  TeamOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import lookupService from '../../../services/lookup.service';

const { Title, Text } = Typography;

const MasterData = () => {
  const [activeTab, setActiveTab] = useState('batches');
  const [loading, setLoading] = useState(false);

  // Data states
  const [batches, setBatches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('batch'); // batch, department, branch
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form] = Form.useForm();

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [batchRes, deptRes, branchRes] = await Promise.all([
        lookupService.getBatches(),
        lookupService.getDepartments(),
        lookupService.getBranches(),
      ]);
      setBatches(batchRes.batches || []);
      setDepartments(deptRes.departments || []);
      setBranches(branchRes.branches || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Open modal for create/edit
  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    setModalVisible(true);

    if (item) {
      form.setFieldsValue(item);
    } else {
      form.resetFields();
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingItem(null);
    form.resetFields();
  };

  // Handle form submit
  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      if (editingItem) {
        // Update
        switch (modalType) {
          case 'batch':
            await lookupService.updateBatch(editingItem.id, values);
            break;
          case 'department':
            await lookupService.updateDepartment(editingItem.id, values);
            break;
          case 'branch':
            await lookupService.updateBranch(editingItem.id, values);
            break;
        }
        toast.success(`${modalType.charAt(0).toUpperCase() + modalType.slice(1)} updated successfully`);
      } else {
        // Create
        switch (modalType) {
          case 'batch':
            await lookupService.createBatch(values);
            break;
          case 'department':
            await lookupService.createDepartment(values);
            break;
          case 'branch':
            await lookupService.createBranch(values);
            break;
        }
        toast.success(`${modalType.charAt(0).toUpperCase() + modalType.slice(1)} created successfully`);
      }
      closeModal();
      loadAllData();
    } catch (error) {
      toast.error(error.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (type, id) => {
    try {
      switch (type) {
        case 'batch':
          await lookupService.deleteBatch(id);
          break;
        case 'department':
          await lookupService.deleteDepartment(id);
          break;
        case 'branch':
          await lookupService.deleteBranch(id);
          break;
      }
      toast.success('Deleted successfully');
      loadAllData();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  // Table columns
  const batchColumns = [
    {
      title: 'Batch Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openModal('batch', record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this batch?"
            description="This will deactivate the batch."
            onConfirm={() => handleDelete('batch', record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const departmentColumns = [
    {
      title: 'Department Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: 'Short Name',
      dataIndex: 'shortName',
      key: 'shortName',
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openModal('department', record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this department?"
            description="This will deactivate the department."
            onConfirm={() => handleDelete('department', record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const branchColumns = [
    {
      title: 'Branch Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: 'Short Name',
      dataIndex: 'shortName',
      key: 'shortName',
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Tag color="purple">{code}</Tag>,
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration) => `${duration} years`,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openModal('branch', record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this branch?"
            description="This will deactivate the branch."
            onConfirm={() => handleDelete('branch', record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Render form based on type
  const renderForm = () => {
    switch (modalType) {
      case 'batch':
        return (
          <>
            <Form.Item
              name="name"
              label="Batch Name"
              rules={[{ required: true, message: 'Please enter batch name' }]}
            >
              <Input placeholder="e.g., 2023-26" />
            </Form.Item>
            {editingItem && (
              <Form.Item name="isActive" label="Status" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            )}
          </>
        );
      case 'department':
        return (
          <>
            <Form.Item
              name="name"
              label="Department Name"
              rules={[{ required: true, message: 'Please enter department name' }]}
            >
              <Input placeholder="e.g., Computer Science" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="shortName" label="Short Name">
                  <Input placeholder="e.g., CS" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="code"
                  label="Code"
                  rules={[{ required: true, message: 'Please enter code' }]}
                >
                  <Input placeholder="e.g., DEPT-CS" />
                </Form.Item>
              </Col>
            </Row>
            {editingItem && (
              <Form.Item name="isActive" label="Status" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            )}
          </>
        );
      case 'branch':
        return (
          <>
            <Form.Item
              name="name"
              label="Branch Name"
              rules={[{ required: true, message: 'Please enter branch name' }]}
            >
              <Input placeholder="e.g., Computer Engineering" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="shortName"
                  label="Short Name"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <Input placeholder="e.g., CE" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="code"
                  label="Code"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <Input placeholder="e.g., BR-CE" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="duration"
                  label="Duration (Years)"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={1} max={6} placeholder="4" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            {editingItem && (
              <Form.Item name="isActive" label="Status" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            )}
          </>
        );
      default:
        return null;
    }
  };

  const tabItems = [
    {
      key: 'batches',
      label: (
        <span className="flex items-center gap-2">
          <CalendarOutlined />
          Batches ({batches.length})
        </span>
      ),
      children: (
        <Card
          className="rounded-xl border-border"
          styles={{ body: { padding: 0 } }}
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal('batch')}
            >
              Add Batch
            </Button>
          }
        >
          <Table
            columns={batchColumns}
            dataSource={batches}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ),
    },
    {
      key: 'departments',
      label: (
        <span className="flex items-center gap-2">
          <ApartmentOutlined />
          Departments ({departments.length})
        </span>
      ),
      children: (
        <Card
          className="rounded-xl border-border"
          styles={{ body: { padding: 0 } }}
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal('department')}
            >
              Add Department
            </Button>
          }
        >
          <Table
            columns={departmentColumns}
            dataSource={departments}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ),
    },
    {
      key: 'branches',
      label: (
        <span className="flex items-center gap-2">
          <TeamOutlined />
          Branches ({branches.length})
        </span>
      ),
      children: (
        <Card
          className="rounded-xl border-border"
          styles={{ body: { padding: 0 } }}
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal('branch')}
            >
              Add Branch
            </Button>
          }
        >
          <Table
            columns={branchColumns}
            dataSource={branches}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <Title level={2} className="!mb-1 !text-text-primary flex items-center gap-3">
            <DatabaseOutlined className="text-primary" />
            Master Data Management
          </Title>
          <Text className="text-text-secondary">
            Manage global batches, departments, and branches shared across all institutions
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadAllData} loading={loading}>
          Refresh
        </Button>
      </div>

      {/* Tabs with data */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        className="master-data-tabs"
      />

      {/* Create/Edit Modal */}
      <Modal
        title={`${editingItem ? 'Edit' : 'Create'} ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`}
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="mt-4"
        >
          {renderForm()}
          <div className="flex justify-end gap-3 mt-6">
            <Button onClick={closeModal}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default MasterData;
