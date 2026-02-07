// TemplateManager Component - CRUD operations for report templates
import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Typography,
  Space,
  Tag,
  Tooltip,
  Modal,
  Form,
  Input,
  Switch,
  Empty,
  Spin,
  Popconfirm,
  App,
  Avatar,
} from "antd";
import {
  SaveOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  GlobalOutlined,
  LockOutlined,
  UserOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  getTemplates,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
} from "../../services/reportBuilderApi";
import { formatLabel, getRelativeTime } from "../../utils/reportBuilderUtils";

const { Text, Title } = Typography;
const { TextArea } = Input;

const TemplateManager = ({
  onApplyTemplate,
  currentConfig,
  reportType,
  selectedColumns,
  filters,
}) => {
  const { message } = App.useApp();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form] = Form.useForm();

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await getTemplates();
      if (response?.data) {
        setTemplates(response.data);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
      message.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (values) => {
    if (!reportType) {
      message.error("Please select a report type first");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: values.name,
        description: values.description,
        reportType,
        columns: selectedColumns || [],
        filters: filters || {},
        groupBy: currentConfig?.groupBy,
        sortBy: currentConfig?.sortBy,
        sortOrder: currentConfig?.sortOrder,
        isPublic: values.isPublic || false,
      };

      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, payload);
        message.success("Template updated successfully");
      } else {
        await saveTemplate(payload);
        message.success("Template saved successfully");
      }

      setSaveModalVisible(false);
      setEditingTemplate(null);
      form.resetFields();
      loadTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      message.error(error.response?.data?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      await deleteTemplate(templateId);
      message.success("Template deleted successfully");
      loadTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      message.error("Failed to delete template");
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    form.setFieldsValue({
      name: template.name,
      description: template.description,
      isPublic: template.isPublic,
    });
    setSaveModalVisible(true);
  };

  const handleApply = (template) => {
    onApplyTemplate?.(template);
    message.success(`Template "${template.name}" applied`);
  };

  const openSaveModal = () => {
    setEditingTemplate(null);
    form.resetFields();
    setSaveModalVisible(true);
  };

  // Filter templates by current report type if one is selected
  const filteredTemplates = reportType
    ? templates.filter((t) => t.reportType === reportType || !reportType)
    : templates;

  // Separate user's templates from public templates
  const myTemplates = filteredTemplates.filter((t) => t.isOwner);
  const publicTemplates = filteredTemplates.filter((t) => !t.isOwner && t.isPublic);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Spin tip="Loading templates..." />
      </div>
    );
  }

  return (
    <div className="template-manager">
      {/* Save Current Config Button */}
      <Button
        type="dashed"
        icon={<SaveOutlined />}
        onClick={openSaveModal}
        className="w-full mb-4"
        disabled={!reportType}
      >
        Save Current Configuration as Template
      </Button>

      {/* My Templates */}
      {myTemplates.length > 0 && (
        <div className="mb-4">
          <Text strong className="block mb-2">
            <UserOutlined className="mr-2" />
            My Templates ({myTemplates.length})
          </Text>
          <div className="border rounded-lg flex flex-col">
            {myTemplates.map((template, index) => (
              <div
                key={template.id || index}
                className={`hover:bg-gray-50 rounded-lg transition-colors p-3 flex items-start gap-3 ${index !== myTemplates.length - 1 ? 'border-b border-border/50' : ''}`}
              >
                <Avatar
                  icon={template.isPublic ? <GlobalOutlined /> : <LockOutlined />}
                  shrink-0
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <Space size="small" className="min-w-0">
                      <Text strong className="truncate block">{template.name}</Text>
                      {template.isOwner && (
                        <Tag color="blue" icon={<UserOutlined />} className="m-0 text-[10px] py-0 px-1 border-0">
                          Mine
                        </Tag>
                      )}
                    </Space>
                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip title="Apply Template">
                        <Button
                          type="primary"
                          size="small"
                          icon={<PlayCircleOutlined />}
                          className="h-7 text-[10px]"
                          onClick={() => handleApply(template)}
                        >
                          Apply
                        </Button>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          className="h-7"
                          onClick={() => handleEditTemplate(template)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="Delete Template"
                        description="Are you sure you want to delete this template?"
                        onConfirm={() => handleDeleteTemplate(template.id)}
                        okText="Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                      >
                        <Tooltip title="Delete">
                          <Button size="small" danger icon={<DeleteOutlined />} className="h-7" />
                        </Tooltip>
                      </Popconfirm>
                    </div>
                  </div>
                  <div>
                    <Text type="secondary" className="text-[10px] block">
                      {formatLabel(template.reportType)} -{" "}
                      {template.columns?.length || 0} columns
                    </Text>
                    {template.description && (
                      <Text type="secondary" className="text-[10px] block truncate">
                        {template.description}
                      </Text>
                    )}
                    <Text type="secondary" className="text-[10px]">
                      Updated {getRelativeTime(template.updatedAt)}
                    </Text>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public Templates */}
      {publicTemplates.length > 0 && (
        <div className="mb-4">
          <Text strong className="block mb-2">
            <GlobalOutlined className="mr-2" />
            Public Templates ({publicTemplates.length})
          </Text>
          <div className="border rounded-lg flex flex-col">
            {publicTemplates.map((template, index) => (
              <div
                key={template.id || index}
                className={`hover:bg-gray-50 rounded-lg transition-colors p-3 flex items-start gap-3 ${index !== publicTemplates.length - 1 ? 'border-b border-border/50' : ''}`}
              >
                <Avatar
                  icon={template.isPublic ? <GlobalOutlined /> : <LockOutlined />}
                  shrink-0
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <Space size="small" className="min-w-0">
                      <Text strong className="truncate block">{template.name}</Text>
                      <Tag color="green" icon={<GlobalOutlined />} className="m-0 text-[10px] py-0 px-1 border-0">
                        Public
                      </Tag>
                    </Space>
                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip title="Apply Template">
                        <Button
                          type="primary"
                          size="small"
                          icon={<PlayCircleOutlined />}
                          className="h-7 text-[10px]"
                          onClick={() => handleApply(template)}
                        >
                          Apply
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                  <div>
                    <Text type="secondary" className="text-[10px] block">
                      {formatLabel(template.reportType)} -{" "}
                      {template.columns?.length || 0} columns
                    </Text>
                    {template.description && (
                      <Text type="secondary" className="text-[10px] block truncate">
                        {template.description}
                      </Text>
                    )}
                    <Text type="secondary" className="text-[10px]">
                      Updated {getRelativeTime(template.updatedAt)}
                    </Text>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {myTemplates.length === 0 && publicTemplates.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Text type="secondary" className="block mb-2">
                No templates available
              </Text>
              <Text type="secondary" className="text-xs">
                Save your report configurations as templates for quick reuse
              </Text>
            </div>
          }
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openSaveModal}
            disabled={!reportType}
          >
            Create Template
          </Button>
        </Empty>
      )}

      {/* Save Template Modal */}
      <Modal
        title={
          <Space>
            <SaveOutlined />
            {editingTemplate ? "Edit Template" : "Save as Template"}
          </Space>
        }
        open={saveModalVisible}
        onCancel={() => {
          setSaveModalVisible(false);
          setEditingTemplate(null);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveTemplate}
          className="mt-4"
        >
          <Form.Item
            name="name"
            label="Template Name"
            rules={[
              { required: true, message: "Please enter a template name" },
              { max: 100, message: "Name must be less than 100 characters" },
            ]}
          >
            <Input placeholder="e.g., Monthly Mentor Report" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description (Optional)"
            rules={[
              { max: 500, message: "Description must be less than 500 characters" },
            ]}
          >
            <TextArea
              rows={3}
              placeholder="Brief description of this template's purpose..."
            />
          </Form.Item>

          <Form.Item
            name="isPublic"
            label="Share Template"
            valuePropName="checked"
            extra="Public templates can be used by other users"
          >
            <Switch
              checkedChildren={<GlobalOutlined />}
              unCheckedChildren={<LockOutlined />}
            />
          </Form.Item>

          {/* Preview of what will be saved */}
          <div className="bg-gray-50 p-3 rounded-lg mb-4">
            <Text strong className="block mb-2">
              Configuration Preview
            </Text>
            <div className="space-y-1 text-sm">
              <div>
                <Text type="secondary">Report Type: </Text>
                <Text>{formatLabel(reportType || "Not selected")}</Text>
              </div>
              <div>
                <Text type="secondary">Columns: </Text>
                <Text>{selectedColumns?.length || 0} selected</Text>
              </div>
              <div>
                <Text type="secondary">Filters: </Text>
                <Text>{Object.keys(filters || {}).length} configured</Text>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setSaveModalVisible(false);
                setEditingTemplate(null);
                form.resetFields();
              }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              icon={<SaveOutlined />}
            >
              {editingTemplate ? "Update Template" : "Save Template"}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default TemplateManager;