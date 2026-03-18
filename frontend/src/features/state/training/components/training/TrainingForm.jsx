import React, { useMemo, useState } from "react";
import {
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tabs,
  Switch,
  TimePicker,
  Typography,
} from "antd";
import {
  InfoCircleOutlined,
  CalendarOutlined,
  TeamOutlined,
  SettingOutlined,
  LeftOutlined,
  RightOutlined,
  CheckOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useBranches } from "../../../../shared/hooks/useLookup";

const { Title, Text } = Typography;
const ALL_BRANCHES_VALUE = "__ALL_BRANCHES__";

const FormSection = ({ icon: Icon, title, children }) => (
  <div className="mb-4">
    <div className="flex items-center gap-1.5 mb-2">
      {Icon && <Icon className="text-primary text-base" />}
      <Title level={5} className="!mb-0 !text-sm training-heading">
        {title}
      </Title>
    </div>
    {children}
  </div>
);

const STEPS = [
  { title: "Basic Info", icon: <InfoCircleOutlined /> },
  { title: "Schedule", icon: <CalendarOutlined /> },
  { title: "Capacity", icon: <TeamOutlined /> },
  { title: "Settings", icon: <SettingOutlined /> },
];

// Fields required for each step (for validation)
const STEP_FIELDS = {
  0: ["title"], // Basic Information - title is required
  1: ["startDate", "endDate", "applicationDeadline", "deliveryMode"], // Schedule & Details
  2: ["capacity"], // Capacity & Audience
  3: [], // Settings - no required fields
};

