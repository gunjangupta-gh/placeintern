// src/components/ReferralApplicationModal.jsx
import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  DatePicker,
  Upload,
  Typography,
  Divider,
  Space,
  Tag,
  message,
} from "antd";
import {
  UploadOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import API from "../../services/api";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const ReferralApplicationModal = ({ visible, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState([]);

  const referralTypes = [
    { value: "INDUSTRY_PARTNERSHIP", label: "Industry Partnership" },
    { value: "PLACEMENT_ASSISTANCE", label: "Placement Assistance" },
    { value: "INTERNSHIP_PROVIDER", label: "Internship Provider" },
    { value: "GUEST_LECTURER", label: "Guest Lecturer" },
    { value: "MENTOR", label: "Mentor" },
    { value: "SKILL_TRAINER", label: "Skill Trainer" },
    { value: "EQUIPMENT_SPONSOR", label: "Equipment Sponsor" },
    { value: "SCHOLARSHIP_PROVIDER", label: "Scholarship Provider" },
    { value: "RESEARCH_COLLABORATOR", label: "Research Collaborator" },
    { value: "CURRICULUM_ADVISOR", label: "Curriculum Advisor" },
    { value: "ALUMNI_NETWORK", label: "Alumni Network" },
    { value: "STARTUP_INCUBATOR", label: "Startup Incubator" },
    { value: "OTHER", label: "Other" },
  ];

  const targetAudiences = [
    { value: "STUDENTS", label: "Students" },
    { value: "FACULTY", label: "Faculty" },
    { value: "INSTITUTIONS", label: "Institutions" },
    { value: "ALUMNI", label: "Alumni" },
    { value: "INDUSTRY", label: "Industry Partners" },
  ];

  // src/components/ReferralApplicationModal.jsx
  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // Get institutionId from user context or localStorage
      const loginData = localStorage.getItem("loginResponse");
      const parsed = JSON.parse(loginData);
      const institutionId = parsed?.user?.institutionId;

      if (!institutionId) {
        toast.error("Institution information not found. Please re-login.");
        return;
      }

      const submitData = {
        title: values.title,
        description: values.description,
        referralType: values.referralType,
        targetAudience: values.targetAudience,
        qualifications: values.qualifications,
        experienceDetails: values.experienceDetails,
        proposedBenefits: values.proposedBenefits,
        validFrom: values.validFrom?.toISOString(),
        validUntil: values.validUntil?.toISOString(),
        maxUsageLimit: values.maxUsageLimit
          ? parseInt(values.maxUsageLimit)
          : undefined,
        institutionId: institutionId, // ADD THIS LINE
        references:
          fileList.length > 0
            ? {
                attachments: fileList.map((file) => ({
                  name: file.name,
                  size: file.size,
                  type: file.type,
                })),
              }
            : undefined,
      };

      // Remove undefined fields
      Object.keys(submitData).forEach((key) => {
        if (submitData[key] === undefined) {
          delete submitData[key];
        }
      });

      await API.post("/referral-applications", submitData);
      toast.success("Referral application submitted successfully!");
      form.resetFields();
      setFileList([]);
      onSuccess?.();
      onCancel();
    } catch (error) {
      console.error("Error submitting referral application:", error);
      if (error.response?.data?.message) {
        if (Array.isArray(error.response.data.message)) {
          error.response.data.message.forEach((msg) => {
            toast.error(msg);
          });
        } else {
          toast.error(error.response.data.message);
        }
      } else {
        toast.error("Failed to submit referral application. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const uploadProps = {
    fileList,
    beforeUpload: (file) => {
      // Validate file type and size
      const isValidType = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/png",
        "image/jpg",
      ].includes(file.type);

      if (!isValidType) {
        message.error(
          "You can only upload PDF, DOC, DOCX, JPG, JPEG, PNG files!"
        );
        return false;
      }

      const isValidSize = file.size / 1024 / 1024 < 10; // Less than 10MB
      if (!isValidSize) {
        message.error("File must be smaller than 10MB!");
        return false;
      }

      return false; // Prevent auto upload
    },
    onChange: ({ fileList: newFileList }) => {
      // Limit to 5 files maximum
      if (newFileList.length <= 5) {
        setFileList(newFileList);
      } else {
        message.warning("You can upload maximum 5 files");
      }
    },
    onRemove: (file) => {
      setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
    },
    multiple: true,
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png",
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      form.resetFields();
      setFileList([]);
    }
  }, [visible, form]);

  return (
    <Modal
      title={
        <div className="flex items-center">
          <CheckCircleOutlined className="mr-2 text-success" />
          <span className="font-semibold">Apply for Referral Status</span>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={null}
      destroyOnHidden
      className="rounded-xl overflow-hidden"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          targetAudience: ["STUDENTS"],
        }}
        scrollToFirstError
        className="mt-4"
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="title"
              label="Application Title"
              rules={[
                { required: true, message: "Please enter application title" },
              ]}
            >
              <Input
                placeholder="e.g., Partnership Referral Program Application"
                size="large"
                showCount
                maxLength={200}
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="referralType"
              label="Referral Type"
              rules={[
                { required: true, message: "Please select referral type" },
              ]}
            >
              <Select
                placeholder="Select referral type"
                size="large"
                showSearch
                optionFilterProp="children"
                className="rounded-lg"
              >
                {referralTypes.map((type) => (
                  <Option key={type.value} value={type.value}>
                    {type.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="targetAudience"
              label="Target Audience"
              rules={[
                { required: true, message: "Please select target audience" },
                {
                  type: "array",
                  min: 1,
                  message: "Please select at least one target audience",
                },
              ]}
            >
              <Select
                mode="multiple"
                placeholder="Select target audience"
                size="large"
                maxTagCount="responsive"
                className="rounded-lg"
              >
                {targetAudiences.map((audience) => (
                  <Option key={audience.value} value={audience.value}>
                    {audience.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              name="description"
              label="Application Description"
              rules={[{ required: true, message: "Please enter description" }]}
            >
              <TextArea
                rows={4}
                placeholder="Describe your referral program and objectives..."
                showCount
                maxLength={1000}
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              name="qualifications"
              label="Qualifications & Credentials"
              rules={[
                { required: true, message: "Please enter your qualifications" },
              ]}
            >
              <TextArea
                rows={4}
                placeholder="Describe why you qualify to be a referrer (experience, certifications, track record, etc.)"
                showCount
                maxLength={1000}
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              name="experienceDetails"
              label="Relevant Experience"
              rules={[
                { required: true, message: "Please enter experience details" },
              ]}
            >
              <TextArea
                rows={4}
                placeholder="Detail your relevant experience in the field you're applying to refer for..."
                showCount
                maxLength={1000}
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              name="proposedBenefits"
              label="Proposed Benefits"
              rules={[
                { required: true, message: "Please enter proposed benefits" },
              ]}
            >
              <TextArea
                rows={3}
                placeholder="What benefits will you provide to referred organizations/individuals?"
                showCount
                maxLength={500}
                className="rounded-lg"
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider />

        <div className="bg-warning-50/50 p-4 rounded-xl border border-warning-border mb-8">
          <Title level={5} className="text-warning-800 !mb-3">
            Application Process
          </Title>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Tag color="blue" className="rounded-md px-2 m-0">1</Tag>
              <Text className="text-warning-700 text-sm">
                Application Review (3-5 business days)
              </Text>
            </div>
            <div className="flex items-center space-x-3">
              <Tag color="orange" className="rounded-md px-2 m-0">2</Tag>
              <Text className="text-warning-700 text-sm">
                Verification & Background Check
              </Text>
            </div>
            <div className="flex items-center space-x-3">
              <Tag color="green" className="rounded-md px-2 m-0">3</Tag>
              <Text className="text-warning-700 text-sm">
                Approval & Referral Code Generation
              </Text>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button onClick={onCancel} size="large" className="rounded-xl px-6">
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<CheckCircleOutlined />}
            size="large"
            className="rounded-xl px-8 bg-success hover:bg-success-600 shadow-lg shadow-success/20 border-0"
          >
            {loading ? "Submitting..." : "Submit Application"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default ReferralApplicationModal;