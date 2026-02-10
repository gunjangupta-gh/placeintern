import React, { useMemo } from 'react';
import { Button, Card, Col, DatePicker, Divider, Form, Input, InputNumber, Row, Select, Space, Switch, Typography } from 'antd';
import {
  InfoCircleOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  BookOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useBranches } from '../../../../shared/hooks/useLookup';

const { Title, Text } = Typography;

const FormSection = ({ icon: Icon, title, description, children }) => (
  <div className="mb-6">
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon className="text-primary text-lg" />}
      <div>
        <Title level={5} className="!mb-0 training-heading">{title}</Title>
        {description && <Text type="secondary" className="text-xs">{description}</Text>}
      </div>
    </div>
    {children}
  </div>
);

const TrainingForm = ({ form, onSubmit, loading, submitText = 'Save', feedbackForms = [], onCancel }) => {
  const { activeBranches } = useBranches(true);

  const branchOptions = useMemo(
    () => activeBranches.map((branch) => ({ value: branch.id, label: branch.name })),
    [activeBranches]
  );

  const feedbackOptions = useMemo(
    () => feedbackForms.map((formItem) => ({ value: formItem.id, label: formItem.title })),
    [feedbackForms]
  );

  const handleFinish = (values) => {
    const payload = {
      ...values,
      startDate: values.startDate ? dayjs(values.startDate).toISOString() : undefined,
      endDate: values.endDate ? dayjs(values.endDate).toISOString() : undefined,
      applicationDeadline: values.applicationDeadline
        ? dayjs(values.applicationDeadline).toISOString()
        : undefined,
    };
    onSubmit(payload);
  };

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish} className="max-w-4xl">
      <FormSection
        icon={InfoCircleOutlined}
        title="Basic Information"
        description="Enter the training title and description"
      >
        <Form.Item
          name="title"
          label="Training Title"
          rules={[{ required: true, message: 'Please enter a training title' }]}
        >
          <Input placeholder="e.g., Advanced CNC Programming Workshop" size="large" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea
            rows={4}
            placeholder="Provide a detailed description of the training program, objectives, and what participants will learn..."
            showCount
            maxLength={2000}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="providedBy" label="Training Provider">
              <Input placeholder="e.g., Industry Partner Name" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="trainerName" label="Trainer Name">
              <Input placeholder="e.g., Dr. John Smith" />
            </Form.Item>
          </Col>
        </Row>
      </FormSection>

      <Divider />

      <FormSection
        icon={CalendarOutlined}
        title="Schedule & Timeline"
        description="Set training dates and application deadline"
      >
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="startDate"
              label="Start Date"
              rules={[{ required: true, message: 'Required' }]}
            >
              <DatePicker className="w-full" format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="endDate"
              label="End Date"
              rules={[{ required: true, message: 'Required' }]}
            >
              <DatePicker className="w-full" format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="applicationDeadline"
              label="Application Deadline"
              rules={[{ required: true, message: 'Required' }]}
            >
              <DatePicker className="w-full" format="DD MMM YYYY" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item name="duration" label="Duration (hours)">
              <InputNumber min={1} max={500} className="w-full" placeholder="e.g., 24" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="deliveryMode"
              label="Delivery Mode"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Select
                placeholder="Select mode"
                options={[
                  { value: 'ONLINE', label: 'Online' },
                  { value: 'OFFLINE', label: 'In-Person' },
                  { value: 'HYBRID', label: 'Hybrid' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="difficulty" label="Difficulty Level">
              <Select
                placeholder="Select level"
                allowClear
                options={[
                  { value: 'BEGINNER', label: 'Beginner' },
                  { value: 'INTERMEDIATE', label: 'Intermediate' },
                  { value: 'ADVANCED', label: 'Advanced' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>
      </FormSection>

      <Divider />

      <FormSection
        icon={EnvironmentOutlined}
        title="Location Details"
        description="Specify venue or meeting link"
      >
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="venue" label="Venue">
              <Input placeholder="e.g., Training Lab, Building 3" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="meetingLink" label="Meeting Link (for online)">
              <Input placeholder="https://..." />
            </Form.Item>
          </Col>
        </Row>
      </FormSection>

      <Divider />

      <FormSection
        icon={TeamOutlined}
        title="Capacity & Audience"
        description="Define participant limits and target branches"
      >
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="capacity"
              label="Maximum Participants"
              rules={[{ required: true, message: 'Required' }]}
            >
              <InputNumber min={1} max={1000} className="w-full" placeholder="e.g., 40" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={16}>
            <Form.Item name="targetBranchIds" label="Target Branches">
              <Select
                mode="multiple"
                options={branchOptions}
                placeholder="Select branches (leave empty for all)"
                allowClear
              />
            </Form.Item>
          </Col>
        </Row>
      </FormSection>

      <Divider />

      <FormSection
        icon={BookOutlined}
        title="Learning Content"
        description="Define prerequisites and learning outcomes"
      >
        <Form.Item name="prerequisites" label="Prerequisites">
          <Input.TextArea
            rows={2}
            placeholder="e.g., Basic CNC knowledge, familiarity with G-code..."
          />
        </Form.Item>

        <Form.Item
          name="learningOutcomes"
          label="Learning Outcomes"
          extra="Press Enter or comma to add each outcome"
        >
          <Select
            mode="tags"
            tokenSeparators={[',']}
            placeholder="e.g., Master advanced CNC programming techniques"
            className="w-full"
          />
        </Form.Item>
      </FormSection>

      <Divider />

      <FormSection
        icon={SettingOutlined}
        title="Settings"
        description="Configure feedback and publication options"
      >
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="feedbackFormId" label="Feedback Form">
              <Select
                allowClear
                options={feedbackOptions}
                placeholder="Assign a feedback form"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="publish" label="Publish Immediately" valuePropName="checked">
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>
          </Col>
        </Row>
      </FormSection>

      <Divider />

      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <Button onClick={onCancel}>Cancel</Button>
        )}
        <Button type="primary" htmlType="submit" loading={loading} size="large">
          {submitText}
        </Button>
      </div>
    </Form>
  );
};

export default TrainingForm;
