import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  BulbOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  fetchPrincipalRecommendations,
  reviewPrincipalRecommendation,
} from "../store/principalTrainingSlice";
import TrainingEmptyState from "../../../components/training/TrainingEmptyState";
import { TableRowSkeleton } from "../../../components/training/skeletons/TrainingSkeletons";

const { Text, Title, Paragraph } = Typography;

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

const RecommendTrainingApprovalPage = () => {
  const dispatch = useDispatch();
  const [searchText, setSearchText] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const { recommendations } = useSelector((state) => state.principalTraining);

  useEffect(() => {
    dispatch(fetchPrincipalRecommendations());
  }, [dispatch]);

  const openReview = (record, status = "APPROVED") => {
    setSelected(record);
    setReviewOpen(true);
    form.setFieldsValue({ status, reviewComments: "", rejectionReason: "" });
  };

  const openView = (record) => {
    setSelected(record);
    setViewOpen(true);
  };

  const handleReview = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await dispatch(
        reviewPrincipalRecommendation({
          id: selected.id,
          data: values,
        }),
      ).unwrap();
      message.success("Recommendation reviewed successfully");
      setReviewOpen(false);
      dispatch(fetchPrincipalRecommendations({ forceRefresh: true }));
    } catch (error) {
      message.error(error || "Failed to review recommendation");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecommendations = useMemo(() => {
    if (!searchText) return recommendations.list || [];
    const search = searchText.toLowerCase();
    return (recommendations.list || []).filter(
      (item) =>
        (item.title || "").toLowerCase().includes(search) ||
        (item.description || "").toLowerCase().includes(search) ||
        (item.user?.name || "").toLowerCase().includes(search) ||
        (item.user?.email || "").toLowerCase().includes(search),
    );
  }, [recommendations.list, searchText]);

  const isLoading = recommendations.loading && !recommendations.list?.length;

  const columns = [
    {
      title: "Recommendation",
      key: "title",
      render: (_, record) => (
        <div>
          <div className="font-medium text-sm text-slate-800">
            {record.title}
          </div>
          <Text className="text-xs text-slate-500">
            {record.user?.name || "Faculty"} ({record.user?.branchName || "-"})
          </Text>
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
      width: 130,
      render: (status) => (
        <Tag color={STATUS_COLORS[status]}>
          {String(status).replace("_", " ")}
        </Tag>
      ),
    },
    {
      title: "Submitted",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (value) => (
        <Text className="text-xs">
          {value
            ? new Date(value).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "-"}
        </Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openView(record)}
            />
          </Tooltip>
          {["PENDING", "UNDER_REVIEW"].includes(record.status) && (
            <>
              <Tooltip title="Approve">
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  className="text-green-600 hover:text-green-700"
                  onClick={() => openReview(record, "APPROVED")}
                />
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => openReview(record, "REJECTED")}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4 training-ui">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Title level={4} className="mb-0! text-lg">
            Training Recommendations
          </Title>
        </div>
      </div>

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
        <div className="mb-3">
          <Input
            placeholder="Search recommendations..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full"
            size="middle"
            allowClear
          />
        </div>

        {filteredRecommendations.length > 0 && (
          <div className="mb-2 pb-2 border-b border-slate-200">
            <Text className="text-[10px] text-slate-600">
              Showing <Text strong>{filteredRecommendations.length}</Text> of{" "}
              <Text strong>{recommendations.list?.length || 0}</Text>{" "}
              recommendations
            </Text>
          </div>
        )}

        {isLoading ? (
          <TableRowSkeleton rows={5} columns={4} />
        ) : filteredRecommendations.length === 0 ? (
          <TrainingEmptyState
            type={searchText ? "search" : "applications"}
            message={
              searchText
                ? "No matching recommendations"
                : "No recommendations found"
            }
            description={
              searchText
                ? "Try adjusting your search criteria."
                : "No faculty recommendations are available."
            }
            actionText={searchText ? "Clear Search" : undefined}
            onAction={searchText ? () => setSearchText("") : undefined}
          />
        ) : (
          <div className="custom-scrollbar overflow-x-auto">
            <Table
              className="custom-table"
              rowKey="id"
              columns={columns}
              dataSource={filteredRecommendations}
              loading={recommendations.loading}
              size="small"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) => (
                  <Text className="text-[10px] text-slate-600">
                    {range[0]}-{range[1]} of {total}
                  </Text>
                ),
                size: "small",
              }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        )}
      </Card>

      <Modal
        title="Review Recommendation"
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        onOk={handleReview}
        okText="Submit"
        confirmLoading={submitting}
      >
        {selected && (
          <div className="mb-3 p-3 bg-blue-50 rounded">
            <Text strong>{selected.title}</Text>
            <div className="text-xs text-slate-600 mt-1">
              By {selected.user?.name || "Faculty"}
            </div>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            name="status"
            label="Decision"
            rules={[{ required: true, message: "Please choose a decision" }]}
          >
            <Select
              options={[
                { value: "UNDER_REVIEW", label: "Under Review" },
                { value: "APPROVED", label: "Approve" },
                { value: "REJECTED", label: "Reject" },
              ]}
            />
          </Form.Item>
          <Form.Item name="reviewComments" label="Comments">
            <Input.TextArea
              rows={3}
              placeholder="Optional review comments..."
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.status !== cur.status}
          >
            {({ getFieldValue }) =>
              getFieldValue("status") === "REJECTED" ? (
                <Form.Item
                  name="rejectionReason"
                  label="Rejection Reason"
                  rules={[
                    {
                      required: true,
                      message: "Please provide rejection reason",
                    },
                  ]}
                >
                  <Input.TextArea rows={2} placeholder="Reason for rejection" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Recommendation Details"
        open={viewOpen}
        onCancel={() => setViewOpen(false)}
        footer={[
          <Button key="close" onClick={() => setViewOpen(false)}>
            Close
          </Button>,
        ]}
      >
        {selected && (
          <div className="space-y-3">
            <div>
              <Text type="secondary" className="text-xs">
                Title
              </Text>
              <Paragraph className="mb-0! mt-1 font-medium">
                {selected.title}
              </Paragraph>
            </div>
            <div className="flex gap-2">
              <Tag color={STATUS_COLORS[selected.status]}>
                {String(selected.status).replace("_", " ")}
              </Tag>
              <Tag color={PRIORITY_COLORS[selected.priority]}>
                {selected.priority}
              </Tag>
            </div>
            <div>
              <Text type="secondary" className="text-xs">
                Description
              </Text>
              <Paragraph className="mb-0! mt-1">
                {selected.description || "-"}
              </Paragraph>
            </div>
            {selected.relevanceReason && (
              <div>
                <Text type="secondary" className="text-xs">
                  Relevance
                </Text>
                <Paragraph className="mb-0! mt-1">
                  {selected.relevanceReason}
                </Paragraph>
              </div>
            )}
            {selected.reviewComments && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <Text type="secondary" className="text-xs">
                  Review Comments
                </Text>
                <Paragraph className="mb-0! mt-1">
                  {selected.reviewComments}
                </Paragraph>
              </div>
            )}
            {selected.rejectionReason && (
              <div className="p-3 bg-red-50 rounded-lg">
                <Text type="secondary" className="text-xs text-red-600">
                  Rejection Reason
                </Text>
                <Paragraph className="mb-0! mt-1 text-red-700">
                  {selected.rejectionReason}
                </Paragraph>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RecommendTrainingApprovalPage;
