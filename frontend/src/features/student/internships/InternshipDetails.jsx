// src/pages/internships/InternshipDetails.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Button,
  Tag,
  Typography,
  Space,
  Avatar,
  Descriptions,
  Divider,
  Modal,
  Form,
  Input,
  Spin,
  Progress,
  Alert,
  Upload,
} from "antd";
import { toast } from 'react-hot-toast';
import {
  BankOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  CalendarOutlined,
  TeamOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  UploadOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { theme } from "antd";
import { selectApplicationsList } from "../store/studentSelectors";
import { fetchInternshipDetails, applyForInternship, fetchApplications } from "../store/studentSlice";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { useToken } = theme;

const InternshipDetails = () => {
  const { token } = useToken();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [internship, setInternship] = useState(null);
  const [applicationModal, setApplicationModal] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeList, setResumeList] = useState([]);
  const [form] = Form.useForm();
  const { id } = useParams();
  const navigate = useNavigate();

  // Get applications from Redux store
  const applicationsFromStore = useSelector(selectApplicationsList);

  // Use useMemo to derive hasApplied and applicationData from Redux store
  const { hasApplied, applicationData } = useMemo(() => {
    if (!applicationsFromStore || applicationsFromStore.length === 0) {
      return { hasApplied: false, applicationData: null };
    }

    const existingApplication = applicationsFromStore.find(
      (app) => app.internshipId === id
    );

    return {
      hasApplied: !!existingApplication,
      applicationData: existingApplication || null,
    };
  }, [applicationsFromStore, id]);

  // Get user profile
  const getUserProfile = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload;
    } catch {
      return null;
    }
  };

  const userProfile = getUserProfile();

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Only fetch internship details - application status comes from Redux store
      const internshipData = await dispatch(fetchInternshipDetails(id)).unwrap();

      if (internshipData) {
        setInternship(internshipData);
      }
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || "Failed to load internship details";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (values) => {
    setApplying(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('internshipId', id);
      formData.append('coverLetter', values.coverLetter);

      if (values.additionalInfo) {
        formData.append('additionalInfo', values.additionalInfo);
      }

      // Append resume file if uploaded
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      await dispatch(applyForInternship({ internshipId: id, applicationData: formData })).unwrap();

      toast.success("Application submitted successfully!");
      setApplicationModal(false);
      form.resetFields();
      setResumeFile(null);
      setResumeList([]);

      // Refresh applications list in Redux store
      dispatch(fetchApplications({ forceRefresh: true }));

      // Show confirmation modal
      Modal.success({
        title: "Application Submitted!",
        content: (
          <div>
            <p>
              Your application has been successfully submitted to{" "}
              <strong>{internship.industry?.companyName}</strong>.
            </p>
            <p>
              You can track the status of your application in the "My
              Applications" section.
            </p>
          </div>
        ),
        onOk: () => navigate("/app/my-applications"),
        okText: "View My Applications",
      });
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || "Error submitting application";
      toast.error(errorMessage);
    } finally {
      setApplying(false);
    }
  };

  const getDaysLeft = (deadline) => {
    const daysLeft = Math.ceil(
      (new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24)
    );
    return daysLeft > 0 ? daysLeft : 0;
  };

  // Handle resume file upload
  const handleResumeChange = (info) => {
    const file = info.file;
    
    // Validate file type
    const isValidType = 
      file.type === 'application/pdf' || 
      file.type === 'application/msword' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    if (!isValidType) {
      toast.error('You can only upload PDF or DOC/DOCX files!');
      return;
    }
    
    // Validate file size (5MB)
    const isValidSize = file.size / 1024 / 1024 < 5;
    if (!isValidSize) {
      toast.error('File must be smaller than 5MB!');
      return;
    }
    
    setResumeFile(file);
    setResumeList([file]);
  };

  const handleResumeRemove = () => {
    setResumeFile(null);
    setResumeList([]);
  };

  // Get file icon based on file type
  const getFileIcon = (fileName) => {
    if (!fileName) return <FileOutlined />;
    
    const extension = fileName.split('.').pop().toLowerCase();
    if (extension === 'pdf') return <FilePdfOutlined style={{ color: token.colorError }} />;
    if (extension === 'doc' || extension === 'docx') return <FileWordOutlined style={{ color: token.colorPrimary }} />;
    return <FileOutlined />;
  };

  const getStatusColor = (status) => {
    const colors = {
      APPLIED: "blue",
      UNDER_REVIEW: "orange",
      SELECTED: "green",
      REJECTED: "red",
      JOINED: "purple",
      COMPLETED: "gray",
    };
    return colors[status] || "default";
  };

  const getStatusText = (status) => {
    const texts = {
      APPLIED: "Application Submitted",
      UNDER_REVIEW: "Under Review",
      SELECTED: "Selected",
      REJECTED: "Not Selected",
      JOINED: "Joined",
      COMPLETED: "Completed",
    };
    return texts[status] || status;
  };

  // Check eligibility
  const checkEligibility = () => {
    if (!internship || !userProfile) return { eligible: false, reasons: [] };

    const reasons = [];
    let eligible = true;

    // Check if already applied
    if (hasApplied) {
      eligible = false;
      reasons.push("You have already applied for this internship");
    }

    // Check deadline
    const daysLeft = getDaysLeft(internship.applicationDeadline);
    if (daysLeft <= 0) {
      eligible = false;
      reasons.push("Application deadline has passed");
    }

    return { eligible, reasons };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="small" />
        <Text className="ml-4 text-secondary">
          Loading internship detail...
        </Text>
      </div>
    );
  }

  if (!internship) {
    return (
      <div className="text-center py-20">
        <Title level={3} className="text-secondary">
          Internship not found
        </Title>
        <Button
          type="primary"
          onClick={() => navigate("/app/internships")}
        >
          Browse Internships
        </Button>
      </div>
    );
  }

  const daysLeft = getDaysLeft(internship.applicationDeadline);
  const eligibility = checkEligibility();

  return (
    <div className="min-h-screen ">
        <div className="l mx-auto">
          {/* Back Button */}
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/app/internships")}
            className="mb-6 rounded-lg hover:scale-105 transition-all duration-200"
          >
            Back to Browse
          </Button>

          <Row gutter={[24, 24]}>
            {/* Main Content */}
            <Col xs={24} lg={16}>
              {/* Application Status Alert */}
              {hasApplied && applicationData && (
                <Alert
                  title={`${getStatusText(applicationData.status)}`}
                  description={
                    <div>
                      <p>
                        You applied for this internship on{" "}
                        {new Date(
                          applicationData.appliedDate ||
                            applicationData.createdAt
                        ).toLocaleDateString()}
                        .
                      </p>
                      {applicationData.status === "SELECTED" && (
                        <p style={{ color: token.colorSuccess }} className="font-medium">
                          🎉 Congratulations! You have been selected for this
                          internship.
                        </p>
                      )}
                      {applicationData.status === "REJECTED" &&
                        applicationData.rejectionReason && (
                          <p className="text-red-600">
                            <strong>Reason:</strong>{" "}
                            {applicationData.rejectionReason}
                          </p>
                        )}
                    </div>
                  }
                  type={
                    applicationData.status === "SELECTED"
                      ? "success"
                      : applicationData.status === "REJECTED"
                      ? "error"
                      : "info"
                  }
                  showIcon
                  className="mb-6 rounded-lg"
                  action={
                    <Button
                      size="small"
                      onClick={() => navigate("/app/my-applications")}
                    >
                      View All Applications
                    </Button>
                  }
                />
              )}

              {/* Header Card - Refactored for Clean UI */}
              <Card
                className="mb-4 rounded-2xl border-border overflow-hidden bg-surface shadow-sm"
                styles={{ body: { padding: '24px' } }}
              >
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <BankOutlined className="text-4xl text-primary" />
                  </div>
                  <div className="flex-grow">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <Title level={2} className="!mb-0 !text-text-primary text-2xl md:text-3xl">
                        {internship.title}
                      </Title>
                      {hasApplied && (
                        <Tag
                          color={getStatusColor(applicationData?.status)}
                          className="px-3 py-1 rounded-full font-medium border-0"
                        >
                          {getStatusText(applicationData?.status)}
                        </Tag>
                      )}
                    </div>
                    
                    <div className="flex items-center mb-4">
                      <Text className="text-lg font-medium text-text-secondary flex items-center">
                        <BankOutlined className="mr-2 text-text-tertiary" />
                        {internship.industry?.companyName}
                      </Text>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Tag className="px-3 py-1 rounded-full bg-background-tertiary border-border text-text-secondary flex items-center">
                        <BookOutlined className="mr-1.5 text-text-tertiary" />
                        {internship.fieldOfWork}
                      </Tag>
                      <Tag className="px-3 py-1 rounded-full bg-background-tertiary border-border text-text-secondary flex items-center">
                        <EnvironmentOutlined className="mr-1.5 text-text-tertiary" />
                        {internship.workLocation?.replace("_", " ")}
                      </Tag>
                      <Tag className="px-3 py-1 rounded-full bg-background-tertiary border-border text-text-secondary flex items-center">
                        <ClockCircleOutlined className="mr-1.5 text-text-tertiary" />
                        {internship.duration}
                      </Tag>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Application Details Card (only show if applied) */}
              {hasApplied && applicationData && (
                <Card title="Your Application" className="mb-3 rounded-2xl border-border">
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Text strong className="text-text-secondary block mb-2">
                          Application Status:
                        </Text>
                        <Tag
                          color={getStatusColor(applicationData.status)}
                          className="px-3 py-1 rounded-full font-medium text-base"
                        >
                          {getStatusText(applicationData.status)}
                        </Tag>
                      </div>
                      <div>
                        <Text strong className="text-text-secondary block mb-2">
                          Applied Date:
                        </Text>
                        <Text className="text-text-secondary">
                          {new Date(
                            applicationData.appliedDate ||
                              applicationData.createdAt
                          ).toLocaleDateString()}
                        </Text>
                      </div>
                    </div>

                    {applicationData.resume && (
                      <div>
                        <Text strong className="text-text-secondary block mb-2">
                          Resume:
                        </Text>
                        <Card className="bg-primary-50 border-border">            
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getFileIcon(applicationData.resume)}
                              <div>
                                <Text strong className="block text-text-primary">
                                  {applicationData.resume.split('/').pop().split('_').slice(2).join('_') || 'Resume.pdf'}
                                </Text>
                                <Text className="text-xs text-text-tertiary">
                                  Uploaded with application
                                </Text>
                              </div>
                            </div>
                            <Button
                              type="primary"
                              icon={<EyeOutlined />}
                              href={applicationData.resume}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg"
                            >
                              View Resume
                            </Button>
                          </div>
                        </Card>
                      </div>
                    )}

                    {applicationData.coverLetter && (
                      <div>
                        <Text strong className="text-text-secondary block mb-2">
                          Your Cover Letter:
                        </Text>
                        <div className="bg-background-tertiary p-4 rounded-xl border border-border/50">
                          <Paragraph className="mb-0 text-text-primary">
                            {applicationData.coverLetter}
                          </Paragraph>
                        </div>
                      </div>
                    )}

                    {applicationData.additionalInfo && (
                      <div>
                        <Text strong className="text-text-secondary block mb-2">
                          Additional Information:
                        </Text>
                        <div className="bg-background-tertiary p-4 rounded-xl border border-border/50">
                          <Paragraph className="mb-0 text-text-primary">
                            {applicationData.additionalInfo}
                          </Paragraph>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Description */}
              <Card
                title="About this Internship"
                className="mb-3 rounded-2xl border-border"
              >
                <Paragraph className="text-base text-text-primary leading-relaxed mb-4">
                  {internship.description}
                </Paragraph>
                {internship.detailedDescription && (
                  <div>
                    <Title level={5} className="mb-3 text-text-primary">
                      Detailed Description
                    </Title>
                    <Paragraph className="text-text-secondary leading-relaxed">
                      {internship.detailedDescription}
                    </Paragraph>
                  </div>
                )}
              </Card>

              {/* Requirements */}
              <Card
                title="Requirements & Skills"
                className="mb-3 rounded-2xl border-border"
              >
                {internship.requiredSkills?.length > 0 && (
                  <div className="mb-6">
                    <Title
                      level={5}
                      className="text-error mb-3 flex items-center"
                    >
                      <ExclamationCircleOutlined className="mr-2" />
                      Required Skills
                    </Title>
                    <div className="flex flex-wrap gap-2">
                      {internship.requiredSkills.map((skill) => (
                        <Tag
                          key={skill}
                          className="px-3 py-1 rounded-full font-medium"
                        >
                          {skill}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}

                {internship.preferredSkills?.length > 0 && (
                  <div className="mb-6">
                    <Title
                      level={5}
                      className="text-primary mb-3 flex items-center"
                    >
                      <CheckCircleOutlined className="mr-2" />
                      Preferred Skills
                    </Title>
                    <div className="flex flex-wrap gap-2">
                      {internship.preferredSkills.map((skill) => (
                        <Tag
                          key={skill}
                          className="px-3 py-1 rounded-full font-medium"
                        >
                          {skill}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}

                {/* Eligibility Criteria */}
                <div>
                  <Title level={5} className="text-success mb-3">
                    Eligibility Criteria
                  </Title>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Text strong className="block mb-2 text-text-primary">
                        Eligible Branches:
                      </Text>
                      <div className="flex flex-wrap gap-1">
                        {internship.eligibleBranches?.map((branch) => (
                          <Tag
                            key={branch}
                            className="rounded-full"
                          >
                            {branch.replace(/_/g, " ")}
                          </Tag>
                        )) || (
                          <Text className="text-text-tertiary">All branches</Text>
                        )}
                      </div>
                    </div>
                    <div>
                      <Text strong className="block mb-2 text-text-primary">
                        Eligible Semesters:
                      </Text>
                      <div className="flex flex-wrap gap-1">
                        {internship.eligibleSemesters?.map((sem) => (
                          <Tag
                            key={sem}
                            className="rounded-full"
                          >
                            Semester {sem}
                          </Tag>
                        )) || (
                          <Text className="text-text-tertiary">All semesters</Text>
                        )}
                      </div>
                    </div>
                  </div>
                  {internship.minimumPercentage && (
                    <div className="mt-4 p-3 bg-warning-50 rounded-xl border border-warning-border">
                      <Text strong className="text-warning-800">
                        Minimum Percentage Required:{" "}
                        {internship.minimumPercentage}%
                      </Text>
                    </div>
                  )}
                </div>
              </Card>

              {/* Company Information */}
              <Card title="Company Information" className="rounded-2xl border-border">
                <Descriptions column={{ xs: 1, md: 2 }} bordered className="rounded-xl overflow-hidden">
                  <Descriptions.Item label="Company Name">
                    {internship.industry?.companyName}
                  </Descriptions.Item>
                  <Descriptions.Item label="Industry Type">
                    {internship.industry?.industryType?.replace(/_/g, " ")}
                  </Descriptions.Item>
                  <Descriptions.Item label="Company Size">
                    {internship.industry?.companySize}
                  </Descriptions.Item>
                  <Descriptions.Item label="Website">
                    {internship.industry?.website ? (
                      <a
                        href={internship.industry.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Visit Website
                      </a>
                    ) : (
                      "Not provided"
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Location" span={2}>
                    {internship.industry?.city}, {internship.industry?.state}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* Sidebar */}
            <Col xs={24} lg={8}>
              {/* Quick Info Card */}
              <Card className="mb-4 rounded-2xl border-border sticky top-6">
                <div className="space-y-4">
                  {/* Application Status or Deadline Alert */}
                  {hasApplied ? (
                    <Alert
                      title="Application Status"
                      description={
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Text strong className="text-text-primary">Status:</Text>
                            <Tag
                              color={getStatusColor(applicationData?.status)}
                              className="rounded-full"
                            >
                              {getStatusText(applicationData?.status)}
                            </Tag>
                          </div>
                          <Text className="text-text-secondary text-sm">
                            Applied on{" "}
                            {new Date(
                              applicationData?.appliedDate ||
                                applicationData?.createdAt
                            ).toLocaleDateString()}
                          </Text>
                        </div>
                      }
                      type="success"
                      showIcon
                      className="rounded-xl border-success-border bg-success-50"
                    />
                  ) : (
                    <Alert
                      title={`${daysLeft} days left to apply`}
                      description={`Application deadline: ${new Date(
                        internship.applicationDeadline
                      ).toLocaleDateString()}`}
                      type={
                        daysLeft <= 3
                          ? "error"
                          : daysLeft <= 7
                          ? "warning"
                          : "success"
                      }
                      showIcon
                      className="rounded-xl"
                    />
                  )}

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="text-center rounded-xl border-border bg-background-tertiary/30" styles={{ body: { padding: '16px' } }}>
                      <TeamOutlined className="text-2xl text-primary mb-2" />
                      <div className="text-lg font-bold text-text-primary">
                        {internship.numberOfPositions}
                      </div>
                      <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold">Positions</div>
                    </Card>
                    <Card className="text-center rounded-xl border-border bg-background-tertiary/30" styles={{ body: { padding: '16px' } }}>
                      <DollarOutlined className="text-2xl text-success mb-2" />
                      <div className="text-lg font-bold text-text-primary">
                        {internship.isStipendProvided
                          ? `₹${internship.stipendAmount?.toLocaleString()}`
                          : "Unpaid"}
                      </div>
                      <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold">
                        {internship.isStipendProvided
                          ? "Monthly"
                          : "Internship"}
                      </div>
                    </Card>
                  </div>

                  {/* Timeline */}
                  <div>
                    <Title level={5} className="mb-3 text-text-primary">
                      Timeline
                    </Title>
                    <div className="space-y-3">
                      <div
                        className="flex justify-between items-center p-3 rounded-xl border border-border bg-background"
                      >
                        <Text strong className="text-text-secondary text-sm">Start Date:</Text>
                        <Text className="text-text-primary font-medium">
                          {new Date(internship.startDate).toLocaleDateString()}
                        </Text>
                      </div>
                      <div
                        className="flex justify-between items-center p-3 rounded-xl border border-border bg-background"
                      >
                        <Text strong className="text-text-secondary text-sm">Duration:</Text>
                        <Text className="text-text-primary font-medium">{internship.duration}</Text>
                      </div>
                    </div>
                  </div>

                  {/* Eligibility Status */}
                  {!hasApplied && (
                    <div>
                      <Title level={5} className="mb-3 text-text-primary">
                        Eligibility Status
                      </Title>
                      {eligibility.eligible ? (
                        <div className="p-4 bg-success-50 border border-success-border rounded-xl">
                          <div className="flex items-center">
                            <CheckCircleOutlined className="text-success mr-2" />
                            <Text strong className="text-success-800">
                              You are eligible to apply!
                            </Text>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-error-50 border border-error-border rounded-xl">
                          <div className="flex items-center mb-2">
                            <ExclamationCircleOutlined className="text-error mr-2" />
                            <Text strong className="text-error-800">
                              Not eligible
                            </Text>
                          </div>
                          <ul className="list-disc list-inside text-sm text-error space-y-1">
                            {eligibility.reasons.map((reason, index) => (
                              <li key={index}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  {hasApplied ? (
                    <Button
                      type="primary"
                      size="large"
                      block
                      icon={<EyeOutlined />}
                      onClick={() => navigate("/app/my-applications")}
                      className="h-12 rounded-xl bg-success hover:bg-success-600 border-0 font-semibold text-base shadow-lg shadow-success/20 transition-all duration-200"
                    >
                      View Application Status
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      size="large"
                      block
                      icon={<SendOutlined />}
                      onClick={() => setApplicationModal(true)}
                      disabled={!eligibility.eligible}
                      className="h-12 rounded-xl bg-primary hover:bg-primary-600 border-0 font-semibold text-base shadow-lg shadow-primary/20 transition-all duration-200"
                    >
                      {eligibility.eligible ? "Apply Now" : "Not Eligible"}
                    </Button>
                  )}
                </div>
              </Card>
            </Col>
          </Row>
        </div>

        {/* Application Modal */}
        <Modal
          title={
            <div className="flex items-center ">
              <SendOutlined className="mr-2" />
              Apply for {internship.title}
            </div>
          }
          open={applicationModal}
          onCancel={() => setApplicationModal(false)}
          footer={null}
          width={600}
          className="rounded-2xl"
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleApply}
            className="mt-6"
          >
            <Alert
              title="Application Information"
              description="Your basic information (name, roll number, branch, etc.) will be automatically included from your profile."
              type="info"
              showIcon
              className="!mb-4 rounded-lg"
              icon={<InfoCircleOutlined />}
            />

            <Form.Item
              name="coverLetter"
              label="Cover Letter"
              rules={[
                { required: true, message: "Please write a cover letter" },
                {
                  min: 100,
                  message: "Cover letter should be at least 100 characters",
                },
                {
                  max: 1000,
                  message: "Cover letter should not exceed 1000 characters",
                },
              ]}
            >
              <TextArea
                rows={6}
                placeholder="Write about your interest in this internship, relevant skills, and why you're a good fit..."
                showCount
                maxLength={1000}
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="additionalInfo"
              label="Additional Information (Optional)"
              rules={[
                {
                  max: 500,
                  message: "Additional info should not exceed 500 characters",
                },
              ]}
            >
              <TextArea
                rows={3}
                placeholder="Any additional information you'd like to share (projects, achievements, availability, etc.)"
                showCount
                maxLength={500}
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="resume"
              label="Resume/CV (Optional)"
              extra="Accepted formats: PDF, DOC, DOCX (Max 5MB)"
            >
              <Upload
                beforeUpload={() => false}
                onChange={handleResumeChange}
                onRemove={handleResumeRemove}
                fileList={resumeList}
                accept=".pdf,.doc,.docx"
                maxCount={1}
                className="rounded-lg"
              >
                <Button icon={<UploadOutlined />} className="rounded-lg">
                  Click to Upload Resume
                </Button>
              </Upload>
            </Form.Item>

            <div className="flex justify-end space-x-4 mt-8">
              <Button
                size="large"
                onClick={() => setApplicationModal(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={applying}
                icon={<SendOutlined />}
                className="rounded-lg bg-blue-500 border-0 hover:bg-blue-600"
              >
                {applying ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
  );
};

export default InternshipDetails;