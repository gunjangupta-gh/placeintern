import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  Select,
  Button,
  message,
  Row,
  Col,
  Card,
  Divider,
  InputNumber,
  Spin,
  Alert,
  Modal,
  Typography,
  Tag,
  Space,
  Descriptions,
  Avatar,
} from "antd";
import { useNavigate } from "react-router-dom";
import {
  SaveOutlined,
  InfoCircleOutlined,
  ContactsOutlined,
  HomeOutlined,
  FileTextOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  EditOutlined,
  BankOutlined,
  GlobalOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  SendOutlined, // Add this import
} from "@ant-design/icons";
import API from "../../../services/api";
import Layouts from "../../../components/Layout";
import { toast } from "react-hot-toast";
import ReferralApplicationModal from "../../../components/ReferralApplicationModal"; // Add this import
import IndustryRequestFormModal from "../../../components/IndustryRequestFormModal"; // Add this import

const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

// These should ideally match the enums in your Prisma schema
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
const companySizes = ["STARTUP", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE"];

const CreateIndustryProfile = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [existingProfile, setExistingProfile] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  // Add state for referral application modal
  const [referralModalVisible, setReferralModalVisible] = useState(false);
  // Add state for industry request modal
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const navigate = useNavigate();
  const loginData = localStorage.getItem("loginResponse");
  const parsed = JSON.parse(loginData);

  // Check if industry profile already exists
  useEffect(() => {
    checkExistingProfile();
  }, []);

  const checkExistingProfile = async () => {
    setCheckingProfile(true);
    try {
      const response = await API.get("/industries/profile");
      if (response.data) {
        setExistingProfile(response.data);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setExistingProfile(null);
      } else {
        console.error("Error checking profile:", error);
        toast.error("Failed to check existing profile. Please try again.");
      }
    } finally {
      setCheckingProfile(false);
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    const payload = {
      ...values,
      userId: parsed.user.id,
    };

    try {
      await API.post("/industries", payload);
      toast.success(
        "Profile created successfully! It is now pending for approval."
      );
      checkExistingProfile(); // Refresh the profile data
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        "Failed to create profile. Please check your details and try again.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    form.setFieldsValue({
      ...existingProfile,
      establishedYear: existingProfile.establishedYear || undefined,
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async (values) => {
    setUpdating(true);
    try {
      await API.patch(`/industries/${existingProfile.id}`, values);
      toast.success("Profile updated successfully!");
      setEditModalVisible(false);
      checkExistingProfile(); // Refresh the profile data
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        "Failed to update profile. Please try again.";
      toast.error(errorMsg);
    } finally {
      setUpdating(false);
    }
  };

  // Handle referral application modal success
  const handleReferralApplicationSuccess = (applicationData) => {
    toast.success("Your referral application has been submitted for review!");
    // Optionally refresh profile data or navigate somewhere
    checkExistingProfile();
  };
  // Handle industry request modal success
  const handleRequestSuccess = () => {
    toast.success("Your industry request has been submitted successfully!");
    // Optionally navigate to requests page or refresh data
  };
  const getStatusColor = (isApproved) => {
    return isApproved ? "success" : "processing";
  };

  const getStatusText = (isApproved) => {
    return isApproved ? "Approved" : "Pending Approval";
  };

  const formatIndustryType = (type) => {
    return type?.replace(/_/g, " & ") || "Not specified";
  };

  // Show loading spinner while checking profile
  if (checkingProfile) {
    return (
      <Layouts>
        <div className="flex justify-center items-center min-h-screen">
          <Spin size="small" />
          <Text className="ml-4 text-gray-600">Loading dashboard...</Text>
        </div>
      </Layouts>
    );
  }

  // Show existing profile if it exists
  if (existingProfile) {
      return (
        <Layouts>
          <div className="mx-auto p-4 md:p-6 bg-background-secondary min-h-screen">
            {/* Profile Header */}
            <Card className="mb-4 rounded-2xl border-border shadow-sm">
              <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                <div className="flex items-center gap-6">
                  <Avatar
                    size={80}
                    icon={<BankOutlined />}
                    className="bg-primary shadow-md"
                  />
                  <div>
                    <Title level={2} className="mb-2 text-text-primary">
                      {existingProfile.companyName}
                    </Title>
                    <Space wrap>
                      <Tag
                        color={getStatusColor(existingProfile.isApproved)}
                        className="px-3 py-0.5 text-sm font-medium rounded-full"
                      >
                        {getStatusText(existingProfile.isApproved)}
                      </Tag>
                      <Tag className="px-3 py-0.5 rounded-full border-border bg-background-tertiary text-text-primary">
                        {formatIndustryType(existingProfile.industryType)}
                      </Tag>
                      <Tag className="px-3 py-0.5 rounded-full border-border bg-background-tertiary text-text-primary">
                        {existingProfile.companySize}
                      </Tag>
                    </Space>
                    <Text className="text-text-secondary block mt-3">
                      {existingProfile.companyDescription ||
                        "No description provided"}
                    </Text>
                  </div>
                </div>
                {/* Updated action buttons section */}
                <div className="flex flex-col gap-3 shrink-0">
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={handleEdit}
                    size="large"
                    className="rounded-xl shadow-md shadow-primary/20"
                  >
                    Edit Profile
                  </Button>
                  {/* Add Industry Request Button - Show only if profile is approved */}
                  {!existingProfile.isApproved && (
                    <Button
                      icon={<SendOutlined />}
                      onClick={() => setRequestModalVisible(true)}
                      size="large"
                      className="bg-secondary hover:bg-secondary-600 text-white border-0 rounded-xl shadow-md shadow-secondary/20"
                    >
                      Make Industry Request
                    </Button>
                  )}
                </div>
              </div>
            </Card>
    
            {/* Profile Details */}
            <Row gutter={[24, 24]}>
              {/* Company Information */}
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <div className="flex items-center text-primary font-semibold">
                      <InfoCircleOutlined className="mr-2" />
                      Company Information
                    </div>
                  }
                  className="h-full rounded-2xl border-border shadow-sm"
                >
                  <Descriptions column={1} size="small" bordered className="rounded-xl overflow-hidden">
                    <Descriptions.Item
                      label={
                        <span className="flex items-center text-text-secondary">
                          <BankOutlined className="mr-2" />
                          Name
                        </span>
                      }
                    >
                      <Text strong className="text-text-primary">{existingProfile.companyName}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={
                        <span className="flex items-center text-text-secondary">
                          <TeamOutlined className="mr-2" />
                          Industry
                        </span>
                      }
                    >
                      <Text className="text-text-primary">{formatIndustryType(existingProfile.industryType)}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={
                        <span className="flex items-center text-text-secondary">
                          <TeamOutlined className="mr-2" />
                          Size
                        </span>
                      }
                    >
                      <Text className="text-text-primary">{existingProfile.companySize}</Text>
                    </Descriptions.Item>
                    {existingProfile.establishedYear && (
                      <Descriptions.Item
                        label={
                          <span className="flex items-center text-text-secondary">
                            <CalendarOutlined className="mr-2" />
                            Established
                          </span>
                        }
                      >
                        <Text className="text-text-primary">{existingProfile.establishedYear}</Text>
                      </Descriptions.Item>
                    )}
                    {existingProfile.website && (
                      <Descriptions.Item
                        label={
                          <span className="flex items-center text-text-secondary">
                            <GlobalOutlined className="mr-2" />
                            Website
                          </span>
                        }
                      >
                        <a
                          href={existingProfile.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          {existingProfile.website}
                        </a>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              </Col>
    
              {/* Contact Information */}
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <div className="flex items-center text-success font-semibold">
                      <ContactsOutlined className="mr-2" />
                      Contact Information
                    </div>
                  }
                  className="h-full rounded-2xl border-border shadow-sm"
                >
                  <Descriptions column={1} size="small" bordered className="rounded-xl overflow-hidden">
                    <Descriptions.Item
                      label={
                        <span className="flex items-center text-text-secondary">
                          <ContactsOutlined className="mr-2" />
                          Contact Person
                        </span>
                      }
                    >
                      <Text strong className="text-text-primary">{existingProfile.contactPersonName}</Text>
                      <br />
                      <Text className="text-text-secondary text-xs">
                        {existingProfile.contactPersonTitle}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={
                        <span className="flex items-center text-text-secondary">
                          <MailOutlined className="mr-2" />
                          Primary Email
                        </span>
                      }
                    >
                      <a
                        href={`mailto:${existingProfile.primaryEmail}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {existingProfile.primaryEmail}
                      </a>
                    </Descriptions.Item>
                    {existingProfile.alternateEmail && (
                      <Descriptions.Item
                        label={
                          <span className="flex items-center text-text-secondary">
                            <MailOutlined className="mr-2" />
                            Alternate Email
                          </span>
                        }
                      >
                        <a
                          href={`mailto:${existingProfile.alternateEmail}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {existingProfile.alternateEmail}
                        </a>
                      </Descriptions.Item>
                    )}
                    <Descriptions.Item
                      label={
                        <span className="flex items-center text-text-secondary">
                          <PhoneOutlined className="mr-2" />
                          Primary Phone
                        </span>
                      }
                    >
                      <a
                        href={`tel:+91${existingProfile.primaryPhone}`}
                        className="text-primary hover:underline font-medium"
                      >
                        +91 {existingProfile.primaryPhone}
                      </a>
                    </Descriptions.Item>
                    {existingProfile.alternatePhone && (
                      <Descriptions.Item
                        label={
                          <span className="flex items-center text-text-secondary">
                            <PhoneOutlined className="mr-2" />
                            Alternate Phone
                          </span>
                        }
                      >
                        <a
                          href={`tel:+91${existingProfile.alternatePhone}`}
                          className="text-primary hover:underline font-medium"
                        >
                          +91 {existingProfile.alternatePhone}
                        </a>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              </Col>
    
              {/* Address Information */}
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <div className="flex items-center text-warning font-semibold">
                      <HomeOutlined className="mr-2" />
                      Address Information
                    </div>
                  }
                  className="h-full rounded-2xl border-border shadow-sm"
                >
                  <Descriptions column={1} size="small" bordered className="rounded-xl overflow-hidden">
                    <Descriptions.Item
                      label={
                        <span className="flex items-center text-text-secondary">
                          <EnvironmentOutlined className="mr-2" />
                          Address
                        </span>
                      }
                    >
                      <div className="text-text-primary">
                        <Text className="block mb-1">{existingProfile.address}</Text>
                        <Text className="font-medium">
                          {existingProfile.city}, {existingProfile.state}{" "}
                          {existingProfile.pinCode}
                        </Text>
                        <br />
                        <Text className="text-text-tertiary">{existingProfile.country}</Text>
                      </div>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
    
              {/* Legal Information */}
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <div className="flex items-center text-secondary font-semibold">
                      <SafetyCertificateOutlined className="mr-2" />
                      Legal Information
                    </div>
                  }
                  className="h-full rounded-2xl border-border shadow-sm"
                >
                  <Descriptions column={1} size="small" bordered className="rounded-xl overflow-hidden">
                    <Descriptions.Item
                      label={
                        <span className="flex items-center text-text-secondary">
                          <FileTextOutlined className="mr-2" />
                          Reg. Number
                        </span>
                      }
                    >
                      <Text code className="text-text-primary">{existingProfile.registrationNumber}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={
                        <span className="flex items-center text-text-secondary">
                          <FileTextOutlined className="mr-2" />
                          PAN Number
                        </span>
                      }
                    >
                      <Text code className="text-text-primary">{existingProfile.panNumber}</Text>
                    </Descriptions.Item>
                    {existingProfile.gstNumber && (
                      <Descriptions.Item
                        label={
                          <span className="flex items-center text-text-secondary">
                            <FileTextOutlined className="mr-2" />
                            GST Number
                          </span>
                        }
                      >
                        <Text code className="text-text-primary">{existingProfile.gstNumber}</Text>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              </Col>
            </Row>
    
            {/* Edit Modal */}
            <Modal
              title={
                <div className="flex items-center text-primary font-semibold">
                  <EditOutlined className="mr-2" />
                  Edit Company Profile
                </div>
              }
              open={editModalVisible}
              onCancel={() => setEditModalVisible(false)}
              footer={null}
              width={850}
              className="rounded-2xl overflow-hidden"
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={handleUpdate}
                className="mt-4"
              >
                {/* Company Information */}
                <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold">
                  Company Details
                </Divider>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="companyName"
                      label="Company Name"
                      rules={[{ required: true, message: "Required" }]}
                    >
                      <Input placeholder="e.g., Acme Innovations" className="rounded-lg" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="industryType"
                      label="Industry Type"
                      rules={[{ required: true, message: "Required" }]}
                    >
                      <Select placeholder="Select type" className="rounded-lg">
                        {industryTypes.map((type) => (
                          <Option key={type} value={type}>
                            {type.replace(/\_/g, " & ")}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="companySize"
                      label="Company Size"
                      rules={[{ required: true, message: "Required" }]}
                    >
                      <Select placeholder="Select size" className="rounded-lg">
                        {companySizes.map((size) => (
                          <Option key={size} value={size}>
                            {size}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="establishedYear"
                      label="Year"
                    >
                      <InputNumber
                        className="w-full rounded-lg"
                        placeholder="e.g., 2010"
                        min={1800}
                        max={new Date().getFullYear()}
                      />
                    </Form.Item>
                  </Col>
                </Row>
    
                {/* Form Actions */}
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-border">
                  <Button onClick={() => setEditModalVisible(false)} className="rounded-lg px-6">
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={updating}
                    icon={<SaveOutlined />}
                    className="rounded-lg px-8 shadow-md shadow-primary/20"
                  >
                    Update Profile
                  </Button>
                </div>
              </Form>
            </Modal>
          </div>
        </Layouts>
      );
    }
          {/* Status Alert */}
          {/* {!existingProfile.isApproved && (
            <Alert
              title="Profile Pending Approval"
              description="Your profile is currently being reviewed by our team. You will be notified once it's approved. In the meantime, you can still edit your profile information."
              type="info"
              showIcon
              className="mt-6"
              action={
                <Button
                  size="small"
                  onClick={() => navigate("/dashboard")}
                >
                  Go to Dashboard
                </Button>
              }
            />
          )} */}

          {/* Referral Status Info */}
          {/* {existingProfile.isApproved && (
            <Alert
              title="Referral Program Available"
              description="Your profile is approved! You can now apply for referral status to help other organizations get verified faster and earn referral benefits."
              type="success"
              showIcon
              className="!mt-6"
              // action={
              //   <Button
              //     type="primary"
              //     icon={<StarOutlined />}
              //     onClick={() => setReferralModalVisible(true)}
              //     className="bg-green-600 hover:bg-green-700"
              //   >
              //     Apply for Referral Status
              //   </Button>
              // }
            />
          )} */}

          {/* Edit Modal */}
          <Modal
            title={
              <div className="flex items-center text-blue-700">
                <EditOutlined className="mr-2" />
                Edit Company Profile
              </div>
            }
            open={editModalVisible}
            onCancel={() => setEditModalVisible(false)}
            footer={null}
            width={850}
            className="top-4"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleUpdate}
              className=" overflow-y-auto"
            >
              {/* Company Information */}
              <Divider plain className="!text-lg !font-semibold">
                <InfoCircleOutlined className="mr-2" />
                Company Information
              </Divider>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="companyName"
                    label="Company Name"
                    rules={[
                      {
                        required: true,
                        message: "Please enter the company name",
                      },
                    ]}
                  >
                    <Input placeholder="e.g., Acme Innovations Pvt. Ltd." />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="industryType"
                    label="Industry Type"
                    rules={[
                      {
                        required: true,
                        message: "Please select an industry type",
                      },
                    ]}
                  >
                    <Select placeholder="Select a type">
                      {industryTypes.map((type) => (
                        <Option key={type} value={type}>
                          {type.replace(/\_/g, " & ")}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="companySize"
                    label="Company Size"
                    rules={[
                      {
                        required: true,
                        message: "Please select a company size",
                      },
                    ]}
                  >
                    <Select placeholder="Select the number of employees">
                      {companySizes.map((size) => (
                        <Option key={size} value={size}>
                          {size}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="establishedYear"
                    label="Year of Establishment"
                  >
                    <InputNumber
                      className="w-full"
                      placeholder="e.g., 2010"
                      min={1800}
                      max={new Date().getFullYear()}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    name="companyDescription"
                    label="Company Description"
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder="Briefly describe what your company does."
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* Contact Information */}
              <Divider plain className="!text-lg !font-semibold">
                <ContactsOutlined className="mr-2" />
                Contact Information
              </Divider>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="contactPersonName"
                    label="Contact Person's Name"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="Full Name" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="contactPersonTitle"
                    label="Contact Person's Title"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="e.g., HR Manager" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="primaryEmail"
                    label="Primary Email"
                    rules={[{ required: true, type: "email" }]}
                  >
                    <Input placeholder="work@example.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="alternateEmail"
                    label="Alternate Email"
                    rules={[{ type: "email" }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="primaryPhone"
                    label="Primary Phone"
                    rules={[{ required: true }]}
                  >
                    <Input addonBefore="+91" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="alternatePhone" label="Alternate Phone">
                    <Input addonBefore="+91" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    name="website"
                    label="Company Website"
                    rules={[{ type: "url" }]}
                  >
                    <Input placeholder="https://www.example.com" />
                  </Form.Item>
                </Col>
              </Row>

              {/* Address Information */}
              <Divider plain className="!text-lg !font-semibold">
                <HomeOutlined className="mr-2" />
                Address Information
              </Divider>
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.Item
                    name="address"
                    label="Street Address"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="Plot No, Building Name, Street" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="city"
                    label="City"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="e.g., Shimla" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="state"
                    label="State"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="e.g., Himachal Pradesh" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="pinCode"
                    label="PIN Code"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="e.g., 171001" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="country"
                    label="Country"
                    rules={[{ required: true }]}
                  >
                    <Input disabled defaultValue="India" />
                  </Form.Item>
                </Col>
              </Row>

              {/* Legal Information */}
              <Divider plain className="!text-lg !font-semibold">
                <FileTextOutlined className="mr-2" />
                Legal Information
              </Divider>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="registrationNumber"
                    label="Company Registration No."
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="CIN / UIN" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="panNumber"
                    label="Company PAN"
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="gstNumber" label="GST Number (Optional)">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <Button onClick={() => setEditModalVisible(false)}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={updating}
                  icon={<SaveOutlined />}
                  className="bg-gradient-to-r from-blue-500 to-blue-700 border-0"
                >
                  Update Profile
                </Button>
              </div>
            </Form>
          </Modal>
          {/* Add Industry Request Form Modal */}
          <IndustryRequestFormModal
            visible={requestModalVisible}
            onCancel={() => setRequestModalVisible(false)}
            onSuccess={handleRequestSuccess}
            industryId={existingProfile.id}
          />

          {/* Add Referral Application Modal */}
          <ReferralApplicationModal
            visible={referralModalVisible}
            onCancel={() => setReferralModalVisible(false)}
            onSuccess={handleReferralApplicationSuccess}
          />
        </div>
      </Layouts>
    );
  }

  // Show the create profile form if no existing profile
  return (
    <Layouts>
      <div className="flex items-center justify-center">
        <Card className="w-full max-w-5xl shadow-xl">
          <div className="text-center mb-8">
            <Title level={2} className="">
              Create Your Industry Profile
            </Title>
            <Text className="text-gray-600 text-lg">
              Please provide your company details to get started with our
              internship program.
            </Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ country: "India" }}
          >
            {/* Section 1: Company Information */}
            <Divider plain className="!text-lg !font-semibold">
              <InfoCircleOutlined className="mr-2" />
              Company Information
            </Divider>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="companyName"
                  label="Company Name"
                  rules={[
                    {
                      required: true,
                      message: "Please enter the company name",
                    },
                  ]}
                >
                  <Input placeholder="e.g., Acme Innovations Pvt. Ltd." />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="industryType"
                  label="Industry Type"
                  rules={[
                    {
                      required: true,
                      message: "Please select an industry type",
                    },
                  ]}
                >
                  <Select placeholder="Select a type">
                    {industryTypes.map((type) => (
                      <Option key={type} value={type}>
                        {type.replace(/\_/g, " & ")}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="companySize"
                  label="Company Size"
                  rules={[
                    { required: true, message: "Please select a company size" },
                  ]}
                >
                  <Select placeholder="Select the number of employees">
                    {companySizes.map((size) => (
                      <Option key={size} value={size}>
                        {size}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="establishedYear" label="Year of Establishment">
                  <InputNumber
                    className="w-full"
                    placeholder="e.g., 2010"
                    min={1800}
                    max={new Date().getFullYear()}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item
                  name="companyDescription"
                  label="Company Description"
                >
                  <Input.TextArea
                    rows={4}
                    placeholder="Briefly describe what your company does."
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Section 2: Contact Information */}
            <Divider plain className="!text-lg !font-semibold">
              <ContactsOutlined className="mr-2" />
              Contact Information
            </Divider>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="contactPersonName"
                  label="Contact Person's Name"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="Full Name" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="contactPersonTitle"
                  label="Contact Person's Title"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="e.g., HR Manager" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="primaryEmail"
                  label="Primary Email"
                  rules={[{ required: true, type: "email" }]}
                >
                  <Input placeholder="work@example.com" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="alternateEmail"
                  label="Alternate Email"
                  rules={[{ type: "email" }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="primaryPhone"
                  label="Primary Phone"
                  rules={[{ required: true }]}
                >
                  <Input addonBefore="+91" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="alternatePhone" label="Alternate Phone">
                  <Input addonBefore="+91" />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item
                  name="website"
                  label="Company Website"
                  rules={[{ type: "url" }]}
                >
                  <Input placeholder="https://www.example.com" />
                </Form.Item>
              </Col>
            </Row>

            {/* Section 3: Address Information */}
            <Divider plain className="!text-lg !font-semibold">
              <HomeOutlined className="mr-2" />
              Address Information
            </Divider>
            <Row gutter={24}>
              <Col xs={24}>
                <Form.Item
                  name="address"
                  label="Street Address"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="Plot No, Building Name, Street" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="city"
                  label="City"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="e.g., Shimla" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="state"
                  label="State"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="e.g., Himachal Pradesh" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="pinCode"
                  label="PIN Code"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="e.g., 171001" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="country"
                  label="Country"
                  rules={[{ required: true }]}
                >
                  <Input disabled />
                </Form.Item>
              </Col>
            </Row>

            {/* Section 4: Legal Information */}
            <Divider plain className="!text-lg !font-semibold">
              <FileTextOutlined className="mr-2" />
              Legal Information
            </Divider>
            <Row gutter={24}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="registrationNumber"
                  label="Company Registration No."
                  rules={[{ required: true }]}
                >
                  <Input placeholder="CIN / UIN" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="panNumber"
                  label="Company PAN"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="gstNumber" label="GST Number (Optional)">
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item className="mt-8 text-center">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                icon={<SaveOutlined />}
                className="bg-gradient-to-r from-blue-500 to-blue-700 border-0 px-12 h-12"
              >
                Submit for Approval
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </Layouts>
  );
};

export default CreateIndustryProfile;