const TrainingForm = ({
  form,
  onSubmit,
  loading,
  submitText = "Save",
  feedbackForms = [],
  preTestForms = [],
  postTestForms = [],
  onCancel,
  currentStep,
  onStepChange,
}) => {
  const { activeBranches } = useBranches(true);
  const [internalStep, setInternalStep] = useState(0);

  // Use external step if provided, otherwise use internal state
  const step = currentStep !== undefined ? currentStep : internalStep;
  const setStep = onStepChange || setInternalStep;

  const branchOptions = useMemo(
    () => [
      { value: ALL_BRANCHES_VALUE, label: "All Branches" },
      ...activeBranches.map((branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    ],
    [activeBranches],
  );

  const feedbackOptions = useMemo(
    () =>
      (Array.isArray(feedbackForms) ? feedbackForms : []).map((formItem) => ({
        value: formItem.id,
        label: formItem.title || formItem.name || "Untitled Form",
      })),
    [feedbackForms],
  );

  const preTestOptions = useMemo(
    () =>
      (Array.isArray(preTestForms) ? preTestForms : []).map((formItem) => ({
        value: formItem.id,
        label: formItem.title || formItem.name || "Untitled Form",
      })),
    [preTestForms],
  );

  const postTestOptions = useMemo(
    () =>
      (Array.isArray(postTestForms) ? postTestForms : []).map((formItem) => ({
        value: formItem.id,
        label: formItem.title || formItem.name || "Untitled Form",
      })),
    [postTestForms],
  );

  const toIsoOrUndefined = (value) => {
    if (!value) return undefined;
    if (typeof value === "string") {
      const parsed = dayjs(value);
      return parsed.isValid() ? parsed.toISOString() : undefined;
    }
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.toISOString() : undefined;
  };

  const parseLearningOutcomes = (value) => {
    if (!value) return undefined;
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }

    return String(value)
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const handleFinish = (values) => {
    const selectedTargetBranchIds = Array.isArray(values.targetBranchIds)
      ? values.targetBranchIds.filter(Boolean)
      : [];

    const normalizedTargetBranchIds = selectedTargetBranchIds.includes(
      ALL_BRANCHES_VALUE,
    )
      ? []
      : selectedTargetBranchIds;

    const payload = {
      ...values,
      title: values.title?.trim(),
      startDate: toIsoOrUndefined(values.startDate),
      endDate: toIsoOrUndefined(values.endDate),
      startTime: toIsoOrUndefined(values.startTime),
      endTime: toIsoOrUndefined(values.endTime),
      applicationDeadline: toIsoOrUndefined(values.applicationDeadline),
      capacity:
        values.capacity === undefined || values.capacity === null
          ? undefined
          : Number(values.capacity),
      duration:
        values.duration === undefined || values.duration === null
          ? undefined
          : Number(values.duration),
      learningOutcomes: parseLearningOutcomes(values.learningOutcomes),
      targetBranchIds: normalizedTargetBranchIds,
    };
    onSubmit(payload);
  };

  const handleTargetBranchesChange = (selectedValues = []) => {
    if (!Array.isArray(selectedValues)) return;

    if (selectedValues.includes(ALL_BRANCHES_VALUE) && selectedValues.length > 1) {
      const latestValue = selectedValues[selectedValues.length - 1];

      if (latestValue === ALL_BRANCHES_VALUE) {
        form.setFieldValue("targetBranchIds", [ALL_BRANCHES_VALUE]);
      } else {
        form.setFieldValue(
          "targetBranchIds",
          selectedValues.filter((value) => value !== ALL_BRANCHES_VALUE),
        );
      }
    }
  };

  // Auto-calculate duration when startTime or endTime changes
  const handleTimeChange = () => {
    const startTime = form.getFieldValue("startTime");
    const endTime = form.getFieldValue("endTime");
    if (startTime && endTime) {
      const start = dayjs(startTime);
      const end = dayjs(endTime);
      const diffHours = end.diff(start, "hour", true);
      if (diffHours > 0) {
        form.setFieldValue("duration", Math.max(1, Math.round(diffHours)));
      }
    }
  };

  const validateCurrentStep = async () => {
    const fieldsToValidate = STEP_FIELDS[step];
    if (fieldsToValidate.length === 0) return true;

    try {
      await form.validateFields(fieldsToValidate);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid && step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      await form.validateFields(["title", "startDate", "endDate", "applicationDeadline", "deliveryMode", "capacity"]);
      const values = form.getFieldsValue(true);
      handleFinish(values);
    } catch (error) {
      // Find which step has errors and go to it
      const errorFields = error.errorFields?.map((f) => f.name[0]) || [];
      for (let i = 0; i < STEPS.length; i++) {
        const stepFields = STEP_FIELDS[i];
        if (stepFields.some((field) => errorFields.includes(field))) {
          setStep(i);
          break;
        }
      }
    }
  };

  // Step 1: Basic Information
  const renderBasicInfo = () => (
    <FormSection>
      <Form.Item
        name="title"
        label="Training Title"
        rules={[{ required: true, message: "Please enter a training title" }]}
      >
        <Input
          placeholder="e.g., Advanced CNC Programming Workshop"
          size="large"
        />
      </Form.Item>

      <Form.Item name="description" label="Description">
        <Input.TextArea
          rows={3}
          placeholder="Provide a detailed description of the training program, objectives, and what participants will learn..."
          showCount
          maxLength={2000}
        />
      </Form.Item>

      <Row gutter={12}>
        <Col xs={24} sm={8}>
          <Form.Item name="providedBy" label="Training Provider">
            <Input placeholder="e.g., Industry Partner Name" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="trainerName" label="Mentor Name">
            <Input placeholder="e.g., Dr. John Smith" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="trainerContact" label="Mentor Email">
            <Input type="email" placeholder="mentor@example.com" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
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
  );

  // Step 2: Schedule & Details
  const renderScheduleDetails = () => (
    <FormSection >
      <Row gutter={12}>
        <Col xs={24} sm={8}>
          <Form.Item
            name="startDate"
            label="Start Date"
            rules={[{ required: true, message: "Required" }]}
          >
            <DatePicker className="w-full" format="DD MMM YYYY" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item
            name="endDate"
            label="End Date"
            rules={[{ required: true, message: "Required" }]}
          >
            <DatePicker className="w-full" format="DD MMM YYYY" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item
            name="applicationDeadline"
            label="Application Deadline"
            dependencies={["startDate"]}
            rules={[
              { required: true, message: "Required" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value) return Promise.resolve();

                  const startDate = getFieldValue("startDate");
                  if (!startDate) return Promise.resolve();

                  const deadlineDate = dayjs(value).startOf("day");
                  const trainingStartDate = dayjs(startDate).startOf("day");

                  if (deadlineDate.isAfter(trainingStartDate, "day")) {
                    return Promise.reject(
                      new Error("Application deadline must be on or before training start date"),
                    );
                  }

                  return Promise.resolve();
                },
              }),
            ]}
          >
            <DatePicker className="w-full" format="DD MMM YYYY" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col xs={24} sm={6}>
          <Form.Item name="startTime" label="Start Time">
            <TimePicker
              className="w-full"
              format="hh:mm A"
              use12Hours
              onChange={handleTimeChange}
              suffixIcon={<ClockCircleOutlined />}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={6}>
          <Form.Item name="endTime" label="End Time">
            <TimePicker
              className="w-full"
              format="hh:mm A"
              use12Hours
              onChange={handleTimeChange}
              suffixIcon={<ClockCircleOutlined />}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={6}>
          <Form.Item name="duration" label="Duration (hours)">
            <InputNumber
              min={0.5}
              max={500}
              className="w-full"
              placeholder="Auto"
              readOnly
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={6}>
          <Form.Item name="cost" label="Cost (₹)">
            <InputNumber
              min={0}
              className="w-full"
              placeholder="0 = Free"
              prefix="₹"
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col xs={24} sm={8}>
          <Form.Item
            name="deliveryMode"
            label="Delivery Mode"
            rules={[{ required: true, message: "Required" }]}
          >
            <Select
              placeholder="Select mode"
              options={[
                { value: "ONLINE", label: "Online" },
                { value: "OFFLINE", label: "In-Person" },
                { value: "HYBRID", label: "Hybrid" },
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
                { value: "BEGINNER", label: "Beginner" },
                { value: "INTERMEDIATE", label: "Intermediate" },
                { value: "ADVANCED", label: "Advanced" },
              ]}
            />
          </Form.Item>
        </Col>
        {/* <Col xs={24} sm={8}>
          <Form.Item name="designation" label="Target Designation">
            <Input placeholder="e.g., For Computer Science Faculty" />
          </Form.Item>
        </Col> */}
      </Row>
    </FormSection>
  );

  // Step 3: Capacity & Audience
  const renderCapacityAudience = () => (
    <FormSection>
      <Row gutter={12}>
        <Col xs={24} sm={8}>
          <Form.Item
            name="capacity"
            label="Maximum Participants"
            rules={[{ required: true, message: "Required" }]}
          >
            <InputNumber
              min={1}
              max={1000}
              className="w-full"
              placeholder="e.g., 40"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={16}>
          <Form.Item
            name="targetBranchIds"
            label="Target Branches"
            rules={[
              {
                required: true,
                type: "array",
                min: 1,
                message: "Please select at least one target option",
              },
            ]}
            extra="Select specific branches or choose All Branches"
          >
            <Select
              mode="multiple"
              options={branchOptions}
              placeholder="Select specific branches or All Branches"
              allowClear
              onChange={handleTargetBranchesChange}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="prerequisites" label="Prerequisites">
        <Input.TextArea
          rows={2}
          placeholder="e.g., Basic CNC knowledge, familiarity with G-code..."
        />
      </Form.Item>

      <Form.Item
        name="learningOutcomes"
        label="Learning Outcomes"
        extra="Enter one outcome per line (or separate by commas)"
      >
        <Input.TextArea
          rows={3}
          placeholder="e.g., Master advanced CNC programming techniques"
        />
      </Form.Item>
    </FormSection>
  );

  // Step 4: Settings
  const renderSettings = () => (
    <FormSection>
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item name="preTestFormId" label="Pre-Test Form" extra="Prerequisites assessment before training">
            <Select
              allowClear
              options={preTestOptions}
              placeholder="Assign a pre-test form"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="postTestFormId" label="Post-Test Form" extra="Learning assessment after training">
            <Select
              allowClear
              options={postTestOptions}
              placeholder="Assign a post-test form"
            />
          </Form.Item>
        </Col>
      </Row>
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
          <Form.Item
            name="publish"
            label="Publish Immediately"
            valuePropName="checked"
          >
            <Switch checkedChildren="Yes" unCheckedChildren="No" />
          </Form.Item>
        </Col>
      </Row>
    </FormSection>
  );

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return renderBasicInfo();
      case 1:
        return renderScheduleDetails();
      case 2:
        return renderCapacityAudience();
      case 3:
        return renderSettings();
      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full">
      <Tabs
        activeKey={String(step)}
        onChange={(activeKey) => setStep(Number(activeKey))}
        className="mb-3"
        size="small"
        tabBarGutter={12}
        items={STEPS.map((stepItem, index) => ({
          key: String(index),
          label: (
            <span
              className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border transition-all ${
                step === index
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
              aria-label={`Step ${index + 1}: ${stepItem.title}`}
            >
              <span
                className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-semibold rounded-full ${
                  step === index ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {index + 1}
              </span>
              {stepItem.icon}
              <span className="font-medium">{stepItem.title}</span>
            </span>
          ),
        }))}
      />

      <Form layout="vertical" form={form} onFinish={handleFinish} size="small">
        {renderStepContent()}

        <div className="flex justify-between gap-2 pt-3 border-t border-border mt-3">
          <div>{onCancel && <Button onClick={onCancel}>Cancel</Button>}</div>
          <Space>
            {step > 0 && (
              <Button onClick={handlePrevious} icon={<LeftOutlined />}>
                Previous
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                type="primary"
                onClick={handleNext}
                icon={<RightOutlined />}
                iconPosition="end"
              >
                Next
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={loading}
                icon={<CheckOutlined />}
              >
                {submitText}
              </Button>
            )}
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default TrainingForm;
