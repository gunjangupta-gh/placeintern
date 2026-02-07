// src/components/industry/EditInternshipModal.jsx
import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  Typography,
  message,
  DatePicker,
  InputNumber,
  Checkbox,
  Space,
} from "antd";
import { SaveOutlined, EditOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

import toast from "react-hot-toast";
import API from "../../services/api";
import { useBranches } from "../../features/shared/hooks/useLookup";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const EditInternshipModal = ({ visible, onClose, internship, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Use global branch data from lookup slice
  const { activeBranches } = useBranches();
  const branchOptions = activeBranches.map((branch) => ({
    value: branch.shortName,
    label: branch.name,
  }));

  const workLocations = [
    { value: "ON_SITE", label: "On-site" },
    { value: "REMOTE", label: "Remote" },
    { value: "HYBRID", label: "Hybrid" },
  ];

  // Populate form when internship data changes
  useEffect(() => {
    if (internship && visible) {
      form.setFieldsValue({
        title: internship.title,
        fieldOfWork: internship.fieldOfWork,
        description: internship.description,
        detailedDescription: internship.detailedDescription,
        numberOfPositions: internship.numberOfPositions,
        duration: internship.duration,
        workLocation: internship.workLocation,
        startDate: internship.startDate ? dayjs(internship.startDate) : null,
        endDate: internship.endDate ? dayjs(internship.endDate) : null,
        applicationDeadline: internship.applicationDeadline
          ? dayjs(internship.applicationDeadline)
          : null,
        eligibleBranches: internship.eligibleBranches || [],
        eligibleSemesters:
          internship.eligibleSemesters?.map((sem) => parseInt(sem)) || [],
        minimumPercentage: internship.minimumPercentage,
        requiredSkills: internship.requiredSkills || [],
        preferredSkills: internship.preferredSkills || [],
        isStipendProvided: !!internship.stipendAmount,
        stipendAmount: internship.stipendAmount,
        stipendDetails: internship.stipendDetails,
      });
    }
  }, [internship, visible, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formattedData = {
        industryId: internship.industryId,
        ...values,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        applicationDeadline: values.applicationDeadline?.toISOString(),
        requiredSkills: values.requiredSkills || [],
        preferredSkills: values.preferredSkills || [],
        eligibleBranches: values.eligibleBranches || [],
        eligibleSemesters:
          values.eligibleSemesters?.map((sem) => sem.toString()) || [],
        stipendAmount: values.isStipendProvided ? values.stipendAmount : null,
      };

      const response = await API.patch(
        `/internships/${internship.id}`,
        formattedData
      );

      if (response.data.success || response.data) {
        toast.success("Internship updated successfully!");
        onSuccess && onSuccess(response.data);
        onClose();
        form.resetFields();
      } else {
        toast.error(response.data.message || "Error updating internship");
      }
    } catch (error) {
      // Error logged to monitoring service
      toast.error(
        error.response?.data?.message ||
          "An unexpected error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <div className="flex items-center">
          <EditOutlined className="mr-2 text-primary" />
          <span>Edit Internship</span>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={900}
      className="rounded-xl overflow-hidden"
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
        initialValues={{
          isStipendProvided: false,
          workLocation: "ON_SITE",
          eligibleSemesters: [5, 6],
        }}
        className="mt-4"
      >
        {/* Basic Information */}
        <Title level={5} className="!mt-0 !mb-4">
          Basic Information
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Form.Item
              name="title"
              label="Internship Title"
              rules={[
                { required: true, message: "Please enter internship title" },
                { min: 5, message: "Title must be at least 5 characters" },
              ]}
            >
              <Input
                placeholder="e.g., Full Stack Developer Intern"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              name="fieldOfWork"
              label="Field of Work"
              rules={[
                { required: true, message: "Please enter field of work" },
              ]}
            >
              <Input
                placeholder="e.g., Software Development"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col xs={24}>
            <Form.Item
              name="description"
              label="Short Description"
              rules={[
                { required: true, message: "Please enter description" },
                {
                  max: 200,
                  message: "Description cannot exceed 200 characters",
                },
              ]}
            >
              <TextArea
                rows={3}
                placeholder="Brief description of the internship role..."
                className="rounded-lg"
                showCount
                maxLength={200}
              />
            </Form.Item>
          </Col>

          <Col xs={24}>
            <Form.Item
              name="detailedDescription"
              label="Detailed Description"
              rules={[
                {
                  max: 1000,
                  message: "Description cannot exceed 1000 characters",
                },
              ]}
            >
              <TextArea
                rows={4}
                placeholder="Detailed description including responsibilities, learning outcomes, project details..."
                className="rounded-lg"
                showCount
                maxLength={1000}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Position & Duration */}
        <Title level={5} className="mt-6 mb-4">
          Position & Duration
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Form.Item
              name="numberOfPositions"
              label="Number of Positions"
              rules={[
                { required: true, message: "Please enter number of positions" },
                {
                  type: "number",
                  min: 1,
                  max: 50,
                  message: "Positions must be between 1 and 50",
                },
              ]}
            >
              <InputNumber
                placeholder="Enter positions"
                size="large"
                className="w-full rounded-lg"
                min={1}
                max={50}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              name="duration"
              label="Duration"
              rules={[{ required: true, message: "Please enter duration" }]}
            >
              <Select
                placeholder="Select duration"
                size="large"
                className="rounded-lg"
              >
                <Option value="1 month">1 Month</Option>
                <Option value="2 months">2 Months</Option>
                <Option value="3 months">3 Months</Option>
                <Option value="4 months">4 Months</Option>
                <Option value="5 months">5 Months</Option>
                <Option value="6 months">6 Months</Option>
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              name="workLocation"
              label="Work Location"
              rules={[
                { required: true, message: "Please select work location" },
              ]}
            >
              <Select
                placeholder="Select location"
                size="large"
                className="rounded-lg"
              >
                {workLocations.map((location) => (
                  <Option key={location.value} value={location.value}>
                    {location.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="startDate"
              label="Expected Start Date"
              rules={[{ required: true, message: "Please select start date" }]}
            >
              <DatePicker
                placeholder="Select start date"
                size="large"
                className="w-full rounded-lg"
                disabledDate={(current) =>
                  current && current < dayjs().startOf("day")
                }
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="applicationDeadline"
              label="Application Deadline"
              rules={[
                {
                  required: true,
                  message: "Please select application deadline",
                },
              ]}
            >
              <DatePicker
                placeholder="Select deadline"
                size="large"
                className="w-full rounded-lg"
                disabledDate={(current) =>
                  current && current < dayjs().startOf("day")
                }
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Eligibility */}
        <Title level={5} className="mt-6 mb-4">
          Eligibility Criteria
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="eligibleBranches"
              label="Eligible Branches"
              rules={[
                { required: true, message: "Please select eligible branches" },
              ]}
            >
              <Select
                mode="multiple"
                placeholder="Select eligible branches"
                size="large"
                className="rounded-lg"
                options={branchOptions}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="eligibleSemesters"
              label="Eligible Semesters"
              rules={[
                { required: true, message: "Please select eligible semesters" },
              ]}
            >
              <Select
                mode="multiple"
                placeholder="Select semesters"
                size="large"
                className="rounded-lg"
              >
                {[1, 2, 3, 4, 5, 6].map((sem) => (
                  <Option key={sem} value={sem}>
                    Semester {sem}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="minimumPercentage"
              label="Minimum Percentage Required"
              rules={[
                {
                  type: "number",
                  min: 50,
                  max: 100,
                  message: "Percentage must be between 50 and 100",
                },
              ]}
            >
              <InputNumber
                placeholder="Enter minimum percentage"
                size="large"
                className="w-full rounded-lg"
                min={50}
                max={100}
                step={0.1}
                formatter={(value) => `${value}%`}
                parser={(value) => value.replace("%", "")}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Skills */}
        <Title level={5} className="mt-6 mb-4">
          Skills Requirements
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="requiredSkills"
              label="Required Skills"
              tooltip="Skills that are mandatory for this internship"
            >
              <Select
                mode="tags"
                placeholder="Enter required skills"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="preferredSkills"
              label="Preferred Skills"
              tooltip="Skills that are good to have but not mandatory"
            >
              <Select
                mode="tags"
                placeholder="Enter preferred skills"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Stipend */}
        <Title level={5} className="mt-6 mb-4">
          Stipend Information
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Form.Item name="isStipendProvided" valuePropName="checked" className="!mb-4">
              <Checkbox className="text-text-primary font-medium">This internship provides stipend</Checkbox>
            </Form.Item>
          </Col>

          <Form.Item
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.isStipendProvided !== currentValues.isStipendProvided
            }
            noStyle
          >
            {({ getFieldValue }) =>
              getFieldValue("isStipendProvided") ? (
                <>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="stipendAmount"
                      label="Stipend Amount (₹)"
                      rules={[
                        {
                          required: true,
                          message: "Please enter stipend amount",
                        },
                        {
                          type: "number",
                          min: 1000,
                          message: "Minimum stipend should be ₹1000",
                        },
                      ]}
                    >
                      <InputNumber
                        placeholder="Enter amount"
                        size="large"
                        className="w-full rounded-lg"
                        min={1000}
                        formatter={(value) =>
                          `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                        }
                        parser={(value) => value.replace(/\₹\s?|(,*)/g, "")}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item
                      name="stipendDetails"
                      label="Stipend Details"
                      tooltip="Additional information about stipend, benefits, etc."
                    >
                      <TextArea
                        rows={3}
                        placeholder="Additional stipend details, frequency, benefits..."
                        className="rounded-lg"
                      />
                    </Form.Item>
                  </Col>
                </>
              ) : null
            }
          </Form.Item>
        </Row>

        {/* Submit Buttons */}
        <div className="text-center mt-8 pt-6 border-t border-border">
          <Space size="middle">
            <Button
              size="large"
              onClick={handleClose}
              className="rounded-xl min-w-[120px]"
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              icon={<SaveOutlined />}
              className="rounded-xl min-w-[180px] font-semibold shadow-lg shadow-primary/20"
            >
              {loading ? "Updating..." : "Update Internship"}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default EditInternshipModal;