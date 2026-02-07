import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  Table,
  Tag,
  Button,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Empty,
  Spin,
  Row,
  Col,
  Badge,
  Drawer,
  Timeline,
  Divider,
} from "antd";
import {
  PlusOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  BankOutlined,
  TeamOutlined,
  SendOutlined,
} from "@ant-design/icons";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import {
  fetchGrievances,
  fetchMentor,
  createGrievance,
} from "../store/studentSlice";
import {
  selectGrievancesList,
  selectGrievancesLoading,
  selectMentorWithFallback,
} from "../store/studentSelectors";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const ESCALATION_LEVELS = {
  MENTOR: { label: "Faculty Mentor", level: 1, icon: <UserOutlined />, color: "blue" },
  PRINCIPAL: { label: "Principal", level: 2, icon: <BankOutlined />, color: "orange" },
  STATE_DIRECTORATE: { label: "State Directorate", level: 3, icon: <TeamOutlined />, color: "red" },
};

const CATEGORIES = [
  { value: "INTERNSHIP_RELATED", label: "Internship Related" },
  { value: "MENTOR_RELATED", label: "Mentor Related" },
  { value: "INDUSTRY_RELATED", label: "Industry Related" },
  { value: "PAYMENT_ISSUE", label: "Payment Issue" },
  { value: "WORKPLACE_HARASSMENT", label: "Workplace Harassment" },
  { value: "WORK_CONDITION", label: "Work Condition" },
  { value: "SAFETY_CONCERN", label: "Safety Concern" },
  { value: "OTHER", label: "Other" },
];

const SEVERITIES = [
  { value: "LOW", label: "Low", color: "green" },
  { value: "MEDIUM", label: "Medium", color: "orange" },
  { value: "HIGH", label: "High", color: "red" },
  { value: "URGENT", label: "Urgent", color: "magenta" },
];

