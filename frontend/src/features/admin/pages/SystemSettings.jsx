import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Button,
  Space,
  Spin,
  Popconfirm,
  Tag,
  Tooltip,
  Divider,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  SaveOutlined,
  ReloadOutlined,
  ExportOutlined,
  ImportOutlined,
  UndoOutlined,
  SettingOutlined,
  SafetyOutlined,
  BellOutlined,
  ToolOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { adminService } from '../../../services/admin.service';

const { TabPane } = Tabs;

const SystemSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [refreshConfigCache, setRefreshConfigCache] = useState(true);
  const [configs, setConfigs] = useState({});
  const [form] = Form.useForm();

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllConfigs();
      setConfigs(data);

      // Flatten configs for form
      const formValues = {};
      Object.values(data).forEach((categoryConfigs) => {
        categoryConfigs.forEach((config) => {
          formValues[config.key] = config.value;
        });
      });
      form.setFieldsValue(formValues);
    } catch (error) {
      console.error('Failed to fetch configs:', error);
      toast.error('Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleSave = async (category) => {
    try {
      setSaving(true);
      const values = form.getFieldsValue();
      const updates = [];

      configs[category]?.forEach((config) => {
        if (values[config.key] !== config.value) {
          updates.push({ key: config.key, value: values[config.key] });
        }
      });

      if (updates.length === 0) {
        toast.info('No changes to save');
        return;
      }

      await adminService.bulkUpdateConfigs(updates);
      toast.success('Settings saved successfully');
      fetchConfigs();
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (key) => {
    try {
      await adminService.resetConfig(key);
      toast.success('Setting reset to default');
      fetchConfigs();
    } catch (error) {
      console.error('Failed to reset setting:', error);
      toast.error('Failed to reset setting');
    }
  };

  const handleResetAll = async () => {
    try {
      await adminService.resetAllConfigs();
      toast.success('All settings reset to defaults');
      fetchConfigs();
    } catch (error) {
      console.error('Failed to reset all settings:', error);
      toast.error('Failed to reset all settings');
    }
  };

  const handleExport = async () => {
    try {
      const data = await adminService.exportConfigs();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('Configuration exported');
    } catch (error) {
      console.error('Failed to export configs:', error);
      toast.error('Failed to export configuration');
    }
  };

  const handleClearCache = async () => {
    try {
      setClearingCache(true);
      const result = await adminService.clearCache({ refreshConfigCache });
      toast.success('Cache cleared successfully');
      if (result?.refreshedConfigCache) {
        await fetchConfigs();
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error('Failed to clear cache');
    } finally {
      setClearingCache(false);
    }
  };

  const renderConfigField = (config) => {
    const commonProps = {
      style: { width: '100%' },
    };

    switch (config.type) {
      case 'boolean':
        return <Switch />;
      case 'number':
        return (
          <InputNumber
            {...commonProps}
            min={config.validation?.min}
            max={config.validation?.max}
          />
        );
      case 'string':
        if (config.validation?.options) {
          return (
            <Select {...commonProps}>
              {config.validation.options.map((opt) => (
                <Select.Option key={opt} value={opt}>
                  {opt}
                </Select.Option>
              ))}
            </Select>
          );
        }
        return <Input {...commonProps} />;
      default:
        return <Input {...commonProps} />;
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'general':
        return <SettingOutlined />;
      case 'security':
        return <SafetyOutlined />;
      case 'features':
        return <AppstoreOutlined />;
      case 'notifications':
        return <BellOutlined />;
      case 'maintenance':
        return <ToolOutlined />;
      default:
        return <SettingOutlined />;
    }
  };

  const renderCategoryTab = (category, categoryConfigs) => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium capitalize">{category} Settings</h3>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={() => handleSave(category)}
        >
          Save Changes
        </Button>
      </div>

      <div className="space-y-4">
        {categoryConfigs.map((config) => (
          <Card key={config.key} size="small" className="bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{config.key.split('.').pop()}</span>
                  {config.isDefault && (
                    <Tag color="blue" className="text-xs">Default</Tag>
                  )}
                </div>
                <p className="text-gray-500 text-sm mb-2">{config.description}</p>
                <Form.Item
                  name={config.key}
                  valuePropName={config.type === 'boolean' ? 'checked' : 'value'}
                  className="mb-0"
                >
                  {renderConfigField(config)}
                </Form.Item>
              </div>
              <Tooltip title="Reset to default">
                <Button
                  type="text"
                  icon={<UndoOutlined />}
                  onClick={() => handleReset(config.key)}
                  disabled={config.isDefault}
                />
              </Tooltip>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  const categoryOrder = ['general', 'security', 'features', 'notifications', 'maintenance'];
  const sortedCategories = categoryOrder.filter((cat) => configs[cat]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">System Settings</h1>
          <p className="text-gray-500">Configure system-wide settings and preferences</p>
        </div>
        <Space>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            Export
          </Button>
          <Popconfirm
            title="Reset all settings to defaults?"
            description="This action cannot be undone."
            onConfirm={handleResetAll}
          >
            <Button danger icon={<ReloadOutlined />}>
              Reset All
            </Button>
          </Popconfirm>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Card className="mb-6" bordered>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Cache Management</h3>
              <p className="text-gray-500 text-sm">
                Clear Redis + in-memory caches to force a fresh reload of system data.
              </p>
            </div>
            <Space>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Refresh config cache</span>
                <Switch checked={refreshConfigCache} onChange={setRefreshConfigCache} />
              </div>
              <Popconfirm
                title="Clear all cache?"
                description="This will flush Redis and local cache across services."
                onConfirm={handleClearCache}
                okText="Clear"
                okButtonProps={{ danger: true }}
              >
                <Button danger loading={clearingCache} icon={<ReloadOutlined />}>
                  Clear Cache
                </Button>
              </Popconfirm>
            </Space>
          </div>
        </Card>

        <Tabs defaultActiveKey="general" type="card">
          {sortedCategories.map((category) => (
            <TabPane
              tab={
                <span>
                  {getCategoryIcon(category)}
                  <span className="ml-2 capitalize">{category}</span>
                </span>
              }
              key={category}
            >
              {renderCategoryTab(category, configs[category])}
            </TabPane>
          ))}
        </Tabs>
      </Form>
    </div>
  );
};

export default SystemSettings;
