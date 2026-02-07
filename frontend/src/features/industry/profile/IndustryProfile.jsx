// src/pages/industry/IndustryProfile.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  Typography,
  Spin,
  Alert,
  Progress,
  Badge,
  Steps,
  Avatar,
} from "antd";
import {
  SaveOutlined,
  CheckCircleOutlined,
  UserOutlined,
  BuildOutlined,
  ContactsOutlined,
  EnvironmentOutlined,
  SafetyOutlined,
  ShopOutlined,
  MailOutlined,
  PhoneOutlined,
  GlobalOutlined,
  BankOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Layouts from "../../../components/Layout";
import API from "../../../services/api"; // Using the actual API service
import { toast } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import {
  clearIndustryError,
  selectIndustry,
  selectIndustryError,
  selectIndustryLoading,
  selectIndustryProfile,
  setIndustryProfile,
} from "../store/industrySlice";
import { useSmartIndustry } from "../../../hooks";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Step } = Steps;

const IndustryProfile = () => {
  const dispatch = useDispatch();
  // Redux selectors
  // Use smart fetching hook
  const { data: profile, loading, error, isStale, forceRefresh, clearError } =
    useSmartIndustry();
  const [form] = Form.useForm();
  // const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isEdit, setIsEdit] = useState(false);
  // const [profile, setProfile] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const industryTypes = [
    "INFORMATION_TECHNOLOGY",
    "MANUFACTURING",
    "AUTOMOTIVE",
    "ELECTRONICS",
    "TELECOMMUNICATIONS",
    "CONSTRUCTION",
    "ENERGY_UTILITIES",
    "HEALTHCARE",
    "FINANCE_BANKING",
    "EDUCATION",
    "GOVERNMENT",
    "STARTUP",
    "RESEARCH_DEVELOPMENT",
    "OTHER",
  ];

  const companySizes = [
    { value: "STARTUP", label: "Startup (1-10 employees)" },
    { value: "SMALL", label: "Small (11-50 employees)" },
    { value: "MEDIUM", label: "Medium (51-200 employees)" },
    { value: "LARGE", label: "Large (201-1000 employees)" },
    { value: "ENTERPRISE", label: "Enterprise (1000+ employees)" },
  ];

  const formSections = [
    { title: "Company Information", icon: <BuildOutlined />, fields: 5 },
    { title: "Contact Information", icon: <ContactsOutlined />, fields: 6 },
    { title: "Address Information", icon: <EnvironmentOutlined />, fields: 4 },
    { title: "Legal Information", icon: <SafetyOutlined />, fields: 3 },
  ];

  // Set form values when profile data is loaded
  useEffect(() => {
    if (profile) {
      form.setFieldsValue(profile);
    }
  }, [profile, form]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // setProfile(profileData);
  // Updated API call using the actual API service
  // const fetchProfile = async () => {
  //   setInitialLoading(true);
  //   try {
  //     const response = await API.get("/industries/profile");

  //     if (response.data) {
  //       setProfile(response.data);
  //       form.setFieldsValue(response.data);
  //       setIsEdit(true); // Profile exists, so we're in edit mode
  //     } else {
  //       setIsEdit(false); // No profile, so we're in create mode
  //     }
  //   } catch (error) {
  //     if (error.response?.status === 404) {
  //       setIsEdit(false); // No profile found, create new one
  //     } else {
  //       console.error("Error fetching profile:", error);
  //       toast.error(error.response?.data?.message || "Error fetching profile");
  //     }
  //   } finally {
  //     setInitialLoading(false);
  //   }
  // };

  // Updated API call for create/update using the actual API service
  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      let response;

      if (isEdit) {
        // Update existing profile
        response = await API.patch(`/industries/${profile.id}`, values);
      } else {
        // Create new profile
        response = await API.post("/industries/profile", values);
      }

      if (response.data) {
        // Update Redux store immediately
        dispatch(setIndustryProfile(response.data));

        // Mark other components' data as stale for next visit
        dispatch(markDataStale());

        const message = isEdit
          ? "Profile updated successfully!"
          : "Profile created successfully!";
        toast.success(message);

        navigate("/app/dashboard");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error(
        error.response?.data?.message ||
          `Error ${isEdit ? "updating" : "creating"} profile`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getProfileCompleteness = () => {
    if (!profile) return 0;
    const requiredFields = [
      "companyName",
      "industryType",
      "companySize",
      "contactPersonName",
      "contactPersonTitle",
      "primaryEmail",
      "primaryPhone",
      "address",
      "city",
      "state",
      "pinCode",
      "registrationNumber",
      "panNumber",
    ];
    const filledFields = requiredFields.filter((field) => profile[field]);
    return Math.round((filledFields.length / requiredFields.length) * 100);
  };

  const getFormProgress = () => {
    const values = form.getFieldsValue();
    const totalFields = 18; // Total number of form fields
    const filledFields = Object.values(values).filter(
      (value) => value && value.toString().trim() !== ""
    ).length;
    return Math.round((filledFields / totalFields) * 100);
  };

  if (initialLoading) {
    return (
      <Layouts>
        <div className="min-h-screen bg-background-secondary flex items-center justify-center">
          <div className="text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center mx-auto shadow-2xl">
                <ShopOutlined className="text-3xl text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-background rounded-full flex items-center justify-center shadow-lg border border-border">
                <Spin size="small" />
              </div>
            </div>
            <Text className="text-lg text-text-secondary font-medium animate-pulse">
              Loading your profile...
            </Text>
          </div>
        </div>
      </Layouts>
    );
  }

  // Error state
  if (error) {
    return (
      <Layouts>
        <div className="min-h-screen flex items-center justify-center p-4 bg-background-secondary">
          <div className="text-center max-w-md">
            <Alert
              title="Error Loading Profile"
              description={error}
              type="error"
              showIcon
              className="mb-6 rounded-2xl border-error/20 shadow-md"
            />
            <Button
              type="primary"
              onClick={forceRefresh}
              icon={<ReloadOutlined />}
              className="rounded-lg shadow-md"
            >
              Retry
            </Button>
          </div>
        </div>
      </Layouts>
    );
  }

  return (
    <Layouts>
      <div className="min-h-screen bg-background-secondary">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Stale Data Alert */}
          {isStale && (
            <Alert
              title="Data may be outdated"
              description="Your profile data might not reflect the latest changes. Click refresh to update."
              type="warning"
              showIcon
              action={
                <Button
                  size="small"
                  type="primary"
                  onClick={forceRefresh}
                  icon={<ReloadOutlined />}
                  className="rounded-md"
                >
                  Refresh
                </Button>
              }
              className="mb-6 rounded-2xl border-warning/20 bg-warning-50/50 shadow-sm"
            />
          )}
          {/* Hero Section */}
          <div className="relative overflow-hidden rounded-3xl mb-8 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-primary-700"></div>
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative p-8 md:p-12 text-white">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center flex-1">
                  <div className="relative mr-6">
                    <Avatar
                      size={80}
                      icon={<ShopOutlined />}
                      className="bg-white/20 backdrop-blur-md border-4 border-white/30"
                    />
                    <div className="absolute -bottom-1 -right-1">
                      <Badge
                        status={profile?.isApproved ? "success" : "processing"}
                        className="bg-white rounded-full p-1 border border-border"
                      />
                    </div>
                  </div>
                  <div>
                    <Title level={2} className="text-white mb-2">
                      {isEdit
                        ? "Update Company Profile"
                        : "Setup Company Profile"}
                    </Title>
                    <Text className="text-white/80 text-lg">
                      {isEdit
                        ? "Update your company information and preferences"
                        : "Complete your company profile to start posting internships"}
                    </Text>
                  </div>
                </div>

                {/* Profile Completeness */}
                {isEdit && (
                  <div className="text-center md:text-right shrink-0">
                    <div className="mb-2">
                      <Text className="text-white/70 text-xs uppercase tracking-wider font-bold">
                        Profile Completeness
                      </Text>
                    </div>
                    <Progress
                      type="circle"
                      percent={getProfileCompleteness()}
                      size={80}
                      strokeColor={{
                        "0%": "#60a5fa",
                        "100%": "#34d399",
                      }}
                      railColor="rgba(255,255,255,0.2)"
                      strokeWidth={8}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Alerts */}
          <div className="mb-8 space-y-4">
            {profile?.isApproved === false && (
              <Alert
                title="Profile Under Review"
                description="Your profile is currently being reviewed by the institution. You'll be notified once approved."
                type="warning"
                showIcon
                className="rounded-2xl border-warning/20 bg-warning-50/50 shadow-md backdrop-blur-sm"
              />
            )}

            {profile?.isApproved === true && (
              <Alert
                title="Profile Approved"
                description="Your company profile has been approved. You can now post internships."
                type="success"
                showIcon
                className="rounded-2xl border-success-border bg-success-50 shadow-md backdrop-blur-sm"
                action={
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => navigate("/app/postings")}
                    className="bg-success hover:bg-success-600 border-0 rounded-lg font-medium"
                  >
                    Post Internship
                  </Button>
                }
              />
            )}
          </div>

          {/* Progress Steps */}
          <Card className="mb-8 rounded-3xl border-border shadow-xl overflow-hidden">
            <div className="p-6">
              <Steps
                current={currentStep}
                size="small"
                className="mb-8"
                items={formSections.map((section, index) => ({
                  title: section.title,
                  icon: section.icon,
                  description: `${section.fields} fields`,
                }))}
              />
              <div className="bg-background-tertiary/50 border border-border/50 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-2">
                  <Text className="text-text-secondary text-xs uppercase tracking-wider font-bold">
                    Overall Progress
                  </Text>
                  <Text className="text-primary font-bold">
                    {getFormProgress()}%
                  </Text>
                </div>
                <Progress
                  percent={getFormProgress()}
                  strokeColor={{
                    "0%": "#3b82f6",
                    "100%": "#10b981",
                  }}
                  railColor="rgba(var(--color-border), 0.2)"
                  strokeWidth={8}
                  showInfo={false}
                  className="!m-0"
                />
              </div>
            </div>
          </Card>

          {/* Main Form */}
          <Card className="rounded-3xl border-border shadow-2xl overflow-hidden">
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              requiredMark={false}
              className="p-4 md:p-8"
              onFieldsChange={() => {
                const values = form.getFieldsValue();
                const sections = [
                  [values.companyName, values.industryType, values.companySize],
                  [
                    values.contactPersonName,
                    values.primaryEmail,
                    values.primaryPhone,
                  ],
                  [values.address, values.city, values.state],
                  [values.registrationNumber, values.panNumber],
                ];

                const filledSections = sections.findIndex((section) =>
                  section.every(
                    (field) => field && field.toString().trim() !== ""
                  )
                );
                setCurrentStep(Math.max(0, filledSections));
              }}
            >
              {/* Company Information Section */}
              <div className="mb-12">
                <div className="flex items-center mb-8 pb-4 border-b border-border">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mr-4 shadow-lg text-white">
                    <BuildOutlined className="text-xl" />
                  </div>
                  <div>
                    <Title level={3} className="mb-0 text-text-primary">
                      Company Information
                    </Title>
                    <Text className="text-text-secondary">
                      Tell us about your organization
                    </Text>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <Form.Item
                      name="companyName"
                      label={
                        <span className="text-text-primary font-semibold">
                          Company Name
                        </span>
                      }
                      rules={[
                        {
                          required: true,
                          message: "Please enter company name",
                        },
                        {
                          min: 2,
                          message: "Company name must be at least 2 characters",
                        },
                      ]}
                    >
                      <Input
                        placeholder="Enter company name"
                        size="large"
                        className="rounded-xl border-border"
                        prefix={<BankOutlined className="text-text-tertiary mr-2" />}
                      />
                    </Form.Item>

                    <Form.Item
                      name="industryType"
                      label={
                        <span className="text-text-primary font-semibold">
                          Industry Type
                        </span>
                      }
                      rules={[
                        {
                          required: true,
                          message: "Please select industry type",
                        },
                      ]}
                    >
                      <Select
                        placeholder="Select industry type"
                        size="large"
                        className="rounded-xl"
                        suffixIcon={<BuildOutlined className="text-text-tertiary" />}
                      >
                        {industryTypes.map((type) => (
                          <Option key={type} value={type}>
                            {type
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="companySize"
                      label={
                        <span className="text-text-primary font-semibold">
                          Company Size
                        </span>
                      }
                      rules={[
                        {
                          required: true,
                          message: "Please select company size",
                        },
                      ]}
                    >
                      <Select
                        placeholder="Select company size"
                        size="large"
                        className="rounded-xl"
                      >
                        {companySizes.map((size) => (
                          <Option key={size.value} value={size.value}>
                            {size.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </div>

                  <div className="space-y-6">
                    <Form.Item
                      name="establishedYear"
                      label={
                        <span className="text-text-primary font-semibold">
                          Established Year
                        </span>
                      }
                      rules={[
                        {
                          type: "number",
                          min: 1800,
                          max: new Date().getFullYear(),
                          message: "Please enter a valid year",
                        },
                      ]}
                    >
                      <Input
                        type="number"
                        placeholder="Establishment year"
                        size="large"
                        className="rounded-xl border-border"
                      />
                    </Form.Item>

                    <Form.Item
                      name="companyDescription"
                      label={
                        <span className="text-text-primary font-semibold">
                          Company Description
                        </span>
                      }
                      rules={[
                        {
                          max: 1000,
                          message: "Description cannot exceed 1000 characters",
                        },
                      ]}
                    >
                      <TextArea
                        rows={6}
                        placeholder="Describe your company, mission, and what makes it great for internships..."
                        className="rounded-xl border-border resize-none"
                        showCount
                        maxLength={1000}
                      />
                    </Form.Item>
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="mb-12">
                <div className="flex items-center mb-8 pb-4 border-b border-border">
                  <div className="w-12 h-12 rounded-xl bg-success flex items-center justify-center mr-4 shadow-lg text-white">
                    <ContactsOutlined className="text-xl" />
                  </div>
                  <div>
                    <Title level={3} className="mb-0 text-text-primary">
                      Contact Information
                    </Title>
                    <Text className="text-text-secondary">
                      How can students and institutions reach you
                    </Text>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Form.Item
                    name="contactPersonName"
                    label={
                      <span className="text-text-primary font-semibold">
                        Contact Person Name
                      </span>
                    }
                    rules={[
                      {
                        required: true,
                        message: "Please enter contact person name",
                      },
                      { min: 2, message: "Name must be at least 2 characters" },
                    ]}
                  >
                    <Input
                      placeholder="Contact person name"
                      size="large"
                      className="rounded-xl border-border"
                      prefix={<UserOutlined className="text-text-tertiary mr-2" />}
                    />
                  </Form.Item>

                  <Form.Item
                    name="contactPersonTitle"
                    label={
                      <span className="text-text-primary font-semibold">
                        Contact Person Title
                      </span>
                    }
                    rules={[
                      {
                        required: true,
                        message: "Please enter contact person title",
                      },
                    ]}
                  >
                    <Input
                      placeholder="e.g., HR Manager, Recruitment Head"
                      size="large"
                      className="rounded-xl border-border"
                    />
                  </Form.Item>

                  <Form.Item
                    name="primaryEmail"
                    label={
                      <span className="text-text-primary font-semibold">
                        Primary Email
                      </span>
                    }
                    rules={[
                      { required: true, message: "Please enter primary email" },
                      { type: "email", message: "Please enter a valid email" },
                    ]}
                  >
                    <Input
                      placeholder="Primary email address"
                      size="large"
                      className="rounded-xl border-border"
                      prefix={<MailOutlined className="text-text-tertiary mr-2" />}
                    />
                  </Form.Item>

                  <Form.Item
                    name="alternateEmail"
                    label={
                      <span className="text-text-primary font-semibold">
                        Alternate Email
                      </span>
                    }
                    rules={[
                      { type: "email", message: "Please enter a valid email" },
                    ]}
                  >
                    <Input
                      placeholder="Alternate email (optional)"
                      size="large"
                      className="rounded-xl border-border"
                      prefix={<MailOutlined className="text-text-tertiary mr-2" />}
                    />
                  </Form.Item>

                  <Form.Item
                    name="primaryPhone"
                    label={
                      <span className="text-text-primary font-semibold">
                        Primary Phone
                      </span>
                    }
                    rules={[
                      { required: true, message: "Please enter primary phone" },
                      {
                        pattern: /^[0-9]{10}$/,
                        message: "Please enter a valid 10-digit phone number",
                      },
                    ]}
                  >
                    <Input
                      placeholder="10-digit phone number"
                      size="large"
                      className="rounded-xl border-border"
                      prefix={<PhoneOutlined className="text-text-tertiary mr-2" />}
                    />
                  </Form.Item>

                  <Form.Item
                    name="alternatePhone"
                    label={
                      <span className="text-text-primary font-semibold">
                        Alternate Phone
                      </span>
                    }
                    rules={[
                      {
                        pattern: /^[0-9]{10}$/,
                        message: "Please enter a valid 10-digit phone number",
                      },
                    ]}
                  >
                    <Input
                      placeholder="Alternate phone (optional)"
                      size="large"
                      className="rounded-xl border-border"
                      prefix={<PhoneOutlined className="text-text-tertiary mr-2" />}
                    />
                  </Form.Item>

                  <div className="lg:col-span-2">
                    <Form.Item
                      name="website"
                      label={
                        <span className="text-text-primary font-semibold">
                          Company Website
                        </span>
                      }
                      rules={[
                        { type: "url", message: "Please enter a valid URL" },
                      ]}
                    >
                      <Input
                        placeholder="https://yourcompany.com"
                        size="large"
                        className="rounded-xl border-border"
                        prefix={<GlobalOutlined className="text-text-tertiary mr-2" />}
                      />
                    </Form.Item>
                  </div>
                </div>
              </div>

              {/* Address Information Section */}
              <div className="mb-12">
                <div className="flex items-center mb-8 pb-4 border-b border-border">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mr-4 shadow-lg text-white">
                    <EnvironmentOutlined className="text-xl" />
                  </div>
                  <div>
                    <Title level={3} className="mb-0 text-text-primary">
                      Address Information
                    </Title>
                    <Text className="text-text-secondary">
                      Your company's physical location
                    </Text>
                  </div>
                </div>

                <div className="space-y-6">
                  <Form.Item
                    name="address"
                    label={
                      <span className="text-text-primary font-semibold">
                        Complete Address
                      </span>
                    }
                    rules={[
                      { required: true, message: "Please enter address" },
                    ]}
                  >
                    <TextArea
                      rows={3}
                      placeholder="Complete business address"
                      className="rounded-xl border-border resize-none"
                    />
                  </Form.Item>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Form.Item
                      name="city"
                      label={
                        <span className="text-text-primary font-semibold">
                          City
                        </span>
                      }
                      rules={[{ required: true, message: "Please enter city" }]}
                    >
                      <Input
                        placeholder="City"
                        size="large"
                        className="rounded-xl border-border"
                      />
                    </Form.Item>

                    <Form.Item
                      name="state"
                      label={
                        <span className="text-text-primary font-semibold">
                          State
                        </span>
                      }
                      rules={[
                        { required: true, message: "Please enter state" },
                      ]}
                    >
                      <Input
                        placeholder="State"
                        size="large"
                        className="rounded-xl border-border"
                      />
                    </Form.Item>

                    <Form.Item
                      name="pinCode"
                      label={
                        <span className="text-text-primary font-semibold">
                          PIN Code
                        </span>
                      }
                      rules={[
                        { required: true, message: "Please enter PIN code" },
                        {
                          pattern: /^[0-9]{6}$/,
                          message: "Please enter a valid 6-digit PIN code",
                        },
                      ]}
                    >
                      <Input
                        placeholder="PIN code"
                        size="large"
                        className="rounded-xl border-border"
                      />
                    </Form.Item>
                  </div>
                </div>
              </div>

              {/* Legal Information Section */}
              <div className="mb-12">
                <div className="flex items-center mb-8 pb-4 border-b border-border">
                  <div className="w-12 h-12 rounded-xl bg-error flex items-center justify-center mr-4 shadow-lg text-white">
                    <SafetyOutlined className="text-xl" />
                  </div>
                  <div>
                    <Title level={3} className="mb-0 text-text-primary">
                      Legal Information
                    </Title>
                    <Text className="text-text-secondary">
                      Legal compliance and verification details
                    </Text>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Form.Item
                    name="registrationNumber"
                    label={
                      <span className="text-text-primary font-semibold">
                        Company Registration Number
                      </span>
                    }
                    rules={[
                      {
                        required: true,
                        message: "Please enter registration number",
                      },
                    ]}
                  >
                    <Input
                      placeholder="Registration number"
                      size="large"
                      className="rounded-xl border-border"
                    />
                  </Form.Item>

                  <Form.Item
                    name="panNumber"
                    label={
                      <span className="text-text-primary font-semibold">
                        PAN Number
                      </span>
                    }
                    rules={[
                      { required: true, message: "Please enter PAN number" },
                      {
                        pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
                        message: "Please enter a valid PAN number",
                      },
                    ]}
                  >
                    <Input
                      placeholder="PAN number"
                      size="large"
                      className="rounded-xl border-border uppercase"
                    />
                  </Form.Item>

                  <div className="lg:col-span-2">
                    <Form.Item
                      name="gstNumber"
                      label={
                        <span className="text-text-primary font-semibold">
                          GST Number
                        </span>
                      }
                      rules={[
                        {
                          pattern:
                            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
                          message: "Please enter a valid GST number",
                        },
                      ]}
                    >
                      <Input
                        placeholder="GST number (optional)"
                        size="large"
                        className="rounded-xl border-border uppercase"
                      />
                    </Form.Item>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="text-center pt-10 border-t border-border">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  size="large"
                  icon={isEdit ? <SaveOutlined /> : <CheckCircleOutlined />}
                  className="bg-primary hover:bg-primary-600 border-none rounded-2xl h-16 px-16 text-lg font-bold shadow-xl shadow-primary/20 hover:shadow-2xl transition-all duration-300"
                >
                  {submitting
                    ? "Saving Profile..."
                    : isEdit
                    ? "Update Company Profile"
                    : "Create Company Profile"}
                </Button>

                <div className="mt-8 text-center">
                  <Text className="text-text-tertiary text-sm">
                    By submitting, you agree to our{" "}
                    <a href="#" className="text-primary hover:underline">
                      terms and conditions
                    </a>{" "}
                    and{" "}
                    <a href="#" className="text-primary hover:underline">
                      privacy policy
                    </a>
                  </Text>
                </div>
              </div>
            </Form>
          </Card>
        </div>
      </div>
    </Layouts>
  );
};

export default IndustryProfile;