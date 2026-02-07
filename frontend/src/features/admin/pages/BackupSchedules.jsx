import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Tag,
  Space,
  Popconfirm,
  Spin,
  Tooltip,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { adminService } from '../../../services/admin.service';

const BackupSchedules = () => {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [scheduleStatus, setScheduleStatus] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schedulesData, statusData] = await Promise.all([
        adminService.listBackupSchedules(),
        adminService.getScheduleStatus(),
      ]);
      setSchedules(schedulesData || []);
      setScheduleStatus(statusData || []);
    } catch (error) {
      console.error('Failed to fetch backup schedules:', error);
      toast.error('Failed to load backup schedules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = () => {
    setEditingSchedule(null);
    form.resetFields();
    form.setFieldsValue({
      storageType: 'both',
      retentionDays: 30,
    });
    setModalVisible(true);
  };

  const handleEdit = (schedule) => {
    setEditingSchedule(schedule);
    form.setFieldsValue({
      name: schedule.name,
      cronExpression: schedule.cronExpression,
      storageType: schedule.storageType,
      retentionDays: schedule.retentionDays,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingSchedule) {
        await adminService.updateBackupSchedule(editingSchedule.id, values);
        toast.success('Schedule updated successfully');
      } else {
        await adminService.createBackupSchedule(values);
        toast.success('Schedule created successfully');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      toast.error('Failed to save schedule');
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminService.deleteBackupSchedule(id);
      toast.success('Schedule deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      toast.error('Failed to delete schedule');
    }
  };

  const handleTrigger = async (id) => {
    try {
      await adminService.triggerBackupSchedule(id);
      toast.success('Backup triggered successfully');
    } catch (error) {
      console.error('Failed to trigger backup:', error);
      toast.error('Failed to trigger backup');
    }
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      await adminService.updateBackupSchedule(id, { isActive });
      toast.success(`Schedule ${isActive ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (error) {
      console.error('Failed to update schedule:', error);
      toast.error('Failed to update schedule');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <span className="font-medium">{name}</span>,
    },
    {
      title: 'Schedule',
      dataIndex: 'cronExpression',
      key: 'cronExpression',
      render: (cron) => (
        <Tooltip title={`Cron: ${cron}`}>
          <Tag icon={<ClockCircleOutlined />}>{cron}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Storage',
      dataIndex: 'storageType',
      key: 'storageType',
      render: (type) => (
        <Tag color={type === 'both' ? 'blue' : type === 'minio' ? 'green' : 'orange'}>
          {type.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Retention',
      dataIndex: 'retentionDays',
      key: 'retentionDays',
      render: (days) => `${days} days`,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive, record) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleToggleActive(record.id, checked)}
          checkedChildren="Active"
          unCheckedChildren="Inactive"
        />
      ),
    },
    {
      title: 'Last Run',
      dataIndex: 'lastRun',
      key: 'lastRun',
      render: (lastRun) => (lastRun ? new Date(lastRun).toLocaleString() : 'Never'),
    },
    {
      title: 'Next Run',
      dataIndex: 'nextRun',
      key: 'nextRun',
      render: (nextRun) => (nextRun ? new Date(nextRun).toLocaleString() : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Run Now">
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => handleTrigger(record.id)}
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
            title="Delete this schedule?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const cronPresets = [
    { label: 'Every day at 2 AM', value: '0 2 * * *' },
    { label: 'Every day at midnight', value: '0 0 * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Every Sunday at 3 AM', value: '0 3 * * 0' },
    { label: 'First of month at 1 AM', value: '0 1 1 * *' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Scheduled Backups</h1>
          <p className="text-gray-500">Manage automated backup schedules</p>
        </div>
        <Space>
          <Button icon={<SyncOutlined />} onClick={fetchData}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            New Schedule
          </Button>
        </Space>
      </div>

      {/* Default Schedule Info */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Default Daily Backup</h3>
            <p className="text-gray-500">Runs automatically every day at 2:00 AM</p>
          </div>
          <Tag icon={<CheckCircleOutlined />} color="success">
            Always Active
          </Tag>
        </div>
      </Card>

      {/* Schedules Table */}
      <Card title="Custom Schedules">
        <Table
          dataSource={schedules}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'No custom schedules configured' }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingSchedule ? 'Edit Schedule' : 'Create Schedule'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText={editingSchedule ? 'Update' : 'Create'}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Schedule Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g., Weekly Full Backup" />
          </Form.Item>

          <Form.Item
            name="cronExpression"
            label="Cron Expression"
            rules={[{ required: true, message: 'Please enter a cron expression' }]}
            extra="Format: minute hour day-of-month month day-of-week"
          >
            <Select
              showSearch
              placeholder="Select or enter cron expression"
              optionFilterProp="children"
              options={cronPresets}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <div className="p-2 border-t">
                    <Input
                      placeholder="Custom cron expression"
                      onPressEnter={(e) => {
                        form.setFieldsValue({ cronExpression: e.target.value });
                      }}
                    />
                  </div>
                </>
              )}
            />
          </Form.Item>

          <Form.Item
            name="storageType"
            label="Storage Type"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="both">Both (MinIO + Local)</Select.Option>
              <Select.Option value="minio">MinIO Only</Select.Option>
              <Select.Option value="local">Local Only</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="retentionDays"
            label="Retention (Days)"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BackupSchedules;
