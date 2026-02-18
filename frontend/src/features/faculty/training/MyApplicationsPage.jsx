import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  EyeOutlined,
  DeleteOutlined,
  SearchOutlined,
  CalendarOutlined,
  CommentOutlined,
  BookOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ApplicationStatusBadge from "../../../components/training/ApplicationStatusBadge";
import TrainingDateRange from "../../../components/training/TrainingDateRange";
import TrainingEmptyState from "../../../components/training/TrainingEmptyState";
import FeedbackFormModal from "../../../components/training/FeedbackFormModal";
import LessonPlanModal from "../../../components/training/LessonPlanModal";
import { TableRowSkeleton } from "../../../components/training/skeletons/TrainingSkeletons";
import {
  fetchMyApplications,
  withdrawApplication,
  fetchFeedbackForm,
  submitFeedback,
  createLessonPlan,
  markSelfAttendance,
} from "../store/facultyTrainingSlice";

const { Text, Title } = Typography;

const MyApplicationsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { applications } = useSelector((state) => state.facultyTraining);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    training: null,
  });
  const [lessonPlanModal, setLessonPlanModal] = useState({
    open: false,
    training: null,
  });
  const [attendanceModal, setAttendanceModal] = useState({
    open: false,
    application: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [locationState, setLocationState] = useState({
    loading: false,
    error: null,
    data: null,
  });

  const { feedback } = useSelector((state) => state.facultyTraining);

  useEffect(() => {
    dispatch(fetchMyApplications());
  }, [dispatch]);

  const handleWithdraw = async (id) => {
    try {
      await dispatch(withdrawApplication(id)).unwrap();
      message.success("Application withdrawn successfully");
    } catch (error) {
      message.error(error || "Failed to withdraw application");
    }
  };

  const handleView = (trainingId) => {
    if (trainingId) {
      navigate(`/app/training/${trainingId}`);
    }
  };

  const handleOpenFeedback = async (application) => {
    const trainingId = application.trainingId || application.training?.id;
    if (!trainingId) return;

    // Fetch feedback form
    await dispatch(fetchFeedbackForm(trainingId));
    setFeedbackModal({
      open: true,
      training: application.training || {
        id: trainingId,
        title: application.trainingTitle,
      },
    });
  };

  const handleSubmitFeedback = async (payload) => {
    try {
      setSubmitting(true);
      await dispatch(
        submitFeedback({
          trainingId: payload.trainingId,
          data: payload,
        }),
      ).unwrap();
      message.success("Feedback submitted successfully!");
      setFeedbackModal({ open: false, training: null });
      dispatch(fetchMyApplications()); // Refresh
    } catch (error) {
      message.error(error || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenLessonPlan = (application) => {
    setLessonPlanModal({
      open: true,
      training: application.training || {
        id: application.trainingId,
        title: application.trainingTitle,
      },
    });
  };

  const handleSubmitLessonPlan = async (payload) => {
    try {
      setSubmitting(true);
      await dispatch(createLessonPlan(payload)).unwrap();
      message.success("Lesson plan submitted successfully!");
      setLessonPlanModal({ open: false, training: null });
      dispatch(fetchMyApplications()); // Refresh
    } catch (error) {
      message.error(error || "Failed to submit lesson plan");
    } finally {
      setSubmitting(false);
    }
  };

  // Attendance handlers
  const captureLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationState({
        loading: false,
        error: "Geolocation is not supported by your browser",
        data: null,
      });
      return;
    }

    setLocationState({ loading: true, error: null, data: null });

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
      let locationAddress = "";

      // Try reverse geocoding
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          {
            headers: {
              "User-Agent": "PlaceIntern Training App",
            },
          }
        );
        const data = await response.json();
        if (data.display_name) {
          locationAddress = data.display_name;
        }
      } catch {
        // Ignore geocoding errors
      }

      setLocationState({
        loading: false,
        error: null,
        data: { latitude, longitude, locationAddress },
      });
    } catch (error) {
      let errorMessage = "Failed to get your location";
      if (error.code === 1) {
        errorMessage = "Location access denied. Please enable location permissions.";
      } else if (error.code === 2) {
        errorMessage = "Unable to determine your location. Please try again.";
      } else if (error.code === 3) {
        errorMessage = "Location request timed out. Please try again.";
      }
      setLocationState({
        loading: false,
        error: errorMessage,
        data: null,
      });
    }
  }, []);

  const handleOpenAttendance = useCallback(
    (application) => {
      setAttendanceModal({
        open: true,
        application,
      });
      setLocationState({ loading: false, error: null, data: null });
      // Auto-capture location when modal opens
      setTimeout(() => captureLocation(), 100);
    },
    [captureLocation]
  );

  const handleCloseAttendance = () => {
    setAttendanceModal({ open: false, application: null });
    setLocationState({ loading: false, error: null, data: null });
  };

  const handleMarkAttendance = async () => {
    if (!attendanceModal.application || !locationState.data) {
      message.error("Please capture your location first");
      return;
    }

    try {
      setSubmitting(true);
      const trainingId =
        attendanceModal.application.trainingId ||
        attendanceModal.application.training?.id;

      await dispatch(
        markSelfAttendance({
          trainingId,
          latitude: locationState.data.latitude,
          longitude: locationState.data.longitude,
          locationAddress: locationState.data.locationAddress,
        })
      ).unwrap();

      message.success("Attendance marked successfully!");
      handleCloseAttendance();
      dispatch(fetchMyApplications({ forceRefresh: true }));
    } catch (error) {
      message.error(error || "Failed to mark attendance");
    } finally {
      setSubmitting(false);
    }
  };

  // Check if training is ongoing (today is between start and end date)
  const isTrainingOngoing = (training) => {
    if (!training?.startDate || !training?.endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(training.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(training.endDate);
    endDate.setHours(23, 59, 59, 999);
    return today >= startDate && today <= endDate;
  };

  const filteredApplications = useMemo(() => {
    let result = applications.list || [];
    if (statusFilter !== "ALL") {
      if (statusFilter === "PENDING") {
        result = result.filter((item) =>
          ["PENDING", "SUBMITTED"].includes(item.status),
        );
      } else {
        result = result.filter((item) => item.status === statusFilter);
      }
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter((item) =>
        (item.training?.title || item.trainingTitle || "")
          .toLowerCase()
          .includes(search),
      );
    }
    return result;
  }, [applications.list, searchText, statusFilter]);

  const columns = [
    {
      title: "Training",
      dataIndex: ["training", "title"],
      key: "training",
      render: (_, record) => (
        <div>
          <div className="font-medium text-sm text-slate-800">
            {record.training?.title || record.trainingTitle || "Training"}
          </div>
          {record.training?.startDate && (
            <div className="text-xs text-slate-500 mt-0.5">
              <TrainingDateRange
                startDate={record.training.startDate}
                endDate={record.training.endDate}
                compact
                showIcon={false}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status) => (
        <div className="flex justify-center">
          <ApplicationStatusBadge status={status} />
        </div>
      ),
    },
    {
      title: "Applied On",
      dataIndex: "appliedAt",
      key: "appliedAt",
      width: 120,
      sorter: (a, b) => new Date(a.appliedAt || a.createdAt) - new Date(b.appliedAt || b.createdAt),
      render: (_, record) => {
        const value = record.appliedAt || record.createdAt;
        return (
          <Text className="text-xs">
            {value
              ? new Date(value).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "-"}
          </Text>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_, record) => (
        <Space size="small" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="View Training">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleView(record.trainingId || record.training?.id);
              }}
              aria-label="View training details"
            />
          </Tooltip>
          {record.status === "APPROVED" &&
            isTrainingOngoing(record.training) &&
            (record.hasMarkedAttendanceToday === true ? (
              <Tooltip title="Attendance marked for today">
                <CheckCircleOutlined className="text-green-500 mx-2" />
              </Tooltip>
            ) : (
              <Tooltip title="Mark Attendance">
                <Button
                  type="text"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAttendance(record);
                  }}
                  aria-label="Mark attendance"
                  className="text-green-600 hover:text-green-700"
                />
              </Tooltip>
            ))}
          {record.status === "APPROVED" &&
            record.training?.endDate &&
            new Date(record.training.endDate) < new Date() && (
              <>
                <Tooltip title="Submit Feedback">
                  <Button
                    type="text"
                    size="small"
                    icon={<CommentOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFeedback(record);
                    }}
                    aria-label="Submit feedback"
                    className="text-blue-600 hover:text-blue-700"
                  />
                </Tooltip>
                <Tooltip title="Submit Lesson Plan">
                  <Button
                    type="text"
                    size="small"
                    icon={<BookOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenLessonPlan(record);
                    }}
                    aria-label="Submit lesson plan"
                    className="text-green-600 hover:text-green-700"
                  />
                </Tooltip>
              </>
            )}
          {["PENDING", "SUBMITTED"].includes(record.status) && (
            <Popconfirm
              title="Withdraw application?"
              description="Are you sure you want to withdraw this application?"
              onConfirm={() => handleWithdraw(record.id)}
              okText="Yes, Withdraw"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Withdraw">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Withdraw application"
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const isLoading = applications.loading && !applications.list;

  return (
    <div className="p-4 training-ui">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Title level={4} className="mb-0! text-lg">
            My Applications
          </Title>
        </div>
        <Button
          type="primary"
          size="middle"
          icon={<CalendarOutlined />}
          onClick={() => navigate("/app/training/calendar")}
        >
          Browse Trainings
        </Button>
      </div>

      {/* Filters Section */}
      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
        <div className="mb-3">
          <Input
            placeholder="Search by training name..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full"
            size="middle"
            allowClear
            aria-label="Search applications"
          />
        </div>

        {/* Results info */}
        {filteredApplications.length > 0 && (
          <div className="mb-2 pb-2 border-b border-slate-200">
            <Text className="text-[10px] text-slate-600">
              Showing <Text strong>{filteredApplications.length}</Text> of{" "}
              <Text strong>{applications.list?.length || 0}</Text> applications
            </Text>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <TableRowSkeleton rows={5} columns={4} />
        ) : filteredApplications.length === 0 ? (
          <TrainingEmptyState
            type={
              searchText || statusFilter !== "ALL" ? "search" : "applications"
            }
            message={
              searchText || statusFilter !== "ALL"
                ? "No matching applications"
                : "No applications yet"
            }
            description={
              searchText || statusFilter !== "ALL"
                ? "Try adjusting your search or filter criteria."
                : "You haven't applied to any training sessions yet."
            }
            actionText={
              statusFilter !== "ALL" || searchText
                ? "Clear Filters"
                : "Browse Trainings"
            }
            onAction={
              statusFilter !== "ALL" || searchText
                ? () => {
                    setStatusFilter("ALL");
                    setSearchText("");
                  }
                : () => navigate("/app/training/calendar")
            }
          />
        ) : (
          <div className="custom-scrollbar overflow-x-auto">
            <Table
              className="custom-table"
              rowKey="id"
              columns={columns}
              dataSource={filteredApplications}
              loading={applications.loading}
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
              onRow={(record) => ({
                className: "cursor-pointer hover:bg-slate-50",
                onClick: () =>
                  handleView(record.trainingId || record.training?.id),
              })}
            />
          </div>
        )}
      </Card>

      {/* Feedback Modal */}
      <FeedbackFormModal
        open={feedbackModal.open}
        onCancel={() => setFeedbackModal({ open: false, training: null })}
        onSubmit={handleSubmitFeedback}
        loading={submitting}
        training={feedbackModal.training}
        feedbackForm={feedback?.form}
      />

      {/* Lesson Plan Modal */}
      <LessonPlanModal
        open={lessonPlanModal.open}
        onCancel={() => setLessonPlanModal({ open: false, training: null })}
        onSubmit={handleSubmitLessonPlan}
        loading={submitting}
        training={lessonPlanModal.training}
      />

      {/* Mark Attendance Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <CheckCircleOutlined className="text-green-500" />
            <span>Mark Attendance</span>
          </div>
        }
        open={attendanceModal.open}
        onCancel={handleCloseAttendance}
        footer={[
          <Button key="cancel" onClick={handleCloseAttendance}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handleMarkAttendance}
            loading={submitting}
            icon={<CheckCircleOutlined />}
          >
            Mark Attendance
          </Button>,
        ]}
        destroyOnClose
      >
        <div className="space-y-4">
          {/* Training Info */}
          <div className="bg-slate-50 rounded-lg p-3">
            <Text className="text-xs text-slate-500">Training</Text>
            <div className="font-medium text-sm text-slate-800 mt-0.5">
              {attendanceModal.application?.training?.title ||
                attendanceModal.application?.trainingTitle ||
                "Training"}
            </div>
            {attendanceModal.application?.training?.startDate && (
              <div className="text-xs text-slate-500 mt-1">
                <TrainingDateRange
                  startDate={attendanceModal.application.training.startDate}
                  endDate={attendanceModal.application.training.endDate}
                  compact
                  showIcon={false}
                />
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500">
            Click mark attendance to submit your attendance for today.
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyApplicationsPage;
