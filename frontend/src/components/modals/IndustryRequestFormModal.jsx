// src/components/IndustryRequestFormModal.jsx
import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Typography,
  Tag,
  Divider,
  Button,
} from "antd";
import { PlusOutlined, CheckCircleOutlined } from "@ant-design/icons";
import API from "../../services/api";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";

const { Option } = Select;
const { TextArea } = Input;

const IndustryRequestFormModal = ({
  visible,
  onCancel,
  onSuccess,
  editingRequest = null,
  industryId = null,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Request Types
  const requestTypes = [
    { value: "INTERNSHIP_PARTNERSHIP", label: "Internship Partnership" },
    { value: "BULK_INTERNSHIP_REQUEST", label: "Bulk Internship Request" },
    { value: "GUEST_LECTURE", label: "Guest Lecture" },
    { value: "INDUSTRY_VISIT", label: "Industry Visit" },
    { value: "PLACEMENT_DRIVE", label: "Placement Drive" },
    { value: "SKILL_DEVELOPMENT_PROGRAM", label: "Skill Development Program" },
    { value: "CURRICULUM_COLLABORATION", label: "Curriculum Collaboration" },
    { value: "RESEARCH_COLLABORATION", label: "Research Collaboration" },
    { value: "EQUIPMENT_DONATION", label: "Equipment Donation" },
    { value: "SCHOLARSHIP_SPONSORSHIP", label: "Scholarship Sponsorship" },
    { value: "FACULTY_TRAINING", label: "Faculty Training" },
    { value: "STUDENT_MENTORSHIP", label: "Student Mentorship" },
    { value: "PROJECT_COLLABORATION", label: "Project Collaboration" },
    { value: "OTHER", label: "Other" },
  ];

  // Priority levels
  const priorities = [
    { value: "LOW", label: "Low", color: "blue" },
    { value: "MEDIUM", label: "Medium", color: "orange" },
    { value: "HIGH", label: "High", color: "red" },
    { value: "URGENT", label: "Urgent", color: "purple" },
  ];

  // Referred By Types
  const referredByTypes = [
    { value: "STATE_DIRECTORATE", label: "State Directorate" },
    { value: "FACULTY_SUPERVISOR", label: "Faculty Supervisor" },
    { value: "PRINCIPAL", label: "Principal" },
    { value: "PLACEMENT_OFFICER", label: "Placement Officer" },
    { value: "SYSTEM_ADMIN", label: "System Admin" },
    { value: "INDUSTRY_PARTNER", label: "Industry Partner" },
    { value: "ALUMNI", label: "Alumni" },
    { value: "OTHER", label: "Other" },
  ];

  // Get institution ID from localStorage
  const getInstitutionId = () => {
    const loginData = localStorage.getItem("loginResponse");
    if (loginData) {
      const parsed = JSON.parse(loginData);
      return parsed?.user?.institutionId;
    }
    return null;
  };

  // Initialize form when modal opens or editing request changes
  useEffect(() => {
    if (visible) {
      if (editingRequest) {
        // Populate form for editing
        form.setFieldsValue({
          ...editingRequest,
          requestDeadline: editingRequest.requestDeadline
            ? dayjs(editingRequest.requestDeadline)
            : null,
          expectedResponseBy: editingRequest.expectedResponseBy
            ? dayjs(editingRequest.expectedResponseBy)
            : null,
          referralDate: editingRequest.referralDate
            ? dayjs(editingRequest.referralDate)
            : null,
        });
      } else {
        // Reset form for new request
        form.resetFields();
      }
    }
  }, [visible, editingRequest, form]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const institutionId = getInstitutionId();

      if (!institutionId) {
        toast.error("Institution information not found. Please re-login.");
        return;
      }

      const submitData = {
        ...values,
        institutionId: institutionId,
        industryId: industryId,
        requestDeadline: values.requestDeadline?.toISOString(),
        expectedResponseBy: values.expectedResponseBy?.toISOString(),
        referralDate: values.referralDate?.toISOString(),
      };

      if (editingRequest) {
        await API.put(`/industry-request/${editingRequest.id}`, submitData);
        toast.success("Request updated successfully");
      } else {
        await API.post("/industry-request", submitData);
        toast.success("Request created successfully");
      }

      form.resetFields();
      onSuccess?.();
      onCancel();
    } catch (error) {
      console.error("Error saving request:", error);
      if (error.response?.data?.message) {
        if (Array.isArray(error.response.data.message)) {
          error.response.data.message.forEach((msg) => {
            toast.error(msg);
          });
        } else {
          toast.error(error.response.data.message);
        }
      } else {
        toast.error("Failed to save request");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={
        <div className="flex items-center">
          <PlusOutlined className="mr-2 text-primary" />
          {editingRequest ? "Edit Request" : "New Industry Request"}
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={null}
      destroyOnHidden
      className="rounded-xl overflow-hidden"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        className="mt-6"
        scrollToFirstError
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="title"
              label="Request Title"
              rules={[
                { required: true, message: "Please enter request title" },
                { min: 5, message: "Title must be at least 5 characters" },
                { max: 200, message: "Title must not exceed 200 characters" },
              ]}
            >
              <Input
                placeholder="Enter descriptive title for your request"
                showCount
                maxLength={200}
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="requestType"
              label="Request Type"
              rules={[
                { required: true, message: "Please select request type" },
              ]}
            >
              <Select placeholder="Select request type" showSearch className="rounded-lg">
                {requestTypes.map((type) => (
                  <Option key={type.value} value={type.value}>
                    {type.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="priority"
              label="Priority"
              rules={[{ required: true, message: "Please select priority" }]}
            >
              <Select placeholder="Select priority level" className="rounded-lg">
                {priorities.map((priority) => (
                  <Option key={priority.value} value={priority.value}>
                    <Tag color={priority.color} className="rounded-md">{priority.label}</Tag>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              name="description"
              label="Description"
              rules={[
                { required: true, message: "Please enter description" },
                {
                  min: 20,
                  message: "Description must be at least 20 characters",
                },
                {
                  max: 1000,
                  message: "Description must not exceed 1000 characters",
                },
              ]}
            >
              <TextArea
                rows={4}
                placeholder="Describe your request in detail..."
                showCount
                maxLength={1000}
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="requirements"
              label="Requirements"
              rules={[
                {
                  max: 500,
                  message: "Requirements must not exceed 500 characters",
                },
              ]}
            >
              <TextArea
                rows={3}
                placeholder="List specific requirements..."
                showCount
                maxLength={500}
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="expectedOutcome"
              label="Expected Outcome"
              rules={[
                {
                  max: 500,
                  message: "Expected outcome must not exceed 500 characters",
                },
              ]}
            >
              <TextArea
                rows={3}
                placeholder="Describe expected outcomes..."
                showCount
                maxLength={500}
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="requestDeadline"
              label="Request Deadline"
              rules={[
                {
                  validator: (_, value) => {
                    if (value && value.isBefore(dayjs(), "day")) {
                      return Promise.reject("Deadline cannot be in the past");
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <DatePicker
                className="w-full rounded-lg"
                disabledDate={(current) =>
                  current && current < dayjs().startOf("day")
                }
                placeholder="Select deadline"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="expectedResponseBy"
              label="Expected Response By"
              dependencies={["requestDeadline"]}
              rules={[
                ({ getFieldValue }) => ({
                  validator: (_, value) => {
                    const requestDeadline = getFieldValue("requestDeadline");
                    if (
                      value &&
                      requestDeadline &&
                      value.isAfter(requestDeadline)
                    ) {
                      return Promise.reject(
                        "Expected response date should not be after request deadline"
                      );
                    }
                    if (value && value.isBefore(dayjs(), "day")) {
                      return Promise.reject(
                        "Expected response date cannot be in the past"
                      );
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <DatePicker
                className="w-full rounded-lg"
                disabledDate={(current) =>
                  current && current < dayjs().startOf("day")
                }
                placeholder="Select expected response date"
              />
            </Form.Item>
          </Col>

          {/* Referral Information */}
          <Col span={24}>
            <Divider plain className="!text-text-secondary !text-xs uppercase tracking-wider">
              Referral Information (Optional)
            </Divider>
          </Col>

          <Col span={12}>
            <Form.Item name="referredByType" label="Referred By Type">
              <Select placeholder="Select referrer type" allowClear className="rounded-lg">
                {referredByTypes.map((type) => (
                  <Option key={type.value} value={type.value}>
                    {type.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="referralDate" label="Referral Date">
              <DatePicker
                className="w-full rounded-lg"
                disabledDate={(current) => current && current > dayjs()}
                placeholder="Select referral date"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              name="referralNotes"
              label="Referral Notes"
              rules={[
                {
                  max: 300,
                  message: "Referral notes must not exceed 300 characters",
                },
              ]}
            >
              <TextArea
                rows={2}
                placeholder="Additional notes about the referral..."
                maxLength={300}
                showCount
                className="rounded-lg"
              />
            </Form.Item>
          </Col>
        </Row>

        <div className="flex justify-end gap-3 mt-8">
          <Button onClick={handleCancel} size="large" className="rounded-xl px-6">
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            icon={<CheckCircleOutlined />}
            loading={loading}
            size="large"
            className="rounded-xl px-8 shadow-lg shadow-primary/20"
          >
            {loading
              ? editingRequest
                ? "Updating..."
                : "Creating..."
              : editingRequest
              ? "Update Request"
              : "Create Request"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default IndustryRequestFormModal;