// src/pages/industry/MonthlyFeedbackPage.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  message,
  Popconfirm,
  Space,
  Tag,
  Row,
  Col,
  Descriptions,
  Rate,
  Typography,
  Divider,
  Modal,
  theme,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  EyeOutlined,
  StarOutlined,
} from "@ant-design/icons";
import API from "../../../services/api";
import dayjs from "dayjs";
import Layouts from "../../../components/Layout";
import { useLocation } from "react-router-dom";
import { toast } from "react-hot-toast";
import MonthlyFeedbackModal from "../../../components/MonthlyFeedbackModal";
import { useSmartIndustry } from "../../../hooks";
// Import the extracted modal


const { Title, Text, Paragraph } = Typography;

export default function MonthlyFeedbackPage() {
  const { token } = theme.useToken();
  
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [editingFeedback, setEditingFeedback] = useState(null);
  
  // For URL parameters
  const [preSelectedApplicationId, setPreSelectedApplicationId] = useState(null);
  const [preSelectedStudentName, setPreSelectedStudentName] = useState(null);

  const location = useLocation();

  // Get industryId from useSmartIndustry hook
  const { data: industryProfile } = useSmartIndustry();
  const industryId = industryProfile?.id;

  useEffect(() => {
    if (industryId) {
      fetchFeedbacks();
    }
  }, [industryId]);

  // Enhanced auto-select with debugging
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const applicationId = searchParams.get("applicationId");
    const feedbackId = searchParams.get("feedbackId");
    const studentName = searchParams.get("studentName");
    const mode = searchParams.get("mode");

    if (applicationId) {
      if (mode === "edit" && feedbackId) {
        const existingFeedback = feedbacks.find((f) => f.id === feedbackId);
        if (existingFeedback) {
          setEditingFeedback(existingFeedback);
          setPreSelectedApplicationId(applicationId);
          setPreSelectedStudentName(studentName);
          setModalVisible(true);
          toast.info(`Editing monthly feedback for ${studentName}`);
        } else {
          // If feedback not found, create new
          setEditingFeedback(null);
          setPreSelectedApplicationId(applicationId);
          setPreSelectedStudentName(studentName);
          setModalVisible(true);
          toast.info(`Creating monthly feedback for ${studentName}`);
        }
      } else {
        // Create mode (default)
        setEditingFeedback(null);
        setPreSelectedApplicationId(applicationId);
        setPreSelectedStudentName(studentName);
        setModalVisible(true);
        toast.info(`Creating monthly feedback for ${studentName}`);
      }
    }
  }, [feedbacks, location.search]);

  const fetchFeedbacks = async (params = {}) => {
    if (!industryId) {
      toast.error("Industry ID not found");
      return;
    }

    setLoading(true);
    try {
      const res = await API.get(`/monthly-feedback/industry/${industryId}`, { params });
      setFeedbacks(res.data);
    } catch (e) {
      toast.error("Failed to fetch feedbacks");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingFeedback(record);
    setPreSelectedApplicationId(null);
    setPreSelectedStudentName(null);
    setModalVisible(true);
  };

  const handleDelete = async (id, industryId) => {
    if (!industryId) {
      toast.error("Industry ID is required for deletion");
      return;
    }
    try {
      await API.delete(`/monthly-feedback/${id}/${industryId}`);
      toast.success("Feedback deleted successfully");
      fetchFeedbacks();
    } catch (e) {
      console.error("Delete error:", e);
      toast.error("Failed to delete feedback");
    }
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditingFeedback(null);
    setPreSelectedApplicationId(null);
    setPreSelectedStudentName(null);
    fetchFeedbacks();
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingFeedback(null);
    setPreSelectedApplicationId(null);
    setPreSelectedStudentName(null);
  };

  const handleViewDetails = (record) => {
    setSelectedFeedback(record);
    setViewModalVisible(true);
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return token.colorSuccess;
    if (rating >= 3) return token.colorWarning;
    return token.colorError;
  };

  const getRatingText = (rating) => {
    if (rating === 5) return "Excellent";
    if (rating === 4) return "Good";
    if (rating === 3) return "Average";
    if (rating === 2) return "Poor";
    if (rating === 1) return "Very Poor";
    return "Not Rated";
  };

  const columns = [
    {
      title: "Month",
      dataIndex: "feedbackMonth",
      key: "month",
      render: (value) => dayjs(value).format("MMMM YYYY"),
      sorter: (a, b) =>
        dayjs(a.feedbackMonth).unix() - dayjs(b.feedbackMonth).unix(),
    },
    {
      title: "Student",
      key: "student",
      render: (_, record) => (
        <div className="flex items-center">
          <UserOutlined className="mr-2 text-blue-500" />
          <div>
            <div className="font-medium">
              {record.application?.student?.user?.name || record.application?.student?.name}
            </div>
            <div className="text-xs text-gray-500">
              {record.application?.student?.user?.rollNumber || record.application?.student?.rollNumber}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Internship",
      dataIndex: ["application", "internship", "title"],
      key: "internship",
      render: (title) => (
        <span className="text-blue-600 font-medium">{title}</span>
      ),
    },
    {
      title: "Company",
      dataIndex: ["industry", "companyName"],
      key: "company",
    },
    {
      title: "Overall Rating",
      dataIndex: "overallRating",
      key: "rating",
      render: (rating) => {
        const color = rating >= 4 ? "green" : rating >= 3 ? "orange" : "red";
        return <Tag color={color}>{rating}/5</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
            className="text-green-600"
            title="View Details"
          />
          {/* <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="text-blue-600"
            title="Edit"
          /> */}
          <Popconfirm
            title="Delete Feedback"
            description="Are you sure you want to delete this feedback?"
            onConfirm={() => {
              const industryId = record.industry?.id || record.industryId;
              handleDelete(record.id, industryId);
            }}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} danger title="Delete" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <Card
        title={
          <div className="flex items-center">
            <UserOutlined className="mr-2 text-blue-600" />
            Monthly Feedback Management
          </div>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingFeedback(null);
              setPreSelectedApplicationId(null);
              setPreSelectedStudentName(null);
              setModalVisible(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Add Feedback
          </Button>
        }
        className=""
      >
        <Table
          dataSource={feedbacks}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: "max-content" }}
          pagination={{
            pageSize: 5,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} feedbacks`,
          }}
          className="rounded-lg"
        />
      </Card>

      {/* Monthly Feedback Modal */}
      <MonthlyFeedbackModal
        visible={modalVisible}
        onCancel={handleModalCancel}
        onSuccess={handleModalSuccess}
        preSelectedApplicationId={preSelectedApplicationId}
        preSelectedStudentName={preSelectedStudentName}
        editingFeedback={editingFeedback}
      />

      {/* View Details Modal - keeping the existing one */}
      <Modal
        title={
          <div className="flex items-center">
            <EyeOutlined className="mr-2 text-green-600" />
            Monthly Feedback Details
          </div>
        }
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={900}
      >
        {selectedFeedback && (
          <div className="space-y-6">
            {/* Header Information */}
            <div className=" p-6 rounded-lg">
              <Row gutter={[24, 16]}>
                <Col xs={24} md={12}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Student">
                      <div className="flex items-center">
                        <UserOutlined className="mr-2 text-blue-500" />
                        <div>
                          <Text strong>
                            {selectedFeedback.application?.student?.user?.name || selectedFeedback.application?.student?.name}
                          </Text>
                          <br />
                          <Text type="secondary" className="text-xs">
                            {selectedFeedback.application?.student?.user?.rollNumber || selectedFeedback.application?.student?.rollNumber}
                          </Text>
                        </div>
                      </div>
                    </Descriptions.Item>
                    <Descriptions.Item label="Internship">
                      <Text className="text-blue-600 font-medium">
                        {selectedFeedback.application?.internship?.title}
                      </Text>
                    </Descriptions.Item>
                  </Descriptions>
                </Col>
                <Col xs={24} md={12}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Feedback Month">
                      <Text strong>
                        {dayjs(selectedFeedback.feedbackMonth).format(
                          "MMMM YYYY"
                        )}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Company">
                      <Text>{selectedFeedback.industry?.companyName}</Text>
                    </Descriptions.Item>
                  </Descriptions>
                </Col>
              </Row>
            </div>

            {/* Ratings Section */}
            <Card title="📊 Performance Ratings" size="small" className="!mb-3">
              <Row gutter={[24, 16]}>
                <Col xs={12} md={6}>
                  <div className="text-center">
                    <Text className="block text-gray-600 mb-2">Attendance</Text>
                    <Rate
                      disabled
                      value={selectedFeedback.attendanceRating || 0}
                      style={{
                        color: getRatingColor(
                          selectedFeedback.attendanceRating
                        ),
                      }}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {getRatingText(selectedFeedback.attendanceRating)}
                    </div>
                  </div>
                </Col>
                <Col xs={12} md={6}>
                  <div className="text-center">
                    <Text className="block text-gray-600 mb-2">
                      Performance
                    </Text>
                    <Rate
                      disabled
                      value={selectedFeedback.performanceRating || 0}
                      style={{
                        color: getRatingColor(
                          selectedFeedback.performanceRating
                        ),
                      }}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {getRatingText(selectedFeedback.performanceRating)}
                    </div>
                  </div>
                </Col>
                <Col xs={12} md={6}>
                  <div className="text-center">
                    <Text className="block text-gray-600 mb-2">
                      Punctuality
                    </Text>
                    <Rate
                      disabled
                      value={selectedFeedback.punctualityRating || 0}
                      style={{
                        color: getRatingColor(
                          selectedFeedback.punctualityRating
                        ),
                      }}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {getRatingText(selectedFeedback.punctualityRating)}
                    </div>
                  </div>
                </Col>
                <Col xs={12} md={6}>
                  <div className="text-center">
                    <Text className="block text-gray-600 mb-2">
                      Technical Skills
                    </Text>
                    <Rate
                      disabled
                      value={selectedFeedback.technicalSkillsRating || 0}
                      style={{
                        color: getRatingColor(
                          selectedFeedback.technicalSkillsRating
                        ),
                      }}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {getRatingText(selectedFeedback.technicalSkillsRating)}
                    </div>
                  </div>
                </Col>
              </Row>

              <Divider />

              <div className="text-center">
                <Text className="block text-gray-600 mb-2 text-lg font-medium">
                  Overall Rating
                </Text>
                <Rate
                  disabled
                  value={selectedFeedback.overallRating || 0}
                  style={{
                    fontSize: 24,
                    color: getRatingColor(selectedFeedback.overallRating),
                  }}
                />
                <div className="text-sm text-gray-600 mt-2">
                  <Tag
                    color={
                      selectedFeedback.overallRating >= 4
                        ? "green"
                        : selectedFeedback.overallRating >= 3
                        ? "orange"
                        : "red"
                    }
                  >
                    {selectedFeedback.overallRating}/5 -{" "}
                    {getRatingText(selectedFeedback.overallRating)}
                  </Tag>
                </div>
              </div>
            </Card>

            {/* Detailed Feedback */}
            <Card title="📝 Detailed Feedback" size="small" className="!mb-3">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <div className="mb-4">
                    <Text strong className="text-green-600">
                      Key Strengths:
                    </Text>
                    <Paragraph className="mt-2 bg-green-50 p-3 rounded !text-black">
                      {selectedFeedback.strengths || "No strengths mentioned"}
                    </Paragraph>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div className="mb-4">
                    <Text strong className="text-orange-600">
                      Areas for Improvement:
                    </Text>
                    <Paragraph className="mt-2 bg-orange-50 p-3 rounded !text-black">
                      {selectedFeedback.areasForImprovement ||
                        "No improvement areas mentioned"}
                    </Paragraph>
                  </div>
                </Col>
              </Row>
              <div>
                <Text strong className="text-blue-600">
                  Overall Comments:
                </Text>
                <Paragraph className="mt-2 bg-blue-50 p-3 rounded !text-black">
                  {selectedFeedback.overallComments ||
                    "No overall comments provided"}
                </Paragraph>
              </div>
            </Card>

            {/* Tasks Section */}
            <Card title="📋 Task Management" size="small" className="!mb-3">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <div>
                    <Text strong className="text-purple-600">
                      Tasks Assigned:
                    </Text>
                    <Paragraph className="mt-2 bg-purple-50 p-3 rounded !text-black">
                      {selectedFeedback.tasksAssigned ||
                        "No tasks assigned mentioned"}
                    </Paragraph>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div>
                    <Text strong className="text-green-600">
                      Tasks Completed:
                    </Text>
                    <Paragraph className="mt-2 bg-green-50 p-3 rounded !text-black">
                      {selectedFeedback.tasksCompleted ||
                        "No completed tasks mentioned"}
                    </Paragraph>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Submission Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <Text type="secondary" className="text-xs">
                Submitted on:{" "}
                {dayjs(selectedFeedback.submittedAt).format(
                  "MMMM DD, YYYY [at] HH:mm A"
                )}
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}