import React, { useState, useEffect } from 'react';
import { Card, Table, Switch, Tag, Spin, Input, Space, Button, Alert } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { adminService } from '../../../services/admin.service';

const FeatureFlags = () => {
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState([]);
  const [searchText, setSearchText] = useState('');

  const fetchFeatures = async () => {
    try {
      setLoading(true);
      const data = await adminService.getConfigsByCategory('features');
      setFeatures(data || []);
    } catch (error) {
      console.error('Failed to fetch features:', error);
      toast.error('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, []);

  const handleToggle = async (key, value) => {
    try {
      await adminService.setConfig(key, value);
      toast.success(`Feature ${value ? 'enabled' : 'disabled'}`);
      fetchFeatures();
    } catch (error) {
      console.error('Failed to update feature:', error);
      toast.error('Failed to update feature flag');
    }
  };

  const columns = [
    {
      title: 'Feature',
      dataIndex: 'key',
      key: 'key',
      render: (key) => (
        <div>
          <span className="font-medium">{key.replace('features.', '')}</span>
        </div>
      ),
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) =>
        record.key.toLowerCase().includes(value.toLowerCase()) ||
        record.description?.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc) => <span className="text-gray-600">{desc}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'value',
      key: 'value',
      render: (value) => (
        <Tag
          color={value ? 'success' : 'default'}
          icon={value ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        >
          {value ? 'Enabled' : 'Disabled'}
        </Tag>
      ),
    },
    {
      title: 'Toggle',
      key: 'toggle',
      render: (_, record) => (
        <Switch
          checked={record.value}
          onChange={(checked) => handleToggle(record.key, checked)}
          checkedChildren="ON"
          unCheckedChildren="OFF"
        />
      ),
    },
    {
      title: 'Default',
      dataIndex: 'isDefault',
      key: 'isDefault',
      render: (isDefault) =>
        isDefault ? (
          <Tag color="blue">Default</Tag>
        ) : (
          <Tag color="orange">Modified</Tag>
        ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  const enabledCount = features.filter((f) => f.value).length;
  const maintenanceMode = features.find((f) => f.key === 'features.maintenanceMode')?.value;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Feature Flags</h1>
          <p className="text-gray-500">Enable or disable system features</p>
        </div>
        <Space>
          <Input
            placeholder="Search features..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchFeatures}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Maintenance Mode Warning */}
      {maintenanceMode && (
          <Alert
            title="Maintenance Mode Active"
            description="The system is currently in maintenance mode. Only administrators can perform critical operations."
            type="warning"
            showIcon
            className="mb-6 rounded-xl border-warning/20"
          />
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircleOutlined className="text-green-600 text-xl" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Enabled Features</p>
              <p className="text-2xl font-bold text-green-600">{enabledCount}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 rounded-lg">
              <CloseCircleOutlined className="text-gray-600 text-xl" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Disabled Features</p>
              <p className="text-2xl font-bold text-gray-600">
                {features.length - enabledCount}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ExperimentOutlined className="text-blue-600 text-xl" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Features</p>
              <p className="text-2xl font-bold text-blue-600">{features.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Features Table */}
      <Card>
        <Table
          dataSource={features}
          columns={columns}
          rowKey="key"
          pagination={false}
          rowClassName={(record) =>
            record.key === 'features.maintenanceMode' && record.value
              ? 'bg-yellow-50'
              : ''
          }
        />
      </Card>
    </div>
  );
};

export default FeatureFlags;
