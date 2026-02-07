import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  DatePicker,
  Descriptions,
  Typography,
  Badge,
  Tabs,
  Popconfirm,
  Select,
  theme,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  PhoneOutlined,
  MailOutlined,
  BankOutlined,
  UserOutlined,
  CalendarOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { toast } from "react-hot-toast";
import {
  fetchApplications,
  approveApplication,
  rejectApplication,
  updateInternship,
  optimisticApproveApplication,
  optimisticRejectApplication,
  rollbackApplicationUpdate,
  selectApplications,
  selectLastFetched,
} from "../store/facultySlice";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const SelfIdentifiedApproval = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Get applications from Redux store
  const { list: applications, loading, error } = useSelector(selectApplications);
  const lastFetched = useSelector(selectLastFetched);
  const applicationsLastFetched = lastFetched?.applications;

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("pending");

  // Fetch self-identified applications on mount
  useEffect(() => {
    dispatch(fetchApplications({}));
  }, [dispatch]);

  const fetchSelfIdentifiedApplications = () => {
    dispatch(fetchApplications({ forceRefresh: true }));
  };

  const handleViewDetails = (record) => {
    setSelectedApplication(record);
    setDetailModalVisible(true);
  };

  const handleApprove = (record) => {
    setSelectedApplication(record);
    form.resetFields();
    form.setFieldsValue({
      internshipPhase: 'ACTIVE',
      joiningDate: dayjs(),
    });
    setApprovalModalVisible(true);
  };

  const handleReject = async (record) => {
    // Store the original application for potential rollback
    const originalApplication = { ...record };

    // Optimistically remove from list (instant UI update)
    dispatch(optimisticRejectApplication({ applicationId: record.id }));

    // Show optimistic success message
    toast.success("Internship application rejected");

    setActionLoading(true);
    try {
      // Call API in background
      await dispatch(rejectApplication({
        applicationId: record.id,
        reason: 'Application rejected by faculty'
      })).unwrap();
    } catch (error) {
      console.error("Error rejecting application:", error);

      // Rollback on error: restore the application to the list
      dispatch(rollbackApplicationUpdate({ application: originalApplication }));

      toast.error(error?.message || "Failed to reject application - reverting changes");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitApproval = async (values) => {
    // Store the original application for potential rollback
    const originalApplication = { ...selectedApplication };

    // Close modal immediately for better UX
    setApprovalModalVisible(false);
    form.resetFields();
    const appToProcess = selectedApplication;
    setSelectedApplication(null);

    setActionLoading(true);

    if (values.internshipPhase === 'ACTIVE') {
      // Optimistically remove from list (instant UI update)
      dispatch(optimisticApproveApplication({ applicationId: appToProcess.id }));

      // Show optimistic success message
      toast.success("Internship application approved successfully");

      try {
        // Call API in background
        await dispatch(approveApplication({
          applicationId: appToProcess.id,
          data: {
            reviewRemarks: `Approved. Joining date: ${values.joiningDate ? values.joiningDate.format('YYYY-MM-DD') : 'Not specified'}`,
          }
        })).unwrap();

        // If there's a joining date, also update the internship
        if (values.joiningDate) {
          try {
            await dispatch(updateInternship({
              internshipId: appToProcess.id,
              data: {
                internshipPhase: 'ACTIVE',
                joiningDate: values.joiningDate.toISOString(),
              }
            })).unwrap();
          } catch (e) {
            // Non-critical - log but don't fail
            console.warn("Could not update joining status:", e);
          }
        }
      } catch (error) {
        console.error("Error approving application:", error);

        // Rollback on error: restore the application to the list
        dispatch(rollbackApplicationUpdate({ application: originalApplication }));

        toast.error(error?.message || "Failed to approve application - reverting changes");
      } finally {
        setActionLoading(false);
      }
    } else {
      // Optimistically remove from list (instant UI update)
      dispatch(optimisticRejectApplication({ applicationId: appToProcess.id }));

      // Show optimistic success message
      toast.success("Internship application rejected");

      try {
        // Call API in background
        await dispatch(rejectApplication({
          applicationId: appToProcess.id,
          reason: 'Rejected by faculty'
        })).unwrap();
      } catch (error) {
        console.error("Error rejecting application:", error);

        // Rollback on error: restore the application to the list
        dispatch(rollbackApplicationUpdate({ application: originalApplication }));

        toast.error(error?.message || "Failed to reject application - reverting changes");
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Filter applications by status
  const getPendingApplications = () => {
    return applications.filter(
      (app) =>
        (app.internshipPhase !== "ACTIVE" && app.status !== "JOINED") ||
        app.status === "UNDER_REVIEW"
    );
  };

  const getApprovedApplications = () => {
    return applications.filter((app) => app.internshipPhase === "ACTIVE" || app.status === "JOINED");
  };

  const columns = [
    {
      title: "Student Details",
      key: "student",
      width: "20%",
      render: (_, record) => (
        <div>
          <div className="font-semibold" style={{ color: token.colorPrimary }}>{record.student?.user?.name || record.student?.name}</div>
          <div className="text-xs" style={{ color: token.colorTextSecondary }}>{record.student?.user?.rollNumber || record.student?.rollNumber}</div>
          <div className="text-xs" style={{ color: token.colorTextSecondary }}>{record.student?.user?.branchName || record.student?.branchName}</div>
        </div>
      ),
    },
    {
      title: "Company Details",
      key: "company",
      width: "20%",
      render: (_, record) => (
        <div>
          <div className="font-medium flex items-center">
            <BankOutlined className="mr-1" style={{ color: token.colorSuccess }} />
            {record.companyName || "N/A"}
          </div>
          {record.jobProfile && (
            <div className="text-xs mt-1" style={{ color: token.colorTextSecondary }}>
              Role: {record.jobProfile}
            </div>
          )}
          {record.companyAddress && (
            <div className="text-xs mt-1" style={{ color: token.colorTextTertiary }}>
              {record.companyAddress}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "HR Contact",
      key: "hr",
      width: "15%",
      render: (_, record) => (
        <div>
          <div className="text-sm font-medium">{record.hrName || "N/A"}</div>
          {record.hrContact && (
            <div className="text-xs flex items-center mt-1" style={{ color: token.colorTextSecondary }}>
              <PhoneOutlined className="mr-1" />
              {record.hrContact}
            </div>
          )}
          {record.hrEmail && (
            <div className="text-xs flex items-center mt-1" style={{ color: token.colorPrimary }}>
              <MailOutlined className="mr-1" />
              {record.hrEmail}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Duration & Stipend",
      key: "details",
      width: "15%",
      render: (_, record) => (
        <div>
          {record.internshipDuration && (
            <div className="text-sm flex items-center mb-1">
              <ClockCircleOutlined className="mr-1" style={{ color: token.colorPrimary }} />
              {record.internshipDuration}
            </div>
          )}
          {record.stipend && (
            <div className="text-sm flex items-center" style={{ color: token.colorSuccess }}>
              <DollarOutlined className="mr-1" />
              ₹{record.stipend}
            </div>
          )}
          {record.startDate && (
            <div className="text-xs mt-1" style={{ color: token.colorTextSecondary }}>
              Start: {dayjs(record.startDate).format("MMM DD, YYYY")}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Application Date",
      dataIndex: "applicationDate",
      key: "applicationDate",
      width: "12%",
      sorter: (a, b) => new Date(a.applicationDate) - new Date(b.applicationDate),
      render: (date) => dayjs(date).format("MMM DD, YYYY"),
    },
    {
      title: "Status",
      key: "status",
      width: "10%",
      render: (_, record) => (
        <div>
          {record.internshipPhase === "ACTIVE" ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Approved
            </Tag>
          ) : (
            <Tag color="orange" icon={<ClockCircleOutlined />}>
              Pending
            </Tag>
          )}
          {record.joiningLetterUrl && (
            <div className="mt-1">
              <Tag color="blue" icon={<FileTextOutlined />}>
                Letter
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: "18%",
      render: (_, record) => (
        <Space orientation="vertical" size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
            size="small"
          >
            View Details
          </Button>
          {record.internshipPhase !== "ACTIVE" && record.status !== "JOINED" ? (
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record)}
              >
                Approve
              </Button>
              <Popconfirm
                title="Reject Application"
                description="Are you sure you want to reject this application?"
                onConfirm={() => handleReject(record)}
                okText="Yes"
                cancelText="No"
              >
                <Button
                  danger
                  size="small"
                  icon={<CloseCircleOutlined />}
                  loading={actionLoading}
                >
                  Reject
                </Button>
              </Popconfirm>
            </Space>
          ) : (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Approved on {dayjs(record.joiningDate).format("MMM DD, YYYY")}
            </Tag>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: "pending",
      label: (
        <Badge count={getPendingApplications().length} offset={[10, 0]}>
          <span>
            <ClockCircleOutlined className="mr-2" />
            Pending Approval
          </span>
        </Badge>
      ),
      children: (
        <Table
          dataSource={getPendingApplications()}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 5,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} applications`,
          }}
        />
      ),
    },
    {
      key: "approved",
      label: (
        <Badge count={getApprovedApplications().length} offset={[10, 0]}>
          <span>
            <CheckCircleOutlined className="mr-2" />
            Approved
          </span>
        </Badge>
      ),
      children: (
        <Table
          dataSource={getApprovedApplications()}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 5,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} applications`,
          }}
        />
      ),
    },
    {
      key: "all",
      label: (
        <Badge count={applications.length} offset={[10, 0]}>
          <span>
            <FileTextOutlined className="mr-2" />
            All Applications
          </span>
        </Badge>
      ),
      children: (
        <Table
          dataSource={applications}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 5,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} applications`,
          }}
        />
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/app/dashboard')}
              className="rounded-lg"
            />
            <div className="w-10 h-10 flex items-center justify-center rounded-xl border shadow-sm" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder, color: token.colorPrimary }}>
              <CheckCircleOutlined className="text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <Title level={2} className="mb-0 text-2xl" style={{ color: token.colorText }}>
                  Self-Identified Internship Approvals
                </Title>
                {applicationsLastFetched && (
                  <span className="text-xs" style={{ color: token.colorTextTertiary }}>
                    Updated {new Date(applicationsLastFetched).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <Text className="text-sm" style={{ color: token.colorTextSecondary }}>
                Review and approve self-identified internship applications from students
              </Text>
            </div>
          </div>
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={fetchSelfIdentifiedApplications}
            loading={loading}
            className="rounded-lg"
          >
            Refresh
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card size="small" className="rounded-xl shadow-sm hover:shadow-md transition-all" style={{ borderColor: token.colorBorder, backgroundColor: token.colorBgContainer }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: token.colorWarningBg, color: token.colorWarning }}>
                <ClockCircleOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: token.colorText }}>
                  {getPendingApplications().length}
                </div>
                <div className="text-[10px] uppercase font-bold" style={{ color: token.colorTextTertiary }}>Pending Approval</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-xl shadow-sm hover:shadow-md transition-all" style={{ borderColor: token.colorBorder, backgroundColor: token.colorBgContainer }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: token.colorSuccessBg, color: token.colorSuccess }}>
                <CheckCircleOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: token.colorText }}>
                  {getApprovedApplications().length}
                </div>
                <div className="text-[10px] uppercase font-bold" style={{ color: token.colorTextTertiary }}>Approved</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-xl shadow-sm hover:shadow-md transition-all" style={{ borderColor: token.colorBorder, backgroundColor: token.colorBgContainer }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary }}>
                <FileTextOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: token.colorText }}>
                  {applications.length}
                </div>
                <div className="text-[10px] uppercase font-bold" style={{ color: token.colorTextTertiary }}>Total Applications</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="rounded-2xl shadow-sm overflow-hidden" style={{ borderColor: token.colorBorder, backgroundColor: token.colorBgContainer }} styles={{ body: { padding: 0 } }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
            className="px-6"
          />
        </Card>

        {/* Detail View Modal */}
        <Modal
          title={
            <div className="flex items-center gap-3 py-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border" style={{ backgroundColor: token.colorPrimaryBg, borderColor: token.colorPrimaryBorder }}>
                <FileTextOutlined style={{ color: token.colorPrimary }} />
              </div>
              <span className="font-bold text-lg" style={{ color: token.colorText }}>Internship Details</span>
            </div>
          }
          open={detailModalVisible}
          onCancel={() => {
            setDetailModalVisible(false);
            setSelectedApplication(null);
          }}
          footer={[
            <Button
              key="close"
              className="rounded-xl px-6 font-medium"
              onClick={() => {
                setDetailModalVisible(false);
                setSelectedApplication(null);
              }}
            >
              Close
            </Button>,
            selectedApplication && selectedApplication.internshipPhase !== "ACTIVE" && (
              <Button
                key="approve"
                type="primary"
                icon={<CheckCircleOutlined />}
                className="rounded-xl px-6 font-bold"
                style={{ backgroundColor: token.colorPrimary, borderColor: token.colorPrimary }}
                onClick={() => {
                  setDetailModalVisible(false);
                  handleApprove(selectedApplication);
                }}
              >
                Approve Application
              </Button>
            ),
          ]}
          width={800}
          className="rounded-2xl overflow-hidden"
          styles={{ mask: { backdropFilter: 'blur(4px)' } }}
        >
          {selectedApplication && (
            <div className="py-2 space-y-4">
              {/* Student Information */}
              <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: token.colorBorder, backgroundColor: `${token.colorTextTertiary}1A` }}>
                  <Text className="text-xs uppercase font-bold flex items-center gap-2" style={{ color: token.colorTextTertiary }}>
                    <UserOutlined style={{ color: token.colorPrimary }} /> Student Information
                  </Text>
                </div>
                <div className="p-4">
                  <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                    <Descriptions.Item label={<Text className="font-medium" style={{ color: token.colorTextTertiary }}>Name</Text>}>
                      <Text className="font-semibold" style={{ color: token.colorText }}>{selectedApplication.student?.user?.name || selectedApplication.student?.name}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={<Text className="font-medium" style={{ color: token.colorTextTertiary }}>Roll Number</Text>}>
                      <Text style={{ color: token.colorText }}>{selectedApplication.student?.user?.rollNumber || selectedApplication.student?.rollNumber}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={<Text className="font-medium" style={{ color: token.colorTextTertiary }}>Branch</Text>}>
                      <Text style={{ color: token.colorText }}>{selectedApplication.student?.user?.branchName || selectedApplication.student?.branchName}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={<Text className="font-medium" style={{ color: token.colorTextTertiary }}>Email</Text>}>
                      <Text style={{ color: token.colorText }}>{selectedApplication.student?.user?.email || selectedApplication.student?.email}</Text>
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              </div>

              {/* Company & Internship Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: token.colorBorder, backgroundColor: `${token.colorTextTertiary}1A` }}>
                    <Text className="text-xs uppercase font-bold flex items-center gap-2" style={{ color: token.colorTextTertiary }}>
                      <BankOutlined style={{ color: token.colorSuccess }} /> Company Information
                    </Text>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <Text className="text-[10px] uppercase font-bold block leading-none mb-1" style={{ color: token.colorTextTertiary }}>Company Name</Text>
                      <Text className="font-medium" style={{ color: token.colorText }}>{selectedApplication.companyName || "N/A"}</Text>
                    </div>
                    <div>
                      <Text className="text-[10px] uppercase font-bold block leading-none mb-1" style={{ color: token.colorTextTertiary }}>Role</Text>
                      <Text className="font-medium" style={{ color: token.colorText }}>{selectedApplication.jobProfile || "N/A"}</Text>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: token.colorBorder, backgroundColor: `${token.colorTextTertiary}1A` }}>
                    <Text className="text-xs uppercase font-bold flex items-center gap-2" style={{ color: token.colorTextTertiary }}>
                      <CalendarOutlined style={{ color: token.colorWarning }} /> Internship Period
                    </Text>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between">
                      <div>
                        <Text className="text-[10px] uppercase font-bold block leading-none mb-1" style={{ color: token.colorTextTertiary }}>Duration</Text>
                        <Text className="font-medium" style={{ color: token.colorText }}>{selectedApplication.internshipDuration || "N/A"}</Text>
                      </div>
                      <div className="text-right">
                        <Text className="text-[10px] uppercase font-bold block leading-none mb-1" style={{ color: token.colorTextTertiary }}>Stipend</Text>
                        <Text className="font-bold" style={{ color: token.colorSuccess }}>{selectedApplication.stipend ? `₹${selectedApplication.stipend}` : "N/A"}</Text>
                      </div>
                    </div>
                    <div>
                      <Text className="text-[10px] uppercase font-bold block leading-none mb-1" style={{ color: token.colorTextTertiary }}>Dates</Text>
                      <Text className="font-medium" style={{ color: token.colorText }}>
                        {selectedApplication.startDate ? dayjs(selectedApplication.startDate).format("MMM DD") : "?"} - {selectedApplication.endDate ? dayjs(selectedApplication.endDate).format("MMM DD, YYYY") : "?"}
                      </Text>
                    </div>
                  </div>
                </div>
              </div>

              {/* Joining Letter */}
              {selectedApplication.joiningLetterUrl && (
                <div className="rounded-xl border p-4 flex items-center justify-between" style={{ backgroundColor: token.colorPrimaryBg, borderColor: token.colorPrimaryBorder }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: token.colorBgContainer }}>
                      <FileTextOutlined className="text-xl" style={{ color: token.colorPrimary }} />
                    </div>
                    <div>
                      <Text className="font-bold block leading-none mb-1" style={{ color: token.colorText }}>Joining Letter</Text>
                      <Text className="text-xs" style={{ color: token.colorTextTertiary }}>Uploaded on {dayjs(selectedApplication.joiningLetterUploadedAt).format("MMM DD, YYYY")}</Text>
                    </div>
                  </div>
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    className="rounded-lg font-bold"
                    href={selectedApplication.joiningLetterUrl}
                    target="_blank"
                  >
                    View
                  </Button>
                </div>
              )}

              {/* Additional Information */}
              {(selectedApplication.coverLetter || selectedApplication.additionalInfo) && (
                <div className="p-5 rounded-2xl border" style={{ backgroundColor: `${token.colorTextTertiary}1A`, borderColor: `${token.colorBorder}99` }}>
                  <Title level={5} className="!mb-3 text-xs uppercase tracking-widest font-bold" style={{ color: token.colorTextTertiary }}>Additional Information</Title>
                  <div className="space-y-4">
                    {selectedApplication.coverLetter && (
                      <div>
                        <Text className="text-[10px] uppercase font-bold block mb-1" style={{ color: token.colorTextTertiary }}>Cover Letter</Text>
                        <Paragraph className="text-sm mb-0 italic" style={{ color: token.colorText }}>{selectedApplication.coverLetter}</Paragraph>
                      </div>
                    )}
                    {selectedApplication.additionalInfo && (
                      <div>
                        <Text className="text-[10px] uppercase font-bold block mb-1" style={{ color: token.colorTextTertiary }}>Other Info</Text>
                        <Paragraph className="text-sm mb-0" style={{ color: token.colorText }}>{selectedApplication.additionalInfo}</Paragraph>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Approval Modal */}
        <Modal
          title={
            <div className="flex items-center gap-3 py-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border" style={{ backgroundColor: token.colorSuccessBg, borderColor: token.colorSuccessBorder }}>
                <CheckCircleOutlined style={{ color: token.colorSuccess }} />
              </div>
              <span className="font-bold text-lg" style={{ color: token.colorText }}>Approval Confirmation</span>
            </div>
          }
          open={approvalModalVisible}
          onCancel={() => {
            setApprovalModalVisible(false);
            setSelectedApplication(null);
            form.resetFields();
          }}
          onOk={() => form.submit()}
          okText="Confirm Approval"
          okButtonProps={{ loading: actionLoading, className: "rounded-xl font-bold border-0 px-6 h-10", style: { backgroundColor: token.colorSuccess } }}
          cancelButtonProps={{ className: "rounded-xl" }}
          width={500}
          className="rounded-2xl overflow-hidden"
        >
          {selectedApplication && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border mt-2" style={{ backgroundColor: token.colorInfoBg, borderColor: token.colorInfoBorder }}>
                <Text className="text-sm" style={{ color: token.colorTextSecondary }}>You are approving the internship for:</Text>
                <div className="mt-2">
                  <Text strong className="block" style={{ color: token.colorText }}>{selectedApplication.student?.user?.name || selectedApplication.student?.name}</Text>
                  <Text className="text-xs" style={{ color: token.colorTextTertiary }}>{selectedApplication.companyName}</Text>
                </div>
              </div>

              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmitApproval}
                initialValues={{
                  internshipPhase: 'ACTIVE',
                  joiningDate: dayjs(),
                }}
                className="mt-4"
              >
                <Form.Item
                  name="internshipPhase"
                  label={<span className="font-medium" style={{ color: token.colorText }}>Final Status</span>}
                  rules={[{ required: true }]}
                >
                  <Select className="rounded-lg h-10">
                    <Option value="ACTIVE">Approve - Student joined</Option>
                    <Option value="NOT_STARTED">Reject - Do not approve</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.internshipPhase !== currentValues.internshipPhase
                  }
                >
                  {({ getFieldValue }) =>
                    getFieldValue("internshipPhase") === "ACTIVE" ? (
                      <Form.Item
                        name="joiningDate"
                        label={<span className="font-medium" style={{ color: token.colorText }}>Joining Date</span>}
                        rules={[
                          { required: true, message: "Please select joining date" },
                        ]}
                      >
                        <DatePicker
                          className="w-full rounded-lg h-10"
                          format="MMMM DD, YYYY"
                          placeholder="Select joining date"
                        />
                      </Form.Item>
                    ) : null
                  }
                </Form.Item>
              </Form>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default SelfIdentifiedApproval;