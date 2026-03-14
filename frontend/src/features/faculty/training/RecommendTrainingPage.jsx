import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  Table,
  Tag,
  Space,
  Modal,
  Typography,
  message,
  Tabs,
  Empty,
  Tooltip,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  BulbOutlined,
  SendOutlined,
} from "@ant-design/icons";
import {
  fetchMyRecommendations,
  createRecommendation,
  updateRecommendation,
  deleteRecommendation,
} from "../store/facultyTrainingSlice";
import { useLookup } from "../../shared/hooks/useLookup";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const STATUS_COLORS = {
  PENDING: "gold",
  UNDER_REVIEW: "blue",
  APPROVED: "green",
  REJECTED: "red",
  IMPLEMENTED: "purple",
};

const PRIORITY_COLORS = {
  LOW: "default",
  MEDIUM: "blue",
  HIGH: "orange",
  URGENT: "red",
};

const RecommendTrainingPage = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { branchOptions, branchesLoading } = useLookup({ include: ["branches"] });

  const { recommendations } = useSelector((state) => state.facultyTraining);

  useEffect(() => {
    dispatch(fetchMyRecommendations());
  }, [dispatch]);

  const handleOpenModal = (record = null) => {
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue({
        title: record.title,
        description: record.description,
        targetBranchIds: Array.isArray(record.targetBranches)
          ? record.targetBranches.map((branch) => branch.id)
          : [],
        suggestedDuration: record.suggestedDuration,
        suggestedMode: record.suggestedMode,
        suggestedDifficulty: record.suggestedDifficulty,
        topicsCovered: record.topicsCovered,
        learningOutcomes: record.learningOutcomes,
        relevanceReason: record.relevanceReason,
        suggestedTrainer: record.suggestedTrainer,
        estimatedBudget: record.estimatedBudget,
        priority: record.priority,
      });
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();

      if (editingId) {
        await dispatch(updateRecommendation({ id: editingId, data: values })).unwrap();
        message.success("Recommendation updated successfully");
      } else {
        await dispatch(createRecommendation(values)).unwrap();
        message.success("Recommendation submitted successfully");
      }

      handleCloseModal();
      dispatch(fetchMyRecommendations());
    } catch (error) {
      message.error(error || "Failed to save recommendation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteRecommendation(id)).unwrap();
      message.success("Recommendation deleted successfully");
      dispatch(fetchMyRecommendations());
    } catch (error) {
      message.error(error || "Failed to delete recommendation");
    }
  };

  const handleView = (record) => {
    setSelectedRecord(record);
    setViewModalOpen(true);
  };

  const columns = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text, record) => (
        <div>
          <Text strong className="text-sm">{text}</Text>
          {Array.isArray(record.targetBranches) && record.targetBranches.length > 0 && (
            <div className="text-xs text-slate-500 mt-0.5">
              {record.targetBranches
                .map((branch) => branch.shortName || branch.name || branch.code)
                .filter(Boolean)
                .join(", ")}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 100,
      render: (priority) => (
        <Tag color={PRIORITY_COLORS[priority]}>{priority}</Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status) => (
        <Tag color={STATUS_COLORS[status]}>{status.replace("_", " ")}</Tag>
      ),
    },
    {
      title: "Submitted",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 110,
      render: (date) => (
        <Text className="text-xs">
          {new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
          {record.status === "PENDING" && (
            <>
              <Tooltip title="Edit">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleOpenModal(record)}
                />
              </Tooltip>
              <Popconfirm
                title="Delete this recommendation?"
                onConfirm={() => handleDelete(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Tooltip title="Delete">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const pendingCount = recommendations?.list?.filter(r => r.status === "PENDING").length || 0;
  const reviewedCount = recommendations?.list?.filter(r => r.status !== "PENDING").length || 0;

  return (
    <div className="p-4 training-ui">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Title level={4} className="!mb-0.5 text-lg">
            <BulbOutlined className="mr-2 text-amber-500" />
            Recommend Training
          </Title>
          <Text type="secondary" className="text-xs">
            Suggest new training programs for faculty development
          </Text>
        </div>
        <Button
          type="primary"
          size="middle"
          icon={<PlusOutlined />}
          onClick={() => handleOpenModal()}
        >
          New Recommendation
        </Button>
      </div>

      {/* Content */}
      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: 0 } }}>
        <Tabs
          defaultActiveKey="all"
          className="custom-tabs px-4"
          size="small"
          items={[
            {
              key: "all",
              label: `All (${recommendations?.list?.length || 0})`,
              children: (
                <div className="py-2 custom-scrollbar overflow-x-auto">
                  <Table
                    className="custom-table"
                    dataSource={recommendations?.list || []}
                    columns={columns}
                    rowKey="id"
                    loading={recommendations?.loading}
                    size="small"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showTotal: (total) => <Text className="text-[10px]">{total} recommendations</Text>,
                      size: 'small',
                    }}
                    scroll={{ x: 'max-content' }}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="No recommendations yet"
                        >
                          <Button type="primary" size="small" onClick={() => handleOpenModal()}>
                            Submit Your First Recommendation
                          </Button>
                        </Empty>
                      ),
                    }}
                  />
                </div>
              ),
            },
            {
              key: "pending",
              label: `Pending (${pendingCount})`,
              children: (
                <div className="py-2 custom-scrollbar overflow-x-auto">
                  <Table
                    className="custom-table"
                    dataSource={recommendations?.list?.filter(r => r.status === "PENDING") || []}
                    columns={columns}
                    rowKey="id"
                    size="small"
                    loading={recommendations?.loading}
                    pagination={{ pageSize: 10, size: 'small' }}
                    scroll={{ x: 'max-content' }}
                  />
                </div>
              ),
            },
            {
              key: "reviewed",
              label: `Reviewed (${reviewedCount})`,
              children: (
                <div className="py-2 custom-scrollbar overflow-x-auto">
                  <Table
                    className="custom-table"
                    dataSource={recommendations?.list?.filter(r => r.status !== "PENDING") || []}
                    columns={columns}
                    rowKey="id"
                    size="small"
                    loading={recommendations?.loading}
                    pagination={{ pageSize: 10, size: 'small' }}
                    scroll={{ x: 'max-content' }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingId ? "Edit Recommendation" : "Recommend a Training"}
        open={isModalOpen}
        onCancel={handleCloseModal}
        width={700}
        footer={[
          <Button key="cancel" onClick={handleCloseModal}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<SendOutlined />}
            loading={submitting}
            onClick={handleSubmit}
          >
            {editingId ? "Update" : "Submit Recommendation"}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="title"
            label="Training Title"
            rules={[{ required: true, message: "Please enter a title" }]}
          >
            <Input placeholder="e.g., Advanced Machine Learning Techniques" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: "Please provide a description" }]}
          >
            <TextArea
              rows={4}
              placeholder="Describe the training content, objectives, and what participants will learn..."
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="targetBranchIds"
              label="Target Branches"
              rules={[
                {
                  required: true,
                  type: "array",
                  min: 1,
                  message: "Please select at least one target branch",
                },
              ]}
            >
              <Select
                mode="multiple"
                placeholder="Select target branches"
                options={branchOptions}
                loading={branchesLoading}
                allowClear
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item name="suggestedDuration" label="Suggested Duration (hours)">
              <InputNumber min={1} max={200} className="w-full" placeholder="e.g., 40" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Form.Item name="suggestedMode" label="Delivery Mode">
              <Select placeholder="Select mode" allowClear>
                <Option value="ONLINE">Online</Option>
                <Option value="OFFLINE">Offline</Option>
                <Option value="HYBRID">Hybrid</Option>
              </Select>
            </Form.Item>

            <Form.Item name="suggestedDifficulty" label="Difficulty Level">
              <Select placeholder="Select level" allowClear>
                <Option value="BEGINNER">Beginner</Option>
                <Option value="INTERMEDIATE">Intermediate</Option>
                <Option value="ADVANCED">Advanced</Option>
              </Select>
            </Form.Item>

            <Form.Item name="priority" label="Priority">
              <Select placeholder="Select priority" defaultValue="MEDIUM">
                <Option value="LOW">Low</Option>
                <Option value="MEDIUM">Medium</Option>
                <Option value="HIGH">High</Option>
                <Option value="URGENT">Urgent</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="topicsCovered" label="Topics to be Covered">
            <TextArea
              rows={3}
              placeholder="List the main topics that should be covered in this training..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item name="relevanceReason" label="Why is this Training Needed?">
            <TextArea
              rows={3}
              placeholder="Explain the relevance and benefits of this training for faculty development..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="suggestedTrainer" label="Suggested Trainer/Organization">
              <Input placeholder="e.g., NPTEL, Industry Expert Name" />
            </Form.Item>

            <Form.Item name="estimatedBudget" label="Estimated Budget">
              <InputNumber
                min={0}
                className="w-full"
                placeholder="Estimated cost"
                formatter={(value) => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(value) => value.replace(/₹\s?|(,*)/g, "")}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* View Details Modal */}
      <Modal
        title="Recommendation Details"
        open={viewModalOpen}
        onCancel={() => setViewModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={600}
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div>
              <Text type="secondary" className="text-xs">Title</Text>
              <Title level={5} className="!mt-0 !mb-2">{selectedRecord.title}</Title>
            </div>

            <div className="flex gap-2">
              <Tag color={STATUS_COLORS[selectedRecord.status]}>
                {selectedRecord.status.replace("_", " ")}
              </Tag>
              <Tag color={PRIORITY_COLORS[selectedRecord.priority]}>
                {selectedRecord.priority} Priority
              </Tag>
            </div>

            <div>
              <Text type="secondary" className="text-xs">Description</Text>
              <Paragraph className="!mb-0 mt-1">{selectedRecord.description}</Paragraph>
            </div>

            {selectedRecord.topicsCovered && (
              <div>
                <Text type="secondary" className="text-xs">Topics Covered</Text>
                <Paragraph className="!mb-0 mt-1">{selectedRecord.topicsCovered}</Paragraph>
              </div>
            )}

            {selectedRecord.relevanceReason && (
              <div>
                <Text type="secondary" className="text-xs">Relevance</Text>
                <Paragraph className="!mb-0 mt-1">{selectedRecord.relevanceReason}</Paragraph>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {Array.isArray(selectedRecord.targetBranches) && selectedRecord.targetBranches.length > 0 && (
                <div>
                  <Text type="secondary" className="text-xs">Target Branches</Text>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedRecord.targetBranches.map((branch) => (
                      <Tag key={branch.id} className="m-0">
                        {branch.shortName || branch.name || branch.code}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
              {selectedRecord.suggestedDuration && (
                <div>
                  <Text type="secondary" className="text-xs">Duration</Text>
                  <div>{selectedRecord.suggestedDuration} hours</div>
                </div>
              )}
              {selectedRecord.suggestedMode && (
                <div>
                  <Text type="secondary" className="text-xs">Delivery Mode</Text>
                  <div>{selectedRecord.suggestedMode}</div>
                </div>
              )}
              {selectedRecord.suggestedTrainer && (
                <div>
                  <Text type="secondary" className="text-xs">Suggested Trainer</Text>
                  <div>{selectedRecord.suggestedTrainer}</div>
                </div>
              )}
            </div>

            {selectedRecord.reviewComments && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <Text type="secondary" className="text-xs">Review Comments</Text>
                <Paragraph className="!mb-0 mt-1">{selectedRecord.reviewComments}</Paragraph>
              </div>
            )}

            {selectedRecord.rejectionReason && (
              <div className="p-3 bg-red-50 rounded-lg">
                <Text type="secondary" className="text-xs text-red-600">Rejection Reason</Text>
                <Paragraph className="!mb-0 mt-1 text-red-700">{selectedRecord.rejectionReason}</Paragraph>
              </div>
            )}

            {selectedRecord.implementedTraining && (
              <div className="p-3 bg-green-50 rounded-lg">
                <Text type="secondary" className="text-xs text-green-600">Implemented as Training</Text>
                <div className="mt-1 font-medium text-green-700">
                  {selectedRecord.implementedTraining.title}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RecommendTrainingPage;
