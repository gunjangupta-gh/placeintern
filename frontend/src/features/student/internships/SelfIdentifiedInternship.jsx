import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Upload,
  DatePicker,
  InputNumber,
  Divider,
  Space,
  Select,
  Spin,
  Row,
  Col,
  Typography,
  AutoComplete,
  Alert,
} from "antd";
import { UploadOutlined, PlusOutlined, SearchOutlined, WarningOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchInstituteAsync,
  selectInstitute,
  selectInstituteLoading,
} from "../../../store/slices/instituteSlice";
import { toast } from "react-hot-toast";
import { getStoredLoginResponse } from "../../../utils/authStorage";
import { selectApplicationsList } from "../store/studentSelectors";
import { submitSelfIdentified, fetchApplications } from "../store/studentSlice";
import studentService from "../../../services/student.service";

const { TextArea } = Input;
const { Option } = Select;
const { Title, Paragraph, Text } = Typography;

const SelfIdentifiedInternship = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const institute = useSelector(selectInstitute);
  const instituteLoading = useSelector(selectInstituteLoading);
  const applications = useSelector(selectApplicationsList);

  // Check if student already has an active internship
  const hasActiveInternship = useMemo(() => {
    if (!applications || applications.length === 0) return false;
    return applications.some(
      (app) => (app.status || "").toUpperCase() !== "WITHDRAWN"
    );
  }, [applications]);

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [joiningLetterFile, setJoiningLetterFile] = useState(null);
  const [facultyMentors, setFacultyMentors] = useState([]);
  const [internshipDuration, setInternshipDuration] = useState("");
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companySearchValue, setCompanySearchValue] = useState("");

  // Fetch institute data, applications, and companies on mount
  useEffect(() => {
    dispatch(fetchInstituteAsync());
    dispatch(fetchApplications({}));
    fetchCompanies();
  }, [dispatch]);

  // Fetch companies from API
  const fetchCompanies = async (search = "") => {
    try {
      setCompaniesLoading(true);
      const response = await studentService.getCompanies({ search, limit: 100 });
      setCompanies(response.companies || []);
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    } finally {
      setCompaniesLoading(false);
    }
  };

  // Handle company selection from dropdown
  const handleCompanySelect = (value) => {
    const selectedCompany = companies.find((c) => c.name === value);
    if (selectedCompany) {
      // Auto-fill company fields with selected company data
      form.setFieldsValue({
        companyName: selectedCompany.name,
        companyAddress: selectedCompany.address || "",
        companyContact: selectedCompany.contact || "",
        companyEmail: selectedCompany.email || "",
      });
      setCompanySearchValue(selectedCompany.name);
    }
  };

  // Handle company search input change
  const handleCompanySearch = (value) => {
    setCompanySearchValue(value);
  };

  // Get company options for AutoComplete
  const companyOptions = companies.map((company) => ({
    value: company.name,
    label: (
      <div>
        <div className="font-medium">{company.name}</div>
        {company.address && (
          <div className="text-xs text-text-tertiary truncate">{company.address}</div>
        )}
      </div>
    ),
  }));

  // Extract faculty mentors from institute data
  useEffect(() => {
    if (institute?.users) {
      const mentors = institute.users.filter(
        (user) => user.role === "TEACHER" || user.role === "FACULTY_SUPERVISOR"
      );
      setFacultyMentors(mentors);
    }
  }, [institute]);

  // Calculate internship duration when dates change
  const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) {
      setInternshipDuration("");
      form.setFieldsValue({ internshipDuration: "" });
      return;
    }

    const start = startDate.startOf('day');
    const end = endDate.startOf('day');

    if (end.isBefore(start)) {
      setInternshipDuration("");
      form.setFieldsValue({ internshipDuration: "" });
      toast("End date cannot be before start date", { icon: '⚠️' });
      return;
    }

    // Calculate difference in months and days
    const totalDays = end.diff(start, 'days');
    const months = Math.floor(totalDays / 30);
    const days = totalDays % 30;

    let duration = "";
    if (months > 0 && days > 0) {
      duration = `${months} month${months > 1 ? 's' : ''} ${days} day${days > 1 ? 's' : ''}`;
    } else if (months > 0) {
      duration = `${months} month${months > 1 ? 's' : ''}`;
    } else {
      duration = `${days} day${days > 1 ? 's' : ''}`;
    }

    setInternshipDuration(duration);
    form.setFieldsValue({ internshipDuration: duration });
  };

  // Handle date changes
  const handleStartDateChange = (date) => {
    const endDate = form.getFieldValue('endDate');
    calculateDuration(date, endDate);
  };

  const handleEndDateChange = (date) => {
    const startDate = form.getFieldValue('startDate');
    calculateDuration(startDate, date);
  };

  const handleSubmit = async (values) => {
    // Immediately disable button to prevent double-clicks
    if (loading) return;
    setLoading(true);

    try {
      // Get login data
      const loginData = getStoredLoginResponse();
      const studentId = loginData?.user?.studentId;
      const assignerId =
        loginData?.user?.id ||
        loginData?.user?.userId ||
        loginData?.user?.staffId;

      if (!studentId) {
        toast.error("Student ID not found. Please login again.");
        setLoading(false);
        return;
      }

      // Prevent creating a new self-identified internship if student already has
      // an active application. Only applications with status === 'WITHDRAWN'
      // are allowed to be replaced.
      const apps = Array.isArray(applications) ? applications : [];
      const hasActive = apps.some((a) => (a.status || "").toUpperCase() !== "WITHDRAWN");
      if (hasActive) {
        toast.error(
          "You already have an active internship application. Ask your mentor to deactivate it before adding another."
        );
        setLoading(false);
        return;
      }

      // Get selected mentor details
      const mentorDetails = values.mentorId
        ? facultyMentors.find((m) => m.id === values.mentorId)
        : null;

      // Create FormData
      const formData = new FormData();

      // Append basic fields
      formData.append("studentId", studentId);
      formData.append("companyName", values.companyName || "");
      formData.append("companyAddress", values.companyAddress || "");
      formData.append("companyContact", values.companyContact || "");
      formData.append("companyEmail", values.companyEmail || "");
      formData.append("jobProfile", values.jobProfile || "");
      formData.append("internshipDuration", values.internshipDuration || "");
      formData.append("hrName", values.hrName || "");
      formData.append("hrContact", values.hrContact || "");
      formData.append("hrEmail", values.hrEmail || "");

      // Append optional fields only if they have values
      if (values.stipend) {
        formData.append("stipend", values.stipend.toString());
      }

      if (values.startDate) {
        formData.append("startDate", values.startDate.toISOString());
      }

      if (values.endDate) {
        formData.append("endDate", values.endDate.toISOString());
      }

      // Append self-identified flags
      formData.append("isSelfIdentified", "true");
      formData.append("internshipPhase", "NOT_STARTED");
      formData.append("status", "PENDING");
      formData.append(
        "notes",
        "Self-identified internship submitted by student"
      );

      // **CRITICAL: Append mentor fields if mentor is selected**
      if (values.mentorId && mentorDetails) {
        formData.append("mentorId", values.mentorId);
        formData.append("mentorAssignedAt", new Date().toISOString());
        formData.append("mentorAssignedBy", assignerId || "");
        formData.append("facultyMentorName", mentorDetails.name || "");
        formData.append(
          "facultyMentorContact",
          mentorDetails.contact || mentorDetails.phone || ""
        );
        formData.append("facultyMentorEmail", mentorDetails.email || "");
        formData.append(
          "facultyMentorDesignation",
          mentorDetails.designation || "Assistant Professor"
        );
      }

      // Append file if selected
      if (joiningLetterFile) {
        formData.append("joiningLetter", joiningLetterFile);
        formData.append("joiningLetterUploadedAt", new Date().toISOString());
      }

      // Debug: Log FormData contents (remove in production)
      // console.log("FormData contents:");
      for (let [key, value] of formData.entries()) {
        // console.log(key, value);
      }

      // Validate joining Report file before upload
      if (joiningLetterFile) {
        if (joiningLetterFile.size > 5 * 1024 * 1024) {
          toast.error(`File too large (${(joiningLetterFile.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 5MB. Please compress or use a smaller file.`);
          setLoading(false);
          return;
        }
      }

      // Submit to backend using Redux action
      await dispatch(submitSelfIdentified(formData)).unwrap();

      // Backend handles mentor assignment linking if mentorId was provided in the payload.
      toast.success(
        values.mentorId
          ? "Self-identified internship submitted and mentor assignment requested"
          : "Self-identified internship submitted successfully!"
      );

      // Refresh applications list in Redux store
      dispatch(fetchApplications({ forceRefresh: true }));

      // Reset form
      form.resetFields();
      setJoiningLetterFile(null);
    } catch (error) {
      console.error("Submission error:", error);
      const errorMessage = typeof error === 'string' ? error : error?.message || "Failed to submit application. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className=" space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm mr-3">
              <PlusOutlined className="text-lg" />
            </div>
            <div>
              <Title level={2} className="mb-0 text-text-primary text-2xl">
                Submit Internship Details
              </Title>
              <Paragraph className="text-text-secondary text-sm mb-0">
                Register an internship you found independently or through external sources
              </Paragraph>
            </div>
          </div>
        </div>

        {/* Alert for existing internship */}
        {hasActiveInternship && (
          <Alert
            message="You Already Have an Active Internship"
            description={
              <div>
                <p className="mb-2">
                  You already have an active internship registered. Students can only have one active internship at a time.
                </p>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => navigate('/app/my-applications')}
                >
                  View My Internship
                </Button>
              </div>
            }
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            className="rounded-xl"
          />
        )}

        {!hasActiveInternship && (
        <Card
          className="rounded-2xl border-border shadow-sm overflow-hidden"
          styles={{ body: { padding: '32px' } }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
            requiredMark="optional"
          >
            <div className="mb-8">
              <Divider plain className="!m-0 !mb-6">
                <Text className="text-[10px] uppercase font-black text-text-tertiary tracking-widest px-2">Company Information</Text>
              </Divider>

              <Row gutter={24}>
                {/* Company Selection Dropdown */}
                <Col xs={24}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">Search Existing Company</span>}
                    extra={<Text className="text-[10px] text-text-tertiary">Select a company to auto-fill details, or enter manually below</Text>}
                  >
                    <AutoComplete
                      options={companyOptions}
                      onSelect={handleCompanySelect}
                      onSearch={handleCompanySearch}
                      value={companySearchValue}
                      onChange={handleCompanySearch}
                      placeholder="Search for a company..."
                      className="w-full"
                      allowClear
                      filterOption={(inputValue, option) =>
                        option.value.toLowerCase().includes(inputValue.toLowerCase())
                      }
                    >
                      <Input
                        prefix={<SearchOutlined className="text-text-tertiary" />}
                        className="rounded-lg h-11 bg-background border-border"
                        suffix={companiesLoading ? <Spin size="small" /> : null}
                      />
                    </AutoComplete>
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">Company Name</span>}
                    name="companyName"
                    rules={[{ required: true, message: "Please enter company name" }]}
                  >
                    <Input placeholder="e.g., Google India" className="rounded-lg h-11 bg-background border-border" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">Company Contact</span>}
                    name="companyContact"
                    rules={[{ required: true, message: "Please enter contact number" }]}
                  >
                    <Input placeholder="Phone number" className="rounded-lg h-11 bg-background border-border" />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">Company Address</span>}
                    name="companyAddress"
                    rules={[{ required: true, message: "Please enter company address" }]}
                  >
                    <TextArea
                      rows={2}
                      placeholder="Full official address of the internship location"
                      className="rounded-lg bg-background border-border p-3"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">Company Email</span>}
                    name="companyEmail"
                    rules={[{ type: "email", message: "Please enter a valid email" }]}
                  >
                    <Input placeholder="hr@company.com" className="rounded-lg h-11 bg-background border-border" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">Job Profile / Role</span>}
                    name="jobProfile"
                    rules={[{ required: true, message: "Please enter job profile" }]}
                  >
                    <Input placeholder="e.g., Data Analyst Intern" className="rounded-lg h-11 bg-background border-border" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div className="mb-8">
              <Divider plain className="!m-0 !mb-6">
                <Text className="text-[10px] uppercase font-black text-text-tertiary tracking-widest px-2">Internship Details</Text>
              </Divider>

              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">Start Date</span>}
                    name="startDate"
                    rules={[{ required: true, message: "Select start date" }]}
                  >
                    <DatePicker 
                      className="w-full rounded-lg h-11 bg-background border-border"
                      format="DD/MM/YYYY"
                      onChange={handleStartDateChange}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">End Date</span>}
                    name="endDate"
                    rules={[{ required: true, message: "Select end date" }]}
                  >
                    <DatePicker 
                      className="w-full rounded-lg h-11 bg-background border-border"
                      format="DD/MM/YYYY"
                      onChange={handleEndDateChange}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">Duration</span>}
                    name="internshipDuration"
                    extra={<Text className="text-[10px] text-text-tertiary">Calculated automatically based on dates</Text>}
                  >
                    <Input 
                      placeholder="Auto-calculated duration" 
                      disabled
                      className="rounded-lg h-11 bg-background border-border"
                      value={internshipDuration}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label={<span className="font-medium text-text-primary">Stipend (₹ per month)</span>} name="stipend">
                    <InputNumber
                      className="w-full rounded-lg h-11 bg-background border-border flex items-center"
                      placeholder="Amount (0 if unpaid)"
                      min={0}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div className="mb-8">
              <Divider plain className="!m-0 !mb-6">
                <Text className="text-[10px] uppercase font-black text-text-tertiary tracking-widest px-2">HR / Contact Person Details</Text>
              </Divider>

              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">HR / Contact Person Name</span>}
                    name="hrName"
                    rules={[{ required: true, message: "Please enter HR/contact name" }]}
                  >
                    <Input placeholder="e.g., John Smith" className="rounded-lg h-11 bg-background border-border" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">HR Contact Number</span>}
                    name="hrContact"
                    rules={[{ required: true, message: "Please enter HR contact number" }]}
                  >
                    <Input placeholder="Phone number" className="rounded-lg h-11 bg-background border-border" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">HR Email</span>}
                    name="hrEmail"
                    rules={[{ type: "email", message: "Please enter a valid email" }]}
                  >
                    <Input placeholder="hr@company.com" className="rounded-lg h-11 bg-background border-border" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span className="font-medium text-text-primary">Faculty Mentor</span>}
                    name="mentorId"
                    extra={<Text className="text-[10px] text-text-tertiary">Optional - Select your faculty mentor if assigned</Text>}
                  >
                    <Select
                      placeholder="Select faculty mentor (optional)"
                      allowClear
                      showSearch
                      optionFilterProp="children"
                      loading={instituteLoading}
                      className="rounded-lg h-11"
                    >
                      {facultyMentors.map((mentor) => (
                        <Option key={mentor.id} value={mentor.id}>
                          {mentor.name} {mentor.designation ? `(${mentor.designation})` : ''}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div className="mb-8">
              <Divider plain className="!m-0 !mb-6">
                <Text className="text-[10px] uppercase font-black text-text-tertiary tracking-widest px-2">Verification Documents</Text>
              </Divider>

              <Form.Item
                label={<span className="font-medium text-text-primary">Official Joining Report</span>}
                extra={<Text className="text-[10px] text-text-tertiary italic">Upload PDF only (Max 5MB)</Text>}
                rules={[{ required: true, message: "Please upload joining report" }]}
              >
                <Upload
                  accept=".pdf"
                  maxCount={1}
                  beforeUpload={(file) => {
                    const isLt5M = file.size / 1024 / 1024 < 5;
                    if (!isLt5M) {
                      toast.error("File must be smaller than 5MB!");
                      return Upload.LIST_IGNORE;
                    }
                    setJoiningLetterFile(file);
                    return false;
                  }}
                  onRemove={() => setJoiningLetterFile(null)}
                  fileList={joiningLetterFile ? [{ uid: "-1", name: joiningLetterFile.name, status: "done" }] : []}
                >
                  <Button icon={<UploadOutlined />} className="rounded-xl h-11 px-6 font-bold border-dashed hover:border-primary transition-all">
                    Choose PDF File
                  </Button>
                </Upload>
              </Form.Item>
            </div>

            <div className="pt-6 border-t border-border">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                disabled={loading}
                block
                className="h-12 rounded-xl font-bold text-lg bg-primary border-0 shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                Submit for Academic Approval
              </Button>
            </div>
          </Form>
        </Card>
        )}
      </div>
    </div>
  );
};

export default SelfIdentifiedInternship;