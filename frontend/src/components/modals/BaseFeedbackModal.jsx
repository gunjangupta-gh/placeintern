import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, Row, Col, Card, Spin } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import RatingField from './RatingField';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

/**
 * Base feedback modal component for monthly and completion feedback
 * Provides common structure and fields that can be configured per feedback type
 *
 * @param {Object} props
 * @param {boolean} props.visible - Modal visibility
 * @param {Function} props.onCancel - Cancel handler
 * @param {Function} props.onSuccess - Success callback after submission
 * @param {Function} props.onSubmit - Submit handler (receives form values)
 * @param {boolean} props.loading - Loading state for submit button
 * @param {string} props.title - Modal title
 * @param {string} props.type - 'monthly' | 'completion' | 'custom'
 * @param {Array} props.applications - List of applications for dropdown
 * @param {boolean} props.applicationsLoading - Loading state for applications
 * @param {Object} props.initialValues - Initial form values
 * @param {Object} props.editingFeedback - Feedback data being edited
 * @param {number|string} props.preSelectedApplicationId - Pre-selected application ID
 * @param {string} props.preSelectedStudentName - Pre-selected student name for display
 * @param {Array} props.ratingFields - Array of rating field configs
 * @param {React.ReactNode} props.children - Additional custom form fields
 * @param {number} props.width - Modal width (default 800)
 * @param {Function} props.formatApplicationOption - Custom formatter for application dropdown options
 */