export default function StudentGrievance() {
  const dispatch = useDispatch();

  // Redux state
  const grievances = useSelector(selectGrievancesList);
  const loading = useSelector(selectGrievancesLoading);
  const mentorData = useSelector(selectMentorWithFallback);

  // Local state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    dispatch(fetchGrievances({}));
    dispatch(fetchMentor({}));
  }, [dispatch]);

  const handleOpenCreateModal = () => {
    if (!mentorData) {
      toast.error("Mentor not assigned yet. Please contact your institution.");
      return;
    }
    form.setFieldsValue({ assignedToId: mentorData.id });
    setCreateModalVisible(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      SUBMITTED: "blue",
      PENDING: "blue",
      UNDER_REVIEW: "orange",
      IN_PROGRESS: "processing",
      RESOLVED: "success",
      CLOSED: "default",
      ESCALATED: "red",
      REJECTED: "error",
    };
    return colors[status] || "default";
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "RESOLVED":
      case "CLOSED":
        return <CheckCircleOutlined className="text-green-500" />;
      case "ESCALATED":
      case "REJECTED":
        return <CloseCircleOutlined className="text-red-500" />;
      case "IN_PROGRESS":
      case "UNDER_REVIEW":
        return <ClockCircleOutlined className="text-orange-500" />;
      default:
        return <ExclamationCircleOutlined className="text-blue-500" />;
    }
  };

  const handleCreateGrievance = async (values) => {
    // Validate mentor is assigned before submitting
    if (!values.assignedToId && !mentorData?.id) {
      toast.error("Mentor not assigned. Please contact your institution.");
      return;
    }

    try {
      setSubmitting(true);
      await dispatch(createGrievance({
        ...values,
        assignedToId: values.assignedToId || mentorData?.id,
        submittedDate: new Date().toISOString(),
      })).unwrap();
      toast.success("Grievance submitted successfully");
      setCreateModalVisible(false);
      form.resetFields();
      dispatch(fetchGrievances({ forceRefresh: true }));
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || "Failed to submit grievance";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const openDetailDrawer = (grievance) => {
    setSelectedGrievance(grievance);
    setDetailDrawerVisible(true);
  };

  // Stats
  const stats = useMemo(() => {
    const list = Array.isArray(grievances) ? grievances : [];
    const total = list.length;
    const open = list.filter(g => !["RESOLVED", "CLOSED"].includes(g.status)).length;
    const resolved = list.filter(g => g.status === "RESOLVED").length;
    return { total, open, resolved };
  }, [grievances]);

  const columns = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text, record) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(record.status)}
          <Text className="text-sm font-medium">{text}</Text>
        </div>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      render: (category) => (
        <Tag className="rounded-md text-[10px] m-0">
          {category?.replace(/_/g, " ")}
        </Tag>
      ),
    },
    {
      title: "Severity",
      dataIndex: "severity",
      key: "severity",
      render: (severity) => {
        const config = SEVERITIES.find(s => s.value === severity) || SEVERITIES[1];
        return <Tag color={config.color} className="rounded-md text-[10px] m-0">{config.label}</Tag>;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Badge status={getStatusColor(status)} text={<span className="text-xs">{status?.replace(/_/g, " ")}</span>} />
      ),
    },
    {
      title: "Level",
      dataIndex: "escalationLevel",
      key: "escalationLevel",
      render: (level) => {
        const config = ESCALATION_LEVELS[level] || {};
        return (
          <Tag color={config.color} className="rounded-md text-[10px] m-0">
            {config.label || level}
          </Tag>
        );
      },
    },
    {
      title: "Date",
      dataIndex: "submittedDate",
      key: "submittedDate",
      render: (date) => <Text className="text-xs text-text-secondary">{dayjs(date).format("MMM D, YYYY")}</Text>,
    },
    {
      title: "",
      key: "action",
      width: 80,
      render: (_, record) => (
        <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDetailDrawer(record)} />
      ),
    },
  ];

  const grievanceList = Array.isArray(grievances) ? grievances : [];

  return (
    <div className="p-4 md:p-5 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <Title level={4} className="!mb-0 !text-lg">My Grievances</Title>
          <Text className="text-xs text-text-tertiary">Submit and track your concerns</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateModal} className="rounded-lg text-xs h-8">
          New Grievance
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="rounded-xl border" styles={{ body: { padding: "12px 16px" } }}>
          <Text className="text-[10px] text-text-tertiary uppercase font-semibold block">Total</Text>
          <Text className="text-xl font-bold">{stats.total}</Text>
        </Card>
        <Card className="rounded-xl border" styles={{ body: { padding: "12px 16px" } }}>
          <Text className="text-[10px] text-text-tertiary uppercase font-semibold block">Open</Text>
          <Text className="text-xl font-bold text-orange-500">{stats.open}</Text>
        </Card>
        <Card className="rounded-xl border" styles={{ body: { padding: "12px 16px" } }}>
          <Text className="text-[10px] text-text-tertiary uppercase font-semibold block">Resolved</Text>
          <Text className="text-xl font-bold text-green-500">{stats.resolved}</Text>
        </Card>
      </div>

      {/* Table */}
      <Card className="rounded-xl border" styles={{ body: { padding: 0 } }}>
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Spin size="small" />
          </div>
        ) : (
          <Table
            dataSource={grievanceList}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: false, size: "small" }}
            locale={{
              emptyText: (
                <Empty description="No grievances submitted" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                  <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleOpenCreateModal}>
                    Submit First Grievance
                  </Button>
                </Empty>
              ),
            }}
            className="[&_.ant-table-thead_th]:bg-gray-50 [&_.ant-table-thead_th]:text-[10px] [&_.ant-table-thead_th]:font-semibold [&_.ant-table-thead_th]:uppercase [&_.ant-table-thead_th]:text-text-tertiary"
          />
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        title={<span className="text-sm font-semibold">Submit Grievance</span>}
        open={createModalVisible}
        onCancel={() => { setCreateModalVisible(false); form.resetFields(); }}
        footer={null}
        width={500}
        className="[&_.ant-modal-content]:rounded-xl"
      >
        <Form form={form} layout="vertical" onFinish={handleCreateGrievance} className="mt-4">
          <Form.Item name="title" label={<span className="text-xs font-medium">Title</span>} rules={[{ required: true }, { min: 10, message: "Min 10 characters" }]}>
            <Input placeholder="Brief summary of your concern" className="rounded-lg h-9 text-xs" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="category" label={<span className="text-xs font-medium">Category</span>} rules={[{ required: true }]}>
                <Select placeholder="Select" className="h-9 text-xs">
                  {CATEGORIES.map(c => <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label={<span className="text-xs font-medium">Severity</span>} rules={[{ required: true }]}>
                <Select placeholder="Select" className="h-9 text-xs">
                  {SEVERITIES.map(s => <Select.Option key={s.value} value={s.value}><Tag color={s.color} className="m-0 text-[10px]">{s.label}</Tag></Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="assignedToId" hidden><Input /></Form.Item>

          <Form.Item name="description" label={<span className="text-xs font-medium">Description</span>} rules={[{ required: true }, { min: 50, message: "Min 50 characters" }]}>
            <TextArea rows={4} placeholder="Provide detailed information..." className="rounded-lg text-xs" />
          </Form.Item>

          <Form.Item name="actionRequested" label={<span className="text-xs font-medium">Action Requested (Optional)</span>}>
            <TextArea rows={2} placeholder="What outcome would you like?" className="rounded-lg text-xs" />
          </Form.Item>

          <Divider className="my-3" />

          <div className="flex justify-end gap-2">
            <Button onClick={() => { setCreateModalVisible(false); form.resetFields(); }} className="rounded-lg h-8 text-xs">Cancel</Button>
            <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting} className="rounded-lg h-8 text-xs">Submit</Button>
          </div>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={<span className="text-sm font-semibold">Grievance Details</span>}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setSelectedGrievance(null); }}
        styles={{ wrapper: { width: 420 } }}
        className="[&_.ant-drawer-body]:p-4"
      >
        {selectedGrievance && (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="p-3 rounded-xl bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedGrievance.status)}
                <Text className="text-sm font-semibold">{selectedGrievance.status?.replace(/_/g, " ")}</Text>
              </div>
              <Tag color={SEVERITIES.find(s => s.value === selectedGrievance.severity)?.color} className="m-0 rounded-md text-[10px]">
                {selectedGrievance.severity}
              </Tag>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-gray-50">
                <Text className="text-[10px] text-text-tertiary uppercase block">Category</Text>
                <Text className="text-xs font-medium">{selectedGrievance.category?.replace(/_/g, " ")}</Text>
              </div>
              <div className="p-3 rounded-lg bg-gray-50">
                <Text className="text-[10px] text-text-tertiary uppercase block">Escalation</Text>
                <Text className="text-xs font-medium">{ESCALATION_LEVELS[selectedGrievance.escalationLevel]?.label || "Mentor"}</Text>
              </div>
              <div className="p-3 rounded-lg bg-gray-50">
                <Text className="text-[10px] text-text-tertiary uppercase block">Submitted</Text>
                <Text className="text-xs font-medium">{dayjs(selectedGrievance.submittedDate).format("MMM D, YYYY")}</Text>
              </div>
              {selectedGrievance.assignedTo && (
                <div className="p-3 rounded-lg bg-gray-50">
                  <Text className="text-[10px] text-text-tertiary uppercase block">Assigned To</Text>
                  <Text className="text-xs font-medium">{selectedGrievance.assignedTo.name}</Text>
                </div>
              )}
            </div>

            {/* Title & Description */}
            <div>
              <Text className="text-[10px] text-text-tertiary uppercase font-semibold block mb-1">Title</Text>
              <Text className="text-sm font-semibold">{selectedGrievance.title}</Text>
            </div>

            <div>
              <Text className="text-[10px] text-text-tertiary uppercase font-semibold block mb-1">Description</Text>
              <Paragraph className="text-xs text-text-secondary mb-0 whitespace-pre-wrap">{selectedGrievance.description}</Paragraph>
            </div>

            {selectedGrievance.actionRequested && (
              <div>
                <Text className="text-[10px] text-text-tertiary uppercase font-semibold block mb-1">Action Requested</Text>
                <Paragraph className="text-xs text-text-secondary mb-0">{selectedGrievance.actionRequested}</Paragraph>
              </div>
            )}

            {/* Resolution */}
            {selectedGrievance.resolution && (
              <div className={`p-3 rounded-xl ${selectedGrievance.status === "REJECTED" ? "bg-red-50 border border-red-100" : "bg-green-50 border border-green-100"}`}>
                <Text className="text-[10px] text-text-tertiary uppercase font-semibold block mb-1">
                  {selectedGrievance.status === "REJECTED" ? "Rejection Reason" : "Resolution"}
                </Text>
                <Paragraph className="text-xs mb-0">{selectedGrievance.resolution}</Paragraph>
              </div>
            )}

            {/* Status History */}
            {selectedGrievance.statusHistory?.length > 0 && (
              <div>
                <Text className="text-[10px] text-text-tertiary uppercase font-semibold block mb-3">History</Text>
                <Timeline
                  items={selectedGrievance.statusHistory.map((h, i) => ({
                    color: h.action === "RESOLVED" ? "green" : h.action === "ESCALATED" ? "red" : "blue",
                    children: (
                      <div key={i}>
                        <Text className="text-xs font-medium block">{h.action}</Text>
                        <Text className="text-[10px] text-text-tertiary">{dayjs(h.createdAt).format("MMM D, YYYY h:mm A")}</Text>
                        {h.remarks && <Text className="text-[10px] text-text-secondary block italic mt-0.5">"{h.remarks}"</Text>}
                      </div>
                    ),
                  }))}
                />
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
