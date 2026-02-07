// src/pages/industry/PostInternship.jsx
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
  message,
  DatePicker,
  InputNumber,
  Checkbox,
  Tag,
  Space,
  Alert,
  Spin,
} from "antd";
import {
  SaveOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  FileTextOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  DollarOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import API from "../../../services/api"; // Assuming you have a file that exports an Axios instance or similar
import Layouts from "../../../components/Layout";
import { toast } from "react-hot-toast";
import { useBranches } from "../../shared/hooks/useLookup";
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const PostInternship = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();

  // Use global branch data from lookup slice
  const { activeBranches, loading: branchesLoading } = useBranches();
  const branchOptions = activeBranches.map((branch) => ({
    value: branch.shortName,
    label: branch.name,
  }));

  const workLocations = [
    { value: "ON_SITE", label: "On-site" },
    { value: "REMOTE", label: "Remote" },
    { value: "HYBRID", label: "Hybrid" },
  ];

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await API.get("/industries/profile");

      if (response) {
        setProfile(response.data);
        if (!response.data.isApproved) {
          toast.error(
            "Your profile is not approved yet. You cannot post internships."
          );
          navigate("/dashboard");
        }
      } else {
        toast.error("Please complete your profile first");
        navigate("/company/profile");
      }
    } catch (error) {
      toast.error("Please complete your profile first");
      navigate("/company/profile");
    }
  };

  // console.log(profile.id)

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formattedData = {
        ...values,
        // Assuming the industryId is available in the fetched profile.
        // The API backend should validate this from the authenticated user.
        // We'll pass it in the payload for clarity, but the backend implementation
        // in the prompt suggests it will get it from the request object (req.user.industryId).
        // This is a good practice for security, but we include it here to match the schema.
        industryId: profile?.id,
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

      // Call the API endpoint to create the internship
      const response = await API.post("/internships", formattedData);

      if (response.data) {
        toast.success("Internship posted successfully!");
        navigate("/postings");
      } else {
        toast.error(response.data.message || "Error posting internship");
      }
    } catch (error) {
      console.error("API call error:", error);
      toast.error(
        error.response?.data?.message ||
          "An unexpected error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!profile?.isApproved) {
    return (
      // <div
      //   style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px" }}
      // >
      //   <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      //     <Alert
      //       title="Profile Not Approved"
      //       description="Your company profile needs to be approved before you can post internships. Please wait for approval or contact the institution."
      //       type="warning"
      //       showIcon
      //       action={
      //         <Button
      //           size="small"
      //           onClick={() => navigate("/dashboard")}
      //         >
      //           Go to Dashboard
      //         </Button>
      //       }
      //     />
      //   </div>

      // </div>
      <Layouts>
        <div className="flex justify-center items-center min-h-screen">
          <Spin size="small" />
          {/* <Text className="ml-4 text-gray-600">Loading dashboard...</Text> */}
        </div>
      </Layouts>
    );
  }

  return (
    <Layouts>
      <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-2">
            <div className="flex items-center">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm mr-3">
                <PlusOutlined className="text-lg" />
              </div>
              <div>
                <Title level={2} className="mb-0 text-text-primary text-2xl">
                  Post Internship
                </Title>
                <Paragraph className="text-text-secondary text-sm mb-0">
                  Create a new opportunity to connect with talented students
                </Paragraph>
              </div>
            </div>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            requiredMark="optional"
            initialValues={{
              isStipendProvided: false,
              isRemoteAllowed: false,
              workLocation: "ON_SITE",
              eligibleSemesters: [5, 6],
            }}
          >
            {/* Basic Information Section */}
            <Card className="rounded-2xl border-border shadow-sm mb-6" styles={{ body: { padding: '32px' } }}>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                  <FileTextOutlined className="text-primary text-lg" />
                </div>
                <div>
                  <Title level={4} className="!mb-0 text-text-primary">Basic Information</Title>
                  <Text className="text-text-tertiary text-xs uppercase font-bold tracking-widest">General Role Details</Text>
                </div>
              </div>

              <Row gutter={24}>
                <Col xs={24} md={16}>
                  <Form.Item
                    name="title"
                    label={<span className="font-medium text-text-primary">Internship Title</span>}
                    rules={[{ required: true, message: "Please enter internship title" }]}
                  >
                    <Input placeholder="e.g., Full Stack Developer Intern" className="rounded-lg h-11 bg-background border-border" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    name="fieldOfWork"
                    label={<span className="font-medium text-text-primary">Field of Work</span>}
                    rules={[{ required: true, message: "Please enter field of work" }]}
                  >
                    <Input placeholder="e.g., Software Development" className="rounded-lg h-11 bg-background border-border" />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="description"
                    label={<span className="font-medium text-text-primary">Short Summary</span>}
                    rules={[{ required: true, message: "Please enter description" }]}
                  >
                    <TextArea rows={2} placeholder="Brief one-liner about the role..." className="rounded-lg bg-background border-border p-3" maxLength={200} showCount />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="detailedDescription"
                    label={<span className="font-medium text-text-primary">Detailed Description</span>}
                  >
                    <TextArea rows={5} placeholder="Include responsibilities, requirements, and day-to-day tasks..." className="rounded-lg bg-background border-border p-4" maxLength={1000} showCount />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Position & Timeline Section */}
            <Card className="rounded-2xl border-border shadow-sm mb-6" styles={{ body: { padding: '32px' } }}>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center border border-success/20 shrink-0">
                  <TeamOutlined className="text-success text-lg" />
                </div>
                <div>
                  <Title level={4} className="!mb-0 text-text-primary">Position & Timeline</Title>
                  <Text className="text-text-tertiary text-xs uppercase font-bold tracking-widest">Requirements and Dates</Text>
                </div>
              </div>

              <Row gutter={24}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="numberOfPositions"
                    label={<span className="font-medium text-text-primary">Available Positions</span>}
                    rules={[{ required: true, type: 'number', min: 1 }]}
                  >
                    <InputNumber className="w-full rounded-lg h-11 bg-background border-border flex items-center" min={1} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    name="duration"
                    label={<span className="font-medium text-text-primary">Duration</span>}
                    rules={[{ required: true }]}
                  >
                    <Select className="rounded-lg h-11" placeholder="Select duration">
                      <Option value="1 month">1 Month</Option>
                      <Option value="2 months">2 Months</Option>
                      <Option value="3 months">3 Months</Option>
                      <Option value="6 months">6 Months</Option>
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    name="workLocation"
                    label={<span className="font-medium text-text-primary">Work Location</span>}
                    rules={[{ required: true }]}
                  >
                    <Select className="rounded-lg h-11">
                      {workLocations.map(loc => <Option key={loc.value} value={loc.value}>{loc.label}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="startDate"
                    label={<span className="font-medium text-text-primary">Expected Start Date</span>}
                    rules={[{ required: true }]}
                  >
                    <DatePicker className="w-full rounded-lg h-11 bg-background border-border" disabledDate={c => c && c < dayjs().endOf('day')} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="applicationDeadline"
                    label={<span className="font-medium text-text-primary">Application Deadline</span>}
                    rules={[{ required: true }]}
                  >
                    <DatePicker className="w-full rounded-lg h-11 bg-background border-border" disabledDate={c => c && c < dayjs().endOf('day')} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Compensation Section */}
            <Card className="rounded-2xl border-border shadow-sm mb-10" styles={{ body: { padding: '32px' } }}>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                  <DollarOutlined className="text-amber-600 text-lg" />
                </div>
                <div>
                  <Title level={4} className="!mb-0 text-text-primary">Compensation</Title>
                  <Text className="text-text-tertiary text-xs uppercase font-bold tracking-widest">Stipend and Benefits</Text>
                </div>
              </div>

              <Form.Item name="isStipendProvided" valuePropName="checked">
                <Checkbox className="text-text-primary font-bold">Provide monthly stipend</Checkbox>
              </Form.Item>

              <Form.Item
                shouldUpdate={(p, c) => p.isStipendProvided !== c.isStipendProvided}
                noStyle
              >
                {({ getFieldValue }) => getFieldValue('isStipendProvided') && (
                  <div className="space-y-4 animate-fade-in">
                    <Form.Item
                      name="stipendAmount"
                      label={<span className="font-medium text-text-primary">Stipend Amount (₹ per month)</span>}
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber 
                        className="w-full md:w-1/2 rounded-lg h-11 bg-background border-border flex items-center" 
                        formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={v => v.replace(/\₹\s?|(,*)/g, '')}
                      />
                    </Form.Item>
                    <Form.Item
                      name="stipendDetails"
                      label={<span className="font-medium text-text-primary">Additional Benefits</span>}
                    >
                      <TextArea rows={2} placeholder="e.g. Travel allowance, performance bonus, etc." className="rounded-lg bg-background border-border p-3" />
                    </Form.Item>
                  </div>
                )}
              </Form.Item>
            </Card>

            <div className="flex justify-end gap-4 py-8 border-t border-border">
              <Button
                size="large"
                onClick={() => navigate("/dashboard")}
                disabled={loading}
                className="rounded-xl px-10 h-14 border-border text-text-secondary font-bold hover:text-text-primary"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                icon={<SaveOutlined />}
                className="rounded-xl px-12 h-14 bg-primary border-0 font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
              >
                Publish Opportunity
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </Layouts>
  );
};

export default PostInternship;