const BaseFeedbackModal = ({
  visible,
  onCancel,
  onSuccess,
  onSubmit,
  loading = false,
  title = 'Submit Feedback',
  type = 'monthly',
  applications = [],
  applicationsLoading = false,
  initialValues = {},
  editingFeedback = null,
  preSelectedApplicationId = null,
  preSelectedStudentName = null,
  ratingFields = [],
  children,
  width = 800,
  formatApplicationOption = null,
}) => {
  const [form] = Form.useForm();
  const isEditing = !!editingFeedback;

  // Reset form when modal opens/closes or when editing feedback changes
  useEffect(() => {
    if (visible && editingFeedback) {
      const formData = { ...editingFeedback };

      // Transform date fields to dayjs objects
      if (formData.feedbackMonth) {
        formData.feedbackMonth = dayjs(formData.feedbackMonth);
      }
      if (formData.completionDate) {
        formData.completionDate = dayjs(formData.completionDate);
      }

      form.setFieldsValue(formData);
    } else if (!visible) {
      form.resetFields();
    }
  }, [visible, editingFeedback, form]);

  // Handle pre-selected application
  useEffect(() => {
    if (preSelectedApplicationId && applications.length > 0 && !isEditing) {
      const selectedApp = applications.find(app => app.id === preSelectedApplicationId);
      if (selectedApp) {
        const values = {
          applicationId: selectedApp.id,
        };

        // Add default values based on type
        if (type === 'monthly') {
          values.feedbackMonth = dayjs();
        } else if (type === 'completion') {
          values.isCompleted = true;
          values.recommendForHire = false;
        }

        form.setFieldsValue(values);
      }
    }
  }, [preSelectedApplicationId, applications, isEditing, type, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Transform date fields based on type
      const transformedValues = { ...values };

      if (type === 'monthly' && values.feedbackMonth) {
        const date = values.feedbackMonth.toDate();
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        transformedValues.feedbackMonth = date.toISOString();
      }

      if (values.completionDate) {
        transformedValues.completionDate = dayjs(values.completionDate).format('YYYY-MM-DD');
      }

      await onSubmit(transformedValues, isEditing);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  // Default rating fields based on type
  const getDefaultRatingFields = () => {
    if (type === 'monthly') {
      return [
        {
          name: 'attendanceRating',
          label: 'Attendance Rating',
          tooltip: "Rate the intern's regular attendance and presence",
          labels: {
            1: 'Very Poor',
            2: 'Poor',
            3: 'Average',
            4: 'Good',
            5: 'Excellent'
          },
          starColor: 'text-success',
        },
        {
          name: 'performanceRating',
          label: 'Performance Rating',
          tooltip: 'Rate the overall work performance',
          labels: {
            1: 'Unsatisfactory',
            2: 'Needs Improvement',
            3: 'Satisfactory',
            4: 'Good',
            5: 'Outstanding'
          },
          starColor: 'text-warning-400',
        },
        {
          name: 'punctualityRating',
          label: 'Punctuality Rating',
          tooltip: 'Rate the timeliness and punctuality',
          labels: {
            1: 'Always Late',
            2: 'Often Late',
            3: 'Sometimes Late',
            4: 'Usually On Time',
            5: 'Always On Time'
          },
          starColor: 'text-primary',
        },
        {
          name: 'technicalSkillsRating',
          label: 'Technical Skills Rating',
          tooltip: 'Rate the technical competency and skills',
          labels: {
            1: 'Beginner',
            2: 'Basic',
            3: 'Competent',
            4: 'Proficient',
            5: 'Expert Level'
          },
          starColor: 'text-secondary',
        },
      ];
    } else if (type === 'completion') {
      return [
        {
          name: 'industryRating',
          label: 'Student Performance Rating',
          required: true,
          tooltip: 'Overall performance rating',
          labels: {
            1: 'Unsatisfactory',
            2: 'Needs Improvement',
            3: 'Satisfactory',
            4: 'Good',
            5: 'Outstanding'
          },
          starColor: 'text-warning-400',
        },
      ];
    }
    return [];
  };

  const activeRatingFields = ratingFields.length > 0 ? ratingFields : getDefaultRatingFields();

  // Default application option formatter
  const defaultFormatApplicationOption = (app) => (
    <div className="flex flex-col">
      <span className="font-medium text-text-primary">
        {app.internship?.title || app.internshipTitle || 'N/A'}
      </span>
      <span className="text-xs text-text-secondary">
        Student: {app.student?.user?.name || app.student?.name || app.studentName} ({app.student?.user?.rollNumber || app.student?.rollNumber || app.studentRollNumber})
      </span>
      <span className="text-xs text-primary font-medium">
        Status: {app.status}
      </span>
    </div>
  );

  const formatOption = formatApplicationOption || defaultFormatApplicationOption;

  return (
    <Modal
      title={
        <div className="flex items-center">
          <UserOutlined className="mr-2 text-primary" />
          {title}
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={width}
      okText={isEditing ? 'Update' : 'Submit'}
      cancelText="Cancel"
      destroyOnHidden
      maskClosable={false}
      className="rounded-xl overflow-hidden"
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-6"
        initialValues={initialValues}
      >
        {/* Application Selection */}
        <Form.Item
          name="applicationId"
          label="Select Application"
          rules={[{ required: true, message: 'Please select an application' }]}
        >
          <Select
            showSearch
            placeholder="Select an application"
            optionFilterProp="children"
            loading={applicationsLoading}
            disabled={!!preSelectedApplicationId || isEditing}
            filterOption={(input, option) =>
              option.children.props?.children?.some?.(child =>
                typeof child === 'string' && child.toLowerCase().includes(input.toLowerCase())
              ) || false
            }
            notFoundContent={
              applicationsLoading ? (
                <Spin size="small" />
              ) : (
                'No applications found'
              )
            }
          >
            {applications.map((app) => (
              <Option key={app.id} value={app.id}>
                {formatOption(app)}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Month/Date Selection based on type */}
        {type === 'monthly' && (
          <Form.Item
            name="feedbackMonth"
            label="Feedback Month"
            rules={[{ required: true, message: 'Please select feedback month' }]}
          >
            <DatePicker
              picker="month"
              placeholder="Select month"
              className="w-full"
              format="MMMM YYYY"
            />
          </Form.Item>
        )}

        {/* Rating Section */}
        {activeRatingFields.length > 0 && (
          <Card className="rounded-xl mb-6 border-border">
            <h4 className="font-semibold mb-4 text-text-primary">
              📊 Performance Ratings
            </h4>
            <Row gutter={[16, 16]}>
              {activeRatingFields.map((field) => (
                <Col xs={24} md={12} key={field.name}>
                  <RatingField
                    name={field.name}
                    label={field.label}
                    required={field.required}
                    labels={field.labels}
                    tooltip={field.tooltip}
                    starColor={field.starColor}
                  />
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {/* Overall Rating for Monthly Feedback */}
        {type === 'monthly' && (
          <Form.Item
            name="overallRating"
            label="Overall Rating"
            tooltip="Overall assessment considering all aspects"
          >
            <Select placeholder="Select overall rating (1-5)">
              {[1, 2, 3, 4, 5].map((value) => (
                <Option key={value} value={value}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-primary">
                      {value === 5
                        ? '🌟 Exceptional Performance'
                        : value === 4
                        ? '⭐ Good Performance'
                        : value === 3
                        ? '✅ Satisfactory Performance'
                        : value === 2
                        ? '⚠️ Below Expectations'
                        : '❌ Poor Performance'}
                    </span>
                    <div className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span
                          key={i}
                          className={`text-lg ${
                            i < value ? 'text-warning' : 'text-text-tertiary'
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        {/* Custom children - allows parent to inject additional fields */}
        {children}
      </Form>
    </Modal>
  );
};

export default BaseFeedbackModal;