import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Card,
  Table,
  Tag,
  Button,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Empty,
  Spin,
  Descriptions,
  Timeline,
  Alert,
  Divider,
  Row,
  Col,
  Badge,
  Tabs,
  Steps,
  Tooltip,
  Avatar,
} from "antd";
import {
  EyeOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  AlertOutlined,
  FileTextOutlined,
  UserOutlined,
  BankOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  RiseOutlined,
  ArrowUpOutlined,
  SendOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import {
  fetchFacultyGrievances,
  fetchGrievanceEscalationChain,
  respondToGrievance,
  escalateGrievance,
  rejectGrievance,
  updateGrievanceStatus,
  selectFacultyGrievances,
} from "../store/facultySlice";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Escalation level labels
const ESCALATION_LEVELS = {
  MENTOR: { label: "Faculty Mentor", level: 1, icon: <UserOutlined />, color: "blue" },
  PRINCIPAL: { label: "Principal", level: 2, icon: <BankOutlined />, color: "orange" },
  STATE_DIRECTORATE: { label: "State Directorate", level: 3, icon: <TeamOutlined />, color: "red" },
};

export default function FacultyGrievances() {
  const dispatch = useDispatch();
  // Get user from Redux state
  const user = useSelector((state) => state.auth.user);
  const { list: grievances, loading, escalationChain } = useSelector(selectFacultyGrievances);

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [respondModalVisible, setRespondModalVisible] = useState(false);
  const [escalateModalVisible, setEscalateModalVisible] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [respondForm] = Form.useForm();
  const [escalateForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Derive user info from Redux state
  const userId = user?.id;

  // Calculate stats from grievances
  const stats = {
    total: (grievances || []).length,
    pending: (grievances || []).filter(
      (g) => g.status === "PENDING" || g.status === "SUBMITTED"
    ).length,
    inProgress: (grievances || []).filter(
      (g) => g.status === "IN_PROGRESS" || g.status === "UNDER_REVIEW"
    ).length,
    resolved: (grievances || []).filter((g) => g.status === "RESOLVED" || g.status === "CLOSED").length,
    escalated: (grievances || []).filter((g) => g.status === "ESCALATED").length,
  };

  useEffect(() => {
    if (userId) {
      dispatch(fetchFacultyGrievances(userId));
    }
  }, [userId, dispatch]);

  const refreshGrievances = useCallback(() => {
    if (userId) {
      dispatch(fetchFacultyGrievances(userId));
    }
  }, [userId, dispatch]);

  const fetchEscalationChainData = useCallback(async (grievanceId) => {
    try {
      await dispatch(fetchGrievanceEscalationChain(grievanceId)).unwrap();
    } catch (error) {
      console.error("Error fetching escalation chain:", error);
    }
  }, [dispatch]);

  const getStatusColor = (status) => {
    const statusColors = {
      SUBMITTED: "blue",
      PENDING: "orange",
      UNDER_REVIEW: "cyan",
      IN_PROGRESS: "processing",
      RESOLVED: "success",
      CLOSED: "default",
      ESCALATED: "red",
      REJECTED: "red",
    };
    return statusColors[status] || "default";
  };

  const getSeverityColor = (severity) => {
    const colors = {
      LOW: "green",
      MEDIUM: "orange",
      HIGH: "red",
      URGENT: "purple",
    };
    return colors[severity] || "default";
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "RESOLVED":
      case "CLOSED":
        return <CheckCircleOutlined style={{ color: "rgb(var(--color-success))" }} />;
      case "ESCALATED":
        return <RiseOutlined style={{ color: "rgb(var(--color-error))" }} />;
      case "REJECTED":
        return <CloseCircleOutlined style={{ color: "rgb(var(--color-error))" }} />;
      case "IN_PROGRESS":
      case "UNDER_REVIEW":
        return <ClockCircleOutlined style={{ color: "rgb(var(--color-warning))" }} />;
      default:
        return <ExclamationCircleOutlined style={{ color: "rgb(var(--color-primary))" }} />;
    }
  };

  const handleRespond = async (values) => {
    try {
      setSubmitting(true);
      await dispatch(respondToGrievance({
        grievanceId: selectedGrievance.id,
        response: values.response,
        status: values.status || null
      })).unwrap();
      toast.success("Response submitted successfully");
      setRespondModalVisible(false);
      respondForm.resetFields();
      refreshGrievances();
    } catch (error) {
      console.error("Error responding to grievance:", error);
      const errorMessage = typeof error === 'string' ? error : error?.message || "Failed to submit response";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalate = async (values) => {
    try {
      setSubmitting(true);
      await dispatch(escalateGrievance({
        grievanceId: selectedGrievance.id,
        reason: values.reason
      })).unwrap();
      toast.success("Grievance escalated successfully");
      setEscalateModalVisible(false);
      escalateForm.resetFields();
      setDetailModalVisible(false);
      refreshGrievances();
    } catch (error) {
      console.error("Error escalating grievance:", error);
      const errorMessage = typeof error === 'string' ? error : error?.message || "Failed to escalate grievance";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (grievanceId, newStatus) => {
    try {
      if (newStatus === "REJECTED") {
        const reason = window.prompt("Please provide a reason for rejection:");
        if (!reason) return;
        await dispatch(rejectGrievance({ grievanceId, reason })).unwrap();
      } else {
        await dispatch(updateGrievanceStatus({ grievanceId, status: newStatus })).unwrap();
      }
      toast.success(`Grievance marked as ${newStatus.toLowerCase().replace("_", " ")}`);
      setDetailModalVisible(false);
      refreshGrievances();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || "Failed to update status";
      toast.error(errorMessage);
    }
  };

  const openDetailModal = async (grievance) => {
    setSelectedGrievance(grievance);
    setDetailModalVisible(true);
    await fetchEscalationChainData(grievance.id);
  };

  const openRespondModal = (grievance) => {
    setSelectedGrievance(grievance);
    respondForm.resetFields();
    setRespondModalVisible(true);
  };

  const openEscalateModal = (grievance) => {
    setSelectedGrievance(grievance);
    escalateForm.resetFields();
    setEscalateModalVisible(true);
  };

  // Render escalation chain
  const renderEscalationChain = () => {
    if (!escalationChain) return null;

    const { escalationChain: chain, currentLevel, canEscalate, nextLevel } = escalationChain;

    return (
      <Card size="small" title={
        <Space>
          <RiseOutlined />
          <span>Escalation Progress</span>
        </Space>
      } className="mb-4">
        <Steps
          size="small"
          current={ESCALATION_LEVELS[currentLevel]?.level - 1 || 0}
          items={chain?.map((item) => ({
            title: ESCALATION_LEVELS[item.level]?.label || item.level,
            description: item.isCurrentLevel ? "Current" : item.isPastLevel ? "Done" : "Pending",
            status: item.isCurrentLevel ? "process" : item.isPastLevel ? "finish" : "wait",
          })) || []}
        />
        {canEscalate && (
          <Alert
            type="info"
            className="mt-3"
            showIcon
            title={`Can escalate to ${ESCALATION_LEVELS[nextLevel]?.label || nextLevel}`}
          />
        )}
        {!canEscalate && currentLevel === "STATE_DIRECTORATE" && (
          <Alert
            type="warning"
            className="mt-3"
            showIcon
            title="At highest escalation level"
          />
        )}
      </Card>
    );
  };

  const columns = [
    {
      title: "Severity",
      dataIndex: "severity",
      key: "severity",
      width: 100,
      render: (severity) => (
        <Tag
          color={getSeverityColor(severity)}
          icon={severity === "URGENT" || severity === "HIGH" ? <WarningOutlined /> : null}
        >
          {severity}
        </Tag>
      ),
    },
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "Student",
      dataIndex: ["student", "user", "name"],
      key: "student",
      render: (name, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{name || record.student?.user?.name || record.student?.name || "N/A"}</Text>
          <Text type="secondary" className="text-xs">
            {record.student?.user?.rollNumber || record.student?.rollNumber}
          </Text>
        </Space>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      render: (category) => (
        <Tag color="blue">{category?.replace(/_/g, " ")}</Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Badge
          status={
            status === "RESOLVED" || status === "CLOSED"
              ? "success"
              : status === "ESCALATED"
              ? "error"
              : status === "IN_PROGRESS" || status === "UNDER_REVIEW"
              ? "processing"
              : "default"
          }
          text={status?.replace(/_/g, " ")}
        />
      ),
    },
    {
      title: "Escalation",
      dataIndex: "escalationLevel",
      key: "escalationLevel",
      width: 130,
      render: (level) => {
        const levelInfo = ESCALATION_LEVELS[level] || {};
        return (
          <Tooltip title={`Level ${levelInfo.level || 1}`}>
            <Tag color={levelInfo.color || "blue"} className="rounded-full px-2">
              {levelInfo.label || level}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Submitted",
      dataIndex: "submittedDate",
      key: "submittedDate",
      render: (date, record) => (
        <Tooltip title={dayjs(date || record.createdAt).format("DD MMM YYYY HH:mm")}>
          <Text className="text-xs">{dayjs(date || record.createdAt).fromNow()}</Text>
        </Tooltip>
      ),
    },
    {
      title: "Action",
      key: "action",
      fixed: "right",
      width: 200,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record)}
          >
            View
          </Button>
          {record.assignedToId === userId && !["RESOLVED", "CLOSED", "REJECTED"].includes(record.status) && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<MessageOutlined />}
                onClick={() => openRespondModal(record)}
              >
                Respond
              </Button>
              <Button
                size="small"
                icon={<ArrowUpOutlined />}
                onClick={() => openEscalateModal(record)}
                className="text-warning border-warning"
              >
                Escalate
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const filteredGrievances = (status) => {
    if (status === "all") return grievances;
    if (status === "pending")
      return grievances.filter((g) => g.status === "SUBMITTED" || g.status === "PENDING");
    if (status === "inProgress")
      return grievances.filter((g) => g.status === "IN_PROGRESS" || g.status === "UNDER_REVIEW");
    if (status === "resolved")
      return grievances.filter((g) => g.status === "RESOLVED" || g.status === "CLOSED");
    if (status === "escalated")
      return grievances.filter((g) => g.status === "ESCALATED");
    return grievances;
  };

  const tabItems = [
    { key: "all", label: `All (${stats.total})` },
    { key: "pending", label: `Pending (${stats.pending})` },
    { key: "inProgress", label: `In Progress (${stats.inProgress})` },
    { key: "escalated", label: `Escalated (${stats.escalated})` },
    { key: "resolved", label: `Resolved (${stats.resolved})` },
  ];

  return (
    <div className="h-full overflow-y-auto hide-scrollbar p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Title level={2} className="!mb-1">Assigned Grievances</Title>
            <Text type="secondary">Manage and resolve grievances assigned to you</Text>
          </div>
        </div>

        {/* Statistics Cards - Compact Horizontal Layout */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          <Card className="rounded-lg border border-gray-100 hover:shadow-md transition-all" bodyStyle={{ padding: '12px 14px' }} size="small">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FileTextOutlined style={{ fontSize: '16px', color: '#3b82f6' }} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase text-gray-400 truncate">Total</div>
                <div className="text-xl font-bold text-blue-600">{stats.total}</div>
              </div>
            </div>
          </Card>

          <Card className="rounded-lg border border-gray-100 hover:shadow-md transition-all" bodyStyle={{ padding: '12px 14px' }} size="small">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <ClockCircleOutlined style={{ fontSize: '16px', color: '#f59e0b' }} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase text-gray-400 truncate">Pending</div>
                <div className="text-xl font-bold text-orange-500">{stats.pending}</div>
              </div>
            </div>
          </Card>

          <Card className="rounded-lg border border-gray-100 hover:shadow-md transition-all" bodyStyle={{ padding: '12px 14px' }} size="small">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                <ExclamationCircleOutlined style={{ fontSize: '16px', color: '#06b6d4' }} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase text-gray-400 truncate">In Progress</div>
                <div className="text-xl font-bold text-cyan-600">{stats.inProgress}</div>
              </div>
            </div>
          </Card>

          <Card className="rounded-lg border border-gray-100 hover:shadow-md transition-all" bodyStyle={{ padding: '12px 14px' }} size="small">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <RiseOutlined style={{ fontSize: '16px', color: '#ef4444' }} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase text-gray-400 truncate">Escalated</div>
                <div className="text-xl font-bold text-red-500">{stats.escalated}</div>
              </div>
            </div>
          </Card>

          <Card className="rounded-lg border border-gray-100 hover:shadow-md transition-all" bodyStyle={{ padding: '12px 14px' }} size="small">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircleOutlined style={{ fontSize: '16px', color: '#10b981' }} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase text-gray-400 truncate">Resolved</div>
                <div className="text-xl font-bold text-green-600">{stats.resolved}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Alert for pending */}
        {stats.pending > 0 && (
          <Alert
            title={`You have ${stats.pending} pending grievance${stats.pending > 1 ? "s" : ""} requiring attention`}
            type="warning"
            showIcon
            closable
          />
        )}

        {/* Grievances Table with Tabs */}
        <Card className="border border-gray-200 shadow-sm">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Spin size="small" />
            </div>
          ) : (
            <Table
              dataSource={filteredGrievances(activeTab)}
              columns={columns}
              rowKey="id"
              scroll={{ x: "max-content" }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} grievances`,
              }}
              locale={{
                emptyText: (
                  <Empty
                    description="No grievances found"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
            />
          )}
        </Card>

        {/* Detail Modal */}
        <Modal
          title={<><FileTextOutlined className="mr-2" />Grievance Details</>}
          open={detailModalVisible}
          onCancel={() => {
            setDetailModalVisible(false);
            setSelectedGrievance(null);
          }}
          width={900}
          footer={
            selectedGrievance && selectedGrievance.assignedToId === userId &&
            !["RESOLVED", "CLOSED", "REJECTED"].includes(selectedGrievance.status) ? (
              <Space>
                <Button onClick={() => setDetailModalVisible(false)}>Close</Button>
                <Button
                  icon={<ArrowUpOutlined />}
                  onClick={() => {
                    setDetailModalVisible(false);
                    openEscalateModal(selectedGrievance);
                  }}
                  className="text-warning border-warning"
                >
                  Escalate
                </Button>
                <Button
                  danger
                  onClick={() => handleUpdateStatus(selectedGrievance.id, "REJECTED")}
                >
                  Reject
                </Button>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleUpdateStatus(selectedGrievance.id, "RESOLVED")}
                >
                  Resolve
                </Button>
              </Space>
            ) : (
              <Button onClick={() => setDetailModalVisible(false)}>Close</Button>
            )
          }
        >
          {selectedGrievance && (
            <div className="space-y-4">
              {/* Status Banner */}
              <Alert
                title={`Status: ${selectedGrievance.status?.replace(/_/g, " ")}`}
                type={
                  selectedGrievance.status === "RESOLVED" || selectedGrievance.status === "CLOSED"
                    ? "success"
                    : selectedGrievance.status === "ESCALATED" || selectedGrievance.status === "REJECTED"
                    ? "error"
                    : "info"
                }
                showIcon
                icon={getStatusIcon(selectedGrievance.status)}
              />

              {/* Not Assigned Warning */}
              {selectedGrievance.assignedToId !== userId && (
                <Alert
                  title="View Only"
                  description={
                    <span>
                      This grievance is assigned to{" "}
                      <Text strong>{selectedGrievance.assignedTo?.name || "another user"}</Text>.
                      You can view but cannot update.
                    </span>
                  }
                  type="info"
                  showIcon
                />
              )}

              {/* Escalation Chain */}
              {renderEscalationChain()}

              {/* Student Information */}
              <Card size="small" title="Student Information">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="Name">
                    <Text strong>{selectedGrievance.student?.user?.name || "N/A"}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Roll Number">
                    {selectedGrievance.student?.user?.rollNumber || selectedGrievance.student?.rollNumber}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {selectedGrievance.student?.user?.email || selectedGrievance.student?.email}
                  </Descriptions.Item>
                  <Descriptions.Item label="Branch">
                    {selectedGrievance.student?.user?.branchName || selectedGrievance.student?.branchName}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* Grievance Details */}
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Title" span={2}>
                  <Text strong>{selectedGrievance.title}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Category">
                  <Tag color="blue">{selectedGrievance.category?.replace(/_/g, " ")}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Severity">
                  <Tag color={getSeverityColor(selectedGrievance.severity)}>
                    {selectedGrievance.severity}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Escalation Level">
                  <Tag color={ESCALATION_LEVELS[selectedGrievance.escalationLevel]?.color || "blue"}>
                    {ESCALATION_LEVELS[selectedGrievance.escalationLevel]?.label || selectedGrievance.escalationLevel}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Submitted">
                  {dayjs(selectedGrievance.submittedDate || selectedGrievance.createdAt).format("DD MMM YYYY HH:mm")}
                </Descriptions.Item>
                {selectedGrievance.assignedTo && (
                  <Descriptions.Item label="Assigned To" span={2}>
                    <Space>
                      <Avatar size="small" icon={<UserOutlined />} />
                      {selectedGrievance.assignedTo.name}
                      <Tag>{selectedGrievance.assignedTo.role?.replace(/_/g, " ")}</Tag>
                    </Space>
                  </Descriptions.Item>
                )}
              </Descriptions>

              {/* Description */}
              <Card size="small" title="Description">
                <Paragraph>{selectedGrievance.description}</Paragraph>
              </Card>

              {/* Action Requested */}
              {selectedGrievance.actionRequested && (
                <Card size="small" title="Action Requested">
                  <Paragraph>{selectedGrievance.actionRequested}</Paragraph>
                </Card>
              )}

              {/* Resolution */}
              {selectedGrievance.resolution && (
                <Card
                  size="small"
                  title={selectedGrievance.status === "REJECTED" ? "Rejection Reason" : "Resolution"}
                  className={selectedGrievance.status === "REJECTED" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}
                >
                  <Paragraph>{selectedGrievance.resolution}</Paragraph>
                </Card>
              )}

              {/* Status History */}
              {selectedGrievance.statusHistory && selectedGrievance.statusHistory.length > 0 && (
                <Card size="small" title={<><ClockCircleOutlined /> Status History</>}>
                  <Timeline
                    items={selectedGrievance.statusHistory.map((history) => ({
                      color: history.action === "ESCALATED" ? "red" :
                             history.action === "RESOLVED" ? "green" : "blue",
                      children: (
                        <div>
                          <Text strong>
                            {history.action === "SUBMITTED" && "Submitted"}
                            {history.action === "ASSIGNED" && `Assigned to ${history.changedBy?.name}`}
                            {history.action === "ESCALATED" && `Escalated to ${ESCALATION_LEVELS[history.escalationLevel]?.label}`}
                            {history.action === "RESPONDED" && "Response Added"}
                            {history.action === "STATUS_CHANGED" && `Status: ${history.toStatus?.replace(/_/g, " ")}`}
                            {history.action === "REJECTED" && "Rejected"}
                          </Text>
                          <Text type="secondary" className="ml-2 text-xs">
                            {dayjs(history.createdAt).format("DD MMM YYYY HH:mm")}
                          </Text>
                          {history.remarks && (
                            <Paragraph type="secondary" className="mt-1 mb-0 text-sm">
                              {history.remarks}
                            </Paragraph>
                          )}
                        </div>
                      ),
                    }))}
                  />
                </Card>
              )}
            </div>
          )}
        </Modal>

        {/* Respond Modal */}
        <Modal
          title={<><MessageOutlined className="text-success mr-2" />Respond to Grievance</>}
          open={respondModalVisible}
          onCancel={() => setRespondModalVisible(false)}
          footer={null}
        >
          <Form form={respondForm} layout="vertical" onFinish={handleRespond}>
            {selectedGrievance && (
              <Alert
                title={selectedGrievance.title}
                type="info"
                className="mb-4"
              />
            )}
            <Form.Item name="status" label="Update Status">
              <Select placeholder="Optionally update status">
                <Option value="UNDER_REVIEW">Under Review</Option>
                <Option value="IN_PROGRESS">In Progress</Option>
                <Option value="RESOLVED">Mark as Resolved</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="response"
              label="Response"
              rules={[{ required: true, message: "Please enter your response" }]}
            >
              <TextArea rows={4} placeholder="Enter your response..." />
            </Form.Item>
            <Form.Item className="!mb-0">
              <Space className="w-full justify-end">
                <Button onClick={() => setRespondModalVisible(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={submitting} icon={<SendOutlined />}>
                  Submit Response
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Escalate Modal */}
        <Modal
          title={<><ArrowUpOutlined className="text-warning mr-2" />Escalate Grievance</>}
          open={escalateModalVisible}
          onCancel={() => setEscalateModalVisible(false)}
          footer={null}
        >
          <Form form={escalateForm} layout="vertical" onFinish={handleEscalate}>
            {selectedGrievance && (
              <Alert
                title={`Escalating: ${selectedGrievance.title}`}
                description={`Current level: ${ESCALATION_LEVELS[selectedGrievance.escalationLevel]?.label || selectedGrievance.escalationLevel}`}
                type="warning"
                className="mb-4"
              />
            )}
            <Form.Item
              name="reason"
              label="Reason for Escalation"
              rules={[{ required: true, message: "Please provide a reason" }]}
            >
              <TextArea rows={4} placeholder="Why is this being escalated?" />
            </Form.Item>
            <Form.Item className="!mb-0">
              <Space className="w-full justify-end">
                <Button onClick={() => setEscalateModalVisible(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={submitting} icon={<ArrowUpOutlined />}>
                  Escalate
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
