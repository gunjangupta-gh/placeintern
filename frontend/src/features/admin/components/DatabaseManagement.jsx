import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Tag,
  Space,
  Popconfirm,
  Progress,
  Typography,
  Row,
  Col,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CloudDownloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { adminService } from '../../../services/admin.service';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const DatabaseManagement = ({ backupProgress, restoreProgress, connected }) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [form] = Form.useForm();

  const fetchBackups = useCallback(async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      const data = await adminService.listBackups({ page, limit });
      setBackups(data.backups || []);
      setPagination({
        current: data.page || 1,
        pageSize: data.limit || 10,
        total: data.total || 0,
      });
    } catch (error) {
      console.error('Failed to fetch backups:', error);
      toast.error('Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  // Refresh backups when backup completes via WebSocket
  useEffect(() => {
    if (backupProgress?.status === 'completed' || backupProgress?.status === 'failed') {
      fetchBackups();
    }
  }, [backupProgress, fetchBackups]);

  // Handle restore progress updates
  useEffect(() => {
    if (restoreProgress?.status === 'completed') {
      setRestoreLoading(false);
      setRestoreModalOpen(false);
      setSelectedBackup(null);
      fetchBackups();
    } else if (restoreProgress?.status === 'failed') {
      setRestoreLoading(false);
    } else if (restoreProgress?.status === 'in_progress') {
      setRestoreLoading(true);
    }
  }, [restoreProgress, fetchBackups]);

  const handleTableChange = (paginationConfig) => {
    fetchBackups(paginationConfig.current, paginationConfig.pageSize);
  };

  const handleCreateBackup = async (values) => {
    try {
      setCreateLoading(true);
      const response = await adminService.createBackup(values);

      if (response.success) {
        toast.info('Backup initiated. Watch progress below...');
        setCreateModalOpen(false);
        form.resetFields();
        // Progress will be shown via WebSocket, backup list refreshed on completion
      } else {
        toast.error(response.error || 'Failed to initiate backup');
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      toast.error(error.response?.data?.message || 'Failed to create backup');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDownload = async (backup) => {
    try {
      const result = await adminService.getBackupDownloadUrl(backup.id);
      if (result.url) {
        window.open(result.url, '_blank');
      } else {
        toast.info('Download not available');
      }
    } catch (error) {
      console.error('Failed to get download URL:', error);
      toast.error('Failed to download backup');
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    try {
      setRestoreLoading(true);
      const response = await adminService.restoreBackup(selectedBackup.id, {
        confirmRestore: true,
        confirmationText: 'RESTORE',
        dropExisting: true,
      });

      if (response.success) {
        toast.info('Restore initiated. Watch progress below...');
        setRestoreModalOpen(false);
        setSelectedBackup(null);
        // Keep restoreLoading true - WebSocket progress handler will set it false on completion/failure
      } else {
        toast.error(response.error || 'Failed to initiate restore');
        setRestoreLoading(false);
      }
    } catch (error) {
      console.error('Failed to restore backup:', error);
      toast.error(error.response?.data?.message || 'Failed to restore backup');
      setRestoreLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminService.deleteBackup(id);
      toast.success('Backup deleted');
      fetchBackups();
    } catch (error) {
      console.error('Failed to delete backup:', error);
      toast.error('Failed to delete backup');
    }
  };

  const handleCleanupStale = async () => {
    try {
      const result = await adminService.cleanupStaleBackups();
      if (result.cleaned > 0) {
        toast.success(`Cleaned up ${result.cleaned} stale backups`);
        fetchBackups();
      } else {
        toast.info('No stale backups found');
      }
    } catch (error) {
      console.error('Failed to cleanup stale backups:', error);
      toast.error('Failed to cleanup stale backups');
    }
  };

  const handleUpload = async (file) => {
    try {
      setUploadProgress(0);
      await adminService.uploadBackup(file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      });
      toast.success('Backup uploaded successfully');
      setUploadModalOpen(false);
      setUploadProgress(0);
      fetchBackups();
    } catch (error) {
      console.error('Failed to upload backup:', error);
      toast.error('Failed to upload backup');
    }
    return false; // Prevent default upload behavior
  };

  const getStatusTag = (status) => {
    const config = {
      COMPLETED: { color: 'success', icon: <CheckCircleOutlined /> },
      IN_PROGRESS: { color: 'processing', icon: <SyncOutlined spin /> },
      FAILED: { color: 'error', icon: <CloseCircleOutlined /> },
      RESTORED: { color: 'purple', icon: <ReloadOutlined /> },
    };
    const { color, icon } = config[status] || { color: 'default', icon: null };
    return (
      <Tag color={color} icon={icon}>
        {status}
      </Tag>
    );
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const columns = [
    {
      title: 'Filename',
      dataIndex: 'filename',
      key: 'filename',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size) => formatFileSize(size),
    },
    {
      title: 'Storage',
      dataIndex: 'storageLocations',
      key: 'storageLocations',
      width: 120,
      render: (locations) => (
        <Space size={4}>
          {locations?.map((loc) => (
            <Tag key={loc} color={loc === 'minio' ? 'blue' : 'green'}>
              {loc.toUpperCase()}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date) => new Date(date).toLocaleString(),
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
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
            disabled={record.status !== 'COMPLETED' && record.status !== 'RESTORED'}
          >
            Download
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              setSelectedBackup(record);
              setRestoreModalOpen(true);
            }}
            disabled={record.status !== 'COMPLETED' && record.status !== 'RESTORED'}
          >
            Restore
          </Button>
          <Popconfirm
            title="Delete this backup?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Real-time Backup Progress */}
      {backupProgress && backupProgress.status === 'in_progress' && (
        <Card className="shadow-sm border-primary/50 rounded-xl bg-primary/5">
          <div className="flex items-center gap-4">
            <SyncOutlined spin className="text-primary text-2xl" />
            <div className="flex-1">
              <Text strong className="text-text-primary block">
                Backup in Progress
              </Text>
              <Text className="text-text-secondary text-sm">
                {backupProgress.message || 'Creating database backup...'}
              </Text>
              {backupProgress.progress !== undefined && (
                <Progress
                  percent={backupProgress.progress}
                  status="active"
                  className="mt-2 mb-0"
                  strokeColor={{ from: '#1890ff', to: '#52c41a' }}
                />
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Real-time Restore Progress */}
      {restoreProgress && restoreProgress.status === 'in_progress' && (
        <Card className="shadow-sm border-warning/50 rounded-xl bg-warning/5">
          <div className="flex items-center gap-4">
            <SyncOutlined spin className="text-warning text-2xl" />
            <div className="flex-1">
              <Text strong className="text-text-primary block">
                Restore in Progress - {restoreProgress.stage?.replace(/_/g, ' ').toUpperCase()}
              </Text>
              <Text className="text-text-secondary text-sm">
                {restoreProgress.message || 'Restoring database...'}
              </Text>
              {restoreProgress.progress !== undefined && (
                <Progress
                  percent={restoreProgress.progress}
                  status="active"
                  className="mt-2 mb-0"
                  strokeColor={{ from: '#faad14', to: '#52c41a' }}
                />
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Actions Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8} md={6}>
          <Card
            className="shadow-sm border-border rounded-xl bg-surface cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setCreateModalOpen(true)}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <PlusOutlined className="text-primary text-xl" />
              </div>
              <div>
                <Text strong className="block text-text-primary">Create Backup</Text>
                <Text className="text-text-tertiary text-sm">Create new database backup</Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Card
            className="shadow-sm border-border rounded-xl bg-surface cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setUploadModalOpen(true)}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <UploadOutlined className="text-success text-xl" />
              </div>
              <div>
                <Text strong className="block text-text-primary">Upload Backup</Text>
                <Text className="text-text-tertiary text-sm">Upload external backup file</Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Card
            className="shadow-sm border-border rounded-xl bg-surface cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => fetchBackups()}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
                <ReloadOutlined className="text-info text-xl" />
              </div>
              <div>
                <Text strong className="block text-text-primary">Refresh List</Text>
                <Text className="text-text-tertiary text-sm">Reload backup list</Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Card
            className="shadow-sm border-border rounded-xl bg-surface cursor-pointer hover:shadow-md transition-shadow"
            onClick={handleCleanupStale}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <ClearOutlined className="text-warning text-xl" />
              </div>
              <div>
                <Text strong className="block text-text-primary">Cleanup Stale</Text>
                <Text className="text-text-tertiary text-sm">Fix stuck backups</Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Backups Table */}
      <Card
        title={
          <div className="flex items-center gap-3">
            <CloudDownloadOutlined className="text-primary text-xl" />
            <span className="font-bold text-text-primary">Backup History</span>
          </div>
        }
        className="shadow-sm border-border rounded-2xl bg-surface"
      >
        <Table
          columns={columns}
          dataSource={backups}
          loading={loading}
          rowKey="id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} backups`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* Create Backup Modal */}
      <Modal
        title="Create New Backup"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateBackup}>
          <Form.Item
            name="description"
            label="Description"
            rules={[{ max: 500, message: 'Description too long' }]}
          >
            <TextArea rows={3} placeholder="Optional description for this backup" />
          </Form.Item>
          <Form.Item name="storageType" label="Storage Location" initialValue="both">
            <Select>
              <Select.Option value="minio">MinIO (Cloud)</Select.Option>
              <Select.Option value="local">Local Storage</Select.Option>
              <Select.Option value="both">Both (Recommended)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>
                Create Backup
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Upload Backup Modal */}
      <Modal
        title="Upload Backup File"
        open={uploadModalOpen}
        onCancel={() => {
          setUploadModalOpen(false);
          setUploadProgress(0);
        }}
        footer={null}
      >
        <div className="py-4">
          <Upload.Dragger
            name="file"
            accept=".gz,.tar,.tar.gz,.zip"
            beforeUpload={handleUpload}
            showUploadList={false}
            disabled={uploadProgress > 0}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined className="text-4xl text-primary" />
            </p>
            <p className="ant-upload-text">Click or drag backup file to upload</p>
            <p className="ant-upload-hint">
              Supports .gz, .tar, .tar.gz, .zip formats (max 500MB)
            </p>
          </Upload.Dragger>
          {uploadProgress > 0 && (
            <Progress percent={uploadProgress} status="active" className="mt-4" />
          )}
        </div>
      </Modal>

      {/* Restore Confirmation Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-warning">
            <ExclamationCircleOutlined />
            <span>Confirm Restore</span>
          </div>
        }
        open={restoreModalOpen}
        onCancel={() => {
          setRestoreModalOpen(false);
          setSelectedBackup(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setRestoreModalOpen(false);
              setSelectedBackup(null);
            }}
          >
            Cancel
          </Button>,
          <Button
            key="restore"
            type="primary"
            danger
            loading={restoreLoading}
            onClick={handleRestore}
          >
            Confirm Restore
          </Button>,
        ]}
      >
        <div className="py-4">
          <Paragraph className="text-text-primary">
            Are you sure you want to restore the database from this backup?
          </Paragraph>
          {selectedBackup && (
            <Card className="bg-background-tertiary border-border mt-4">
              <Text strong className="block">{selectedBackup.filename}</Text>
              <Text className="text-text-secondary text-sm block">
                Created: {new Date(selectedBackup.createdAt).toLocaleString()}
              </Text>
              <Text className="text-text-secondary text-sm block">
                Size: {formatFileSize(selectedBackup.size)}
              </Text>
            </Card>
          )}
          <Paragraph type="danger" className="mt-4">
            <strong>Warning:</strong> This operation will replace all current data with the backup data.
            This action cannot be undone. Make sure you have a recent backup of the current state.
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
};

export default DatabaseManagement;
