import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import API from "../../../services/api";
import studentService from "../../../services/student.service";
import {
  getImageUrl,
  openFileWithPresignedUrl,
} from "../../../utils/imageUtils";
import ProfileAvatar from "../../../components/common/ProfileAvatar";
import MaskedField from "../../../components/common/MaskedField";
import { fetchStudentProfile, updateProfile } from "../store/studentSlice";
import {
  Card,
  Col,
  Row,
  Typography,
  Spin,
  Avatar,
  Tag,
  Tabs,
  Button,
  Empty,
  Form,
  Input,
  Select,
  Upload,
  Modal,
  theme,
} from "antd";
import ImgCrop from "antd-img-crop";
import {
  UserOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  FileTextOutlined,
  EditOutlined,
  TeamOutlined,
  UploadOutlined,
  BulbOutlined,
  LaptopOutlined,
  BankOutlined,
  SolutionOutlined,
  CheckCircleOutlined,
  StopOutlined,
  CameraOutlined,
  HomeOutlined,
  BookOutlined,
} from "@ant-design/icons";
import toast from "react-hot-toast";

const { Title, Text } = Typography;
const { Option } = Select;

export default function StudentProfile() {
  const dispatch = useDispatch();

  // Redux state for profile with caching
  const {
    data: reduxProfile,
    loading: reduxLoading,
    error: reduxError,
  } = useSelector((state) => state.student.profile);
  const lastFetched = useSelector(
    (state) => state.student.lastFetched?.profile,
  );

  const [documents, setDocuments] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [uploadForm] = Form.useForm();
  const [uploadModal, setUploadModal] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [profileImageList, setProfileImageList] = useState([]);
  const [imageUploading, setImageUploading] = useState(false);
  const toastShownRef = useRef(false);
  const { token } = theme.useToken();

  // Cache for unmasked contact data
  const unmaskedDataRef = useRef(null);

  // Handler to reveal masked contact fields via API
  const handleRevealContact = useCallback(async (fieldName) => {
    // Return cached data if available
    if (unmaskedDataRef.current) {
      const fieldMap = {
        Email: unmaskedDataRef.current.email,
        email: unmaskedDataRef.current.email,
        Phone: unmaskedDataRef.current.phoneNo,
        phone: unmaskedDataRef.current.phoneNo,
        "Parent Contact": unmaskedDataRef.current.parentContact,
        parentContact: unmaskedDataRef.current.parentContact,
      };
      return fieldMap[fieldName] || null;
    }

    // Fetch unmasked data from API
    const data = await studentService.getOwnUnmaskedContact();
    unmaskedDataRef.current = data;

    const fieldMap = {
      Email: data.email,
      email: data.email,
      Phone: data.phoneNo,
      phone: data.phoneNo,
      "Parent Contact": data.parentContact,
      parentContact: data.parentContact,
    };
    return fieldMap[fieldName] || null;
  }, []);

  // Use Redux profile data
  const student = reduxProfile;
  const loading = reduxLoading && !reduxProfile;
  const error = reduxError;
  const rawResults = student?.results || [];

  // State-wise District and Tehsil data
  const stateDistrictTehsilData = {
    Punjab: {
      Amritsar: [
        "Amritsar-I",
        "Amritsar-II",
        "Ajnala",
        "Attari",
        "Baba Bakala",
        "Majitha",
        "Rayya",
        "Tarn Taran",
      ],
      Barnala: ["Barnala", "Mehal Kalan", "Tapa"],
      Bathinda: ["Bathinda", "Sangat", "Talwandi Sabo", "Rampura Phul", "Maur"],
      Faridkot: ["Faridkot", "Jaito", "Kotkapura"],
      "Fatehgarh Sahib": [
        "Fatehgarh Sahib",
        "Amloh",
        "Bassi Pathana",
        "Khamanon",
        "Mandi Gobindgarh",
        "Sirhind",
      ],
      Fazilka: ["Fazilka", "Abohar", "Jalalabad"],
      Ferozepur: ["Ferozepur", "Fazilka", "Guru Har Sahai", "Zira", "Makhu"],
      Gurdaspur: [
        "Gurdaspur",
        "Batala",
        "Dera Baba Nanak",
        "Dhariwal",
        "Kahnuwan",
        "Kalanaur",
        "Pathankot",
        "Qadian",
        "Sri Hargobindpur",
        "Sujanpur",
      ],
      Hoshiarpur: [
        "Hoshiarpur",
        "Dasuya",
        "Garhshankar",
        "Hariana",
        "Mukerian",
        "Talwara",
      ],
      Jalandhar: [
        "Jalandhar-I",
        "Jalandhar-II",
        "Adampur",
        "Bhogpur",
        "Goraya",
        "Nakodar",
        "Phillaur",
        "Shahkot",
      ],
      Kapurthala: [
        "Kapurthala",
        "Bhulath",
        "Dhilwan",
        "Phagwara",
        "Sultanpur Lodhi",
      ],
      Ludhiana: [
        "Ludhiana East",
        "Ludhiana West",
        "Doraha",
        "Jagraon",
        "Khanna",
        "Payal",
        "Raikot",
        "Samrala",
      ],
      Mansa: ["Mansa", "Budhlada", "Sardulgarh"],
      Moga: ["Moga", "Baghapurana", "Dharamkot", "Nihal Singh Wala"],
      "Mohali (S.A.S Nagar)": ["Mohali", "Derabassi", "Kharar", "Kurali"],
      Muktsar: ["Muktsar", "Gidderbaha", "Malout"],
      Pathankot: ["Pathankot", "Dhar Kalan", "Sujanpur"],
      Patiala: ["Patiala", "Nabha", "Rajpura", "Patran", "Samana"],
      Rupnagar: [
        "Rupnagar",
        "Anandpur Sahib",
        "Chamkaur Sahib",
        "Morinda",
        "Nangal",
      ],
      Sangrur: [
        "Sangrur",
        "Ahmedgarh",
        "Barnala",
        "Bhawanigarh",
        "Dhuri",
        "Dirba",
        "Lehragaga",
        "Longowal",
        "Malerkotla",
        "Moonak",
        "Sunam",
      ],
      "Shaheed Bhagat Singh Nagar": [
        "Nawanshahr",
        "Balachaur",
        "Banga",
        "Garhshankar",
      ],
      "Tarn Taran": ["Tarn Taran", "Khadur Sahib", "Patti", "Khem Karan"],
    },
    "Himachal Pradesh": {
      Bilaspur: ["Bilaspur", "Ghumarwin", "Jhandutta", "Sadar"],
      Chamba: ["Chamba", "Bharmour", "Churah", "Dalhousie", "Pangi", "Salooni"],
      Hamirpur: ["Hamirpur", "Barsar", "Bhoranj", "Nadaun", "Sujanpur"],
      Kangra: [
        "Kangra",
        "Baijnath",
        "Baroh",
        "Dehra",
        "Dharamshala",
        "Fatehpur",
        "Indora",
        "Jawalamukhi",
        "Jaisinghpur",
        "Kangra",
        "Khundian",
        "Nurpur",
        "Palampur",
        "Pragpur",
        "Rakkar",
        "Shahpur",
        "Sulah",
      ],
      Kinnaur: ["Kinnaur", "Hangrang", "Kalpa", "Moorang", "Nichar", "Pooh"],
      Kullu: [
        "Kullu",
        "Ani",
        "Banjar",
        "Bhuntar",
        "Kullu",
        "Manali",
        "Naggar",
        "Nirmand",
      ],
      "Lahaul and Spiti": ["Lahaul", "Spiti", "Keylong", "Udaipur"],
      Mandi: [
        "Mandi",
        "Aut",
        "Balh",
        "Bali Chowki",
        "Chachiot",
        "Dharmpur",
        "Gohar",
        "Jogindernagar",
        "Karsog",
        "Padhar",
        "Sarkaghat",
        "Sundernagar",
        "Thunag",
      ],
      Shimla: [
        "Shimla",
        "Chirgaon",
        "Chopal",
        "Jubbal",
        "Kotkhai",
        "Kumarsain",
        "Nankhari",
        "Rampur",
        "Rohru",
        "Theog",
      ],
      Sirmaur: [
        "Sirmaur",
        "Nahan",
        "Pachhad",
        "Paonta Sahib",
        "Rajgarh",
        "Sangrah",
        "Shillai",
      ],
      Solan: ["Solan", "Arki", "Dharampur", "Kandaghat", "Kasauli", "Nalagarh"],
      Una: ["Una", "Amb", "Bangana", "Bharwain", "Gagret", "Haroli"],
    },
  };

  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");

  const resultsBySemester = useMemo(() => {
    const sorted = [...rawResults].sort(
      (a, b) =>
        Number(a.Subject?.semesterNumber || 0) -
        Number(b.Subject?.semesterNumber || 0),
    );
    return sorted.reduce((acc, res) => {
      const sem = res.Subject?.semesterNumber ?? "Unknown";
      (acc[sem] = acc[sem] || []).push(res);
      return acc;
    }, {});
  }, [rawResults]);

  const getCategoryColor = (cat) => {
    switch (cat) {
      case "GENERAL":
        return "blue";
      case "OBC":
        return "orange";
      case "SC":
        return "green";
      case "ST":
        return "purple";
      default:
        return "default";
    }
  };

  const getPlacementStatusColor = (status) => {
    switch (status) {
      case "ACCEPTED":
        return "success";
      case "JOINED":
        return "green";
      case "OFFERED":
        return "processing";
      case "REJECTED":
        return "error";
      default:
        return "default";
    }
  };

  const getInternshipStatusColor = (status) => {
    const statusColors = {
      APPLIED: "blue",
      UNDER_REVIEW: "orange",
      SELECTED: "green",
      REJECTED: "red",
      JOINED: "purple",
      COMPLETED: "cyan",
    };
    return statusColors[status] || "default";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Fetch profile using Redux with caching
  const fetchStudent = useCallback(
    (forceRefresh = false) => {
      dispatch(fetchStudentProfile({ forceRefresh }));
    },
    [dispatch],
  );

  // Check for incomplete profile and show toast
  useEffect(() => {
    if (!student || toastShownRef.current) return;

    const requiredFields = [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "contact", label: "Contact" },
      { key: "parentName", label: "Parent Name" },
      { key: "parentContact", label: "Parent Contact" },
      { key: "gender", label: "Gender" },
      { key: "pinCode", label: "Pin Code" },
      { key: "address", label: "Address" },
      { key: "city", label: "City/Village" },
      { key: "state", label: "State" },
      { key: "tehsil", label: "Tehsil" },
      { key: "district", label: "District" },
      { key: "category", label: "Category" },
    ];

    const missingFields = requiredFields.filter(
      (field) =>
        !student[field.key] || student[field.key].toString().trim() === "",
    );

    if (missingFields.length > 0) {
      const toastId = toast.error(
        (t) => (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <span>Please complete your profile!</span>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "18px",
                padding: "0",
              }}
            >
              ✕
            </button>
          </div>
        ),
        {
          duration: Infinity,
          position: "top-right",
          style: {
            fontWeight: "bold",
            padding: "16px",
            borderRadius: "8px",
            minWidth: "300px",
          },
          icon: "⚠️",
        },
      );
      toastShownRef.current = toastId;
    }
  }, [student]);

  const fetchDocuments = async () => {
    try {
      const res = await API.get("/student/documents");
      const docs = res.data?.documents || res.data?.data || res.data || [];
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setDocuments([]);
    }
  };

  useEffect(() => {
    // Fetch profile using Redux (will use cache if valid)
    fetchStudent();
    fetchDocuments();
  }, [fetchStudent]);

  const handleEditSubmit = async (values) => {
    try {
      setImageUploading(true);

      // Step 1: Update profile data using Redux (text fields)
      await dispatch(updateProfile(values)).unwrap();

      // Step 2: Upload profile image if provided
      if (profileImageList.length > 0 && profileImageList[0].originFileObj) {
        const formData = new FormData();
        formData.append("file", profileImageList[0].originFileObj);

        await API.post(`/student/profile/image`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        // Force refresh to get updated profile image
        fetchStudent(true);
      }

      toast.success("Profile updated successfully", {
        duration: 4000,
        position: "top-center",
      });
      setIsModalOpen(false);
      setProfileImageList([]);
    } catch (error) {
      console.error("Update error:", error);
      toast.error(
        error.response?.data?.message ||
          error?.message ||
          "Failed to update profile",
        { duration: 5000, position: "top-center" },
      );
    } finally {
      setImageUploading(false);
    }
  };

  const openEditModal = () => {
    if (toastShownRef.current) {
      toast.dismiss(toastShownRef.current);
      toastShownRef.current = false;
    }

    form.setFieldsValue({
      name: student?.user?.name || student.name,
      email: student?.user?.email || student.email,
      contact: student?.user?.phoneNo || student.contact,
      parentName: student.parentName,
      parentContact: student.parentContact,
      address: student.address,
      dob: student?.user?.dob
        ? student?.user?.dob.slice(0, 10)
        : student.dob
          ? student.dob.slice(0, 10)
          : null,
      city: student.city,
      state: student.state,
      pinCode: student.pinCode,
      tehsil: student.tehsil,
      gender: student.gender,
      district: student.district,
      tenthper: student.tenthper,
      twelthper: student.twelthper,
      rollNumber: student?.user?.rollNumber || student.rollNumber,
      admissionType: student.admissionType,
      category: student.category,
      batchId: student.batch?.id,
    });

    if (student.state) setSelectedState(student.state);
    if (student.district) setSelectedDistrict(student.district);
    setProfileImageList([]);
    setImageUploading(false);
    setIsModalOpen(true);
  };

  const openUploadModal = () => {
    uploadForm.resetFields();
    setFileList([]);
    setUploadModal(true);
  };

  const handleUpload = async (values) => {
    if (!fileList.length) return toast.error("Please select a file.");
    const formData = new FormData();
    formData.append("type", values.type);
    formData.append("file", fileList[0]);

    try {
      setUploading(true);
      await API.post("/student/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Document uploaded successfully");
      setUploadModal(false);
      fetchDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  if (loading || !student)
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: token.colorBgLayout }}
      >
        <Spin tip="Loading profile..." />
      </div>
    );

  if (error)
    return (
      <div
        className="p-8 text-center"
        style={{ backgroundColor: token.colorBgLayout }}
      >
        <Text type="danger">{error}</Text>
      </div>
    );

  // Info Card Component with optional masking support
  const InfoCard = ({
    icon,
    label,
    value,
    color = token.colorPrimary,
    maskedValue,
    onReveal,
  }) => (
    <div
      className="p-4 rounded-xl border flex items-center gap-3 transition-shadow hover:shadow-sm"
      style={{
        backgroundColor: token.colorBgContainer,
        borderColor: token.colorBorderSecondary,
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <Text
          className="text-[10px] uppercase font-semibold tracking-wider block"
          style={{ color: token.colorTextTertiary }}
        >
          {label}
        </Text>
        {maskedValue && onReveal ? (
          <MaskedField
            maskedValue={maskedValue}
            fieldName={label}
            onReveal={onReveal}
            className="text-sm font-medium"
            style={{ color: token.colorText }}
          />
        ) : (
          <Text
            className="text-sm font-medium block truncate"
            style={{ color: token.colorText }}
          >
            {value || "N/A"}
          </Text>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="p-4 md:p-6 min-h-screen overflow-y-auto hide-scrollbar"
      style={{ backgroundColor: token.colorBgLayout }}
    >
      <div className="max-w-7xl mx-auto !space-y-4 pb-8">
        {/* Header with Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <Title
              level={3}
              className="!mb-0 !text-xl font-semibold"
              style={{ color: token.colorText }}
            >
              My Profile
            </Title>
            <Text
              className="text-xs"
              style={{ color: token.colorTextSecondary }}
            >
              Manage your personal information
            </Text>
          </div>
          <div className="flex gap-2">
            <Button
              icon={<EditOutlined />}
              onClick={openEditModal}
              size="small"
              className="rounded-lg text-xs font-medium"
            >
              Edit
            </Button>
            <Button
              type="primary"
              onClick={openUploadModal}
              icon={<UploadOutlined />}
              size="small"
              className="rounded-lg text-xs font-medium"
            >
              Add Document
            </Button>
          </div>
        </div>

        {/* Profile Header Card - Compact */}
        <Card
          variant="borderless"
          className="rounded-xl shadow-sm border"
          style={{
            backgroundColor: token.colorBgContainer,
            borderColor: token.colorBorderSecondary,
          }}
          styles={{ body: { padding: "20px" } }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Avatar */}
            <div className="relative">
              <ProfileAvatar
                size={80}
                profileImage={student.profileImage}
                className="rounded-2xl border-2 shadow-md"
                style={{ borderColor: token.colorBgContainer }}
              />
              <div
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-md flex items-center justify-center border-2"
                style={{
                  backgroundColor:
                    (student.user?.active ?? student.isActive)
                      ? token.colorSuccess
                      : token.colorError,
                  borderColor: token.colorBgContainer,
                }}
              >
                {(student.user?.active ?? student.isActive) ? (
                  <CheckCircleOutlined
                    style={{ color: "#fff", fontSize: "11px" }}
                  />
                ) : (
                  <StopOutlined style={{ color: "#fff", fontSize: "11px" }} />
                )}
              </div>
            </div>

            {/* Name & Info */}
            <div className="flex-grow text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <Title
                  level={4}
                  className="!mb-0 font-semibold"
                  style={{ color: token.colorText }}
                >
                  {student?.user?.name || student.name}
                </Title>
                <Tag
                  className="rounded-md px-2 py-0 text-[10px] font-semibold uppercase m-0 border-0"
                  color="blue"
                >
                  {student?.user?.branch?.shortName ||
                    student?.branch?.shortName ||
                    student?.branchName ||
                    "N/A"}
                </Tag>
              </div>

              <div
                className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs mb-3"
                style={{ color: token.colorTextSecondary }}
              >
                <span className="flex items-center gap-1.5">
                  <IdcardOutlined
                    style={{ color: token.colorTextTertiary, fontSize: "12px" }}
                  />
                  {student?.user?.rollNumber || student.rollNumber}
                </span>
                <span
                  className="hidden sm:inline"
                  style={{ color: token.colorTextTertiary }}
                >
                  •
                </span>
                <span className="flex items-center gap-1.5">
                  <BankOutlined
                    style={{ color: token.colorTextTertiary, fontSize: "12px" }}
                  />
                  Batch {student.batch?.name || "N/A"}
                </span>
              </div>

              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5">
                <Tag
                  color={getCategoryColor(student.category)}
                  className="rounded-md text-[10px] font-semibold uppercase m-0 px-2 border-0"
                >
                  {student.category}
                </Tag>
                <Tag
                  className="rounded-md text-[10px] font-semibold uppercase m-0 px-2 border-0"
                  color="default"
                >
                  {student.admissionType}
                </Tag>
                {/* {student.clearanceStatus && (
                  <Tag
                    className="rounded-md text-[10px] font-semibold uppercase m-0 px-2 border-0"
                    color={student.clearanceStatus === "CLEARED" ? "success" : "warning"}
                  >
                    {student.clearanceStatus}
                  </Tag>
                )} */}
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Info Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <InfoCard
            icon={<MailOutlined className="text-base" />}
            label="Email"
            maskedValue={student?.user?.email || student.email}
            onReveal={handleRevealContact}
            color={token.colorPrimary}
          />
          <InfoCard
            icon={<PhoneOutlined className="text-base" />}
            label="Phone"
            maskedValue={student?.user?.phoneNo || student.contact}
            onReveal={handleRevealContact}
            color={token.colorSuccess}
          />
          <InfoCard
            icon={<CalendarOutlined className="text-base" />}
            label="Date of Birth"
            value={(student?.user?.dob || student.dob)?.slice(0, 10)}
            color={token.colorWarning}
          />
          <InfoCard
            icon={<TeamOutlined className="text-base" />}
            label="Parent Contact"
            maskedValue={student.parentContact}
            onReveal={handleRevealContact}
            color={token.colorWarning}
          />
        </div>

        {/* Tabs Container */}
        <Card
          variant="borderless"
          className="rounded-xl shadow-sm overflow-hidden border"
          style={{
            backgroundColor: token.colorBgContainer,
            borderColor: token.colorBorderSecondary,
          }}
          styles={{ body: { padding: 0 } }}
        >
          <Tabs
            defaultActiveKey="1"
            className="custom-tabs"
            items={[
              {
                key: "1",
                label: (
                  <span className="flex items-center text-xs font-medium">
                    <UserOutlined className="mr-1.5" /> Personal
                  </span>
                ),
                children: (
                  <div className="p-5">
                    <Row gutter={[16, 16]}>
                      {/* Basic Information */}
                      <Col xs={24} md={12}>
                        <div className="mb-3 flex items-center gap-2">
                          <UserOutlined style={{ color: token.colorPrimary }} />
                          <Text
                            className="text-xs font-semibold uppercase tracking-wide"
                            style={{ color: token.colorTextSecondary }}
                          >
                            Basic Information
                          </Text>
                        </div>
                        <div className="space-y-2">
                          <div
                            className="flex justify-between items-center p-3 rounded-lg"
                            style={{
                              backgroundColor: token.colorFillQuaternary,
                            }}
                          >
                            <Text
                              className="text-xs"
                              style={{ color: token.colorTextSecondary }}
                            >
                              Batch
                            </Text>
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: token.colorText }}
                            >
                              {student.batch?.name || "N/A"}
                            </Text>
                          </div>
                          <div
                            className="flex justify-between items-center p-3 rounded-lg"
                            style={{
                              backgroundColor: token.colorFillQuaternary,
                            }}
                          >
                            <Text
                              className="text-xs"
                              style={{ color: token.colorTextSecondary }}
                            >
                              Gender
                            </Text>
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: token.colorText }}
                            >
                              {student.gender || "N/A"}
                            </Text>
                          </div>
                          <div
                            className="flex justify-between items-center p-3 rounded-lg"
                            style={{
                              backgroundColor: token.colorFillQuaternary,
                            }}
                          >
                            <Text
                              className="text-xs"
                              style={{ color: token.colorTextSecondary }}
                            >
                              Date of Birth
                            </Text>
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: token.colorText }}
                            >
                              {(student?.user?.dob || student.dob)?.slice(
                                0,
                                10,
                              ) || "N/A"}
                            </Text>
                          </div>
                          <div
                            className="flex justify-between items-center p-3 rounded-lg"
                            style={{
                              backgroundColor: token.colorFillQuaternary,
                            }}
                          >
                            <Text
                              className="text-xs"
                              style={{ color: token.colorTextSecondary }}
                            >
                              Category
                            </Text>
                            <Tag
                              color={getCategoryColor(student.category)}
                              className="m-0 text-[10px] rounded-md border-0"
                            >
                              {student.category}
                            </Tag>
                          </div>
                          <div
                            className="flex justify-between items-center p-3 rounded-lg"
                            style={{
                              backgroundColor: token.colorFillQuaternary,
                            }}
                          >
                            <Text
                              className="text-xs"
                              style={{ color: token.colorTextSecondary }}
                            >
                              Admission Type
                            </Text>
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: token.colorText }}
                            >
                              {student.admissionType}
                            </Text>
                          </div>
                        </div>
                      </Col>

                      {/* Contact Information */}
                      <Col xs={24} md={12}>
                        <div className="mb-3 flex items-center gap-2">
                          <PhoneOutlined
                            style={{ color: token.colorSuccess }}
                          />
                          <Text
                            className="text-xs font-semibold uppercase tracking-wide"
                            style={{ color: token.colorTextSecondary }}
                          >
                            Contact Information
                          </Text>
                        </div>
                        <div className="space-y-2">
                          <div
                            className="flex justify-between items-start p-3 rounded-lg"
                            style={{
                              backgroundColor: token.colorFillQuaternary,
                            }}
                          >
                            <Text
                              className="text-xs shrink-0"
                              style={{ color: token.colorTextSecondary }}
                            >
                              Address
                            </Text>
                            <Text
                              className="text-xs font-semibold text-right max-w-[60%]"
                              style={{ color: token.colorText }}
                            >
                              {student.address || "N/A"}, {student.city},{" "}
                              {student.district}, {student.state} -{" "}
                              {student.pinCode}
                            </Text>
                          </div>
                          <div
                            className="flex justify-between items-center p-3 rounded-lg"
                            style={{
                              backgroundColor: token.colorFillQuaternary,
                            }}
                          >
                            <Text
                              className="text-xs"
                              style={{ color: token.colorTextSecondary }}
                            >
                              City/Village
                            </Text>
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: token.colorText }}
                            >
                              {student.city || "N/A"}
                            </Text>
                          </div>
                          <div
                            className="flex justify-between items-center p-3 rounded-lg"
                            style={{
                              backgroundColor: token.colorFillQuaternary,
                            }}
                          >
                            <Text
                              className="text-xs"
                              style={{ color: token.colorTextSecondary }}
                            >
                              Tehsil
                            </Text>
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: token.colorText }}
                            >
                              {student.tehsil || "N/A"}
                            </Text>
                          </div>
                          <div
                            className="flex justify-between items-center p-3 rounded-lg"
                            style={{
                              backgroundColor: token.colorFillQuaternary,
                            }}
                          >
                            <Text
                              className="text-xs"
                              style={{ color: token.colorTextSecondary }}
                            >
                              District
                            </Text>
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: token.colorText }}
                            >
                              {student.district || "N/A"}
                            </Text>
                          </div>
                          <div
                            className="flex justify-between items-center p-3 rounded-lg"
                            style={{
                              backgroundColor: token.colorFillQuaternary,
                            }}
                          >
                            <Text
                              className="text-xs"
                              style={{ color: token.colorTextSecondary }}
                            >
                              Parent/Guardian
                            </Text>
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: token.colorText }}
                            >
                              {student.parentName || "N/A"}
                            </Text>
                          </div>
                          {/* <div
                            className="flex justify-between items-center p-3 rounded-lg"
                            style={{
                              backgroundColor: token.colorFillQuaternary,
                            }}
                          >
                            <Text
                              className="text-xs"
                              style={{ color: token.colorTextSecondary }}
                            >
                              Parent Contact
                            </Text>
                            <MaskedField
                              maskedValue={student.parentContact}
                              fieldName="parentContact"
                              onReveal={handleRevealContact}
                              className="text-xs font-semibold"
                              style={{ color: token.colorText }}
                              placeholder="N/A"
                            />
                          </div> */}
                        </div>
                      </Col>
                    </Row>
                  </div>
                ),
              },
              {
                key: "2",
                label: (
                  <span className="flex items-center text-xs font-medium">
                    <FileTextOutlined className="mr-1.5" /> Documents
                  </span>
                ),
                children: (
                  <div className="p-5">
                    {documents.length > 0 ? (
                      <Row gutter={[12, 12]}>
                        {documents.map((doc, idx) => (
                          <Col xs={12} sm={8} md={6} key={doc.id || idx}>
                            <Card
                              hoverable
                              variant="borderless"
                              className="rounded-xl border overflow-hidden group"
                              style={{
                                backgroundColor: token.colorBgContainer,
                                borderColor: token.colorBorderSecondary,
                              }}
                              styles={{ body: { padding: "12px" } }}
                              onClick={() =>
                                openFileWithPresignedUrl(doc.fileUrl)
                              }
                            >
                              <div
                                className="h-28 rounded-lg flex items-center justify-center mb-2 overflow-hidden"
                                style={{
                                  backgroundColor: token.colorFillQuaternary,
                                }}
                              >
                                {doc.fileUrl?.toLowerCase().endsWith(".pdf") ? (
                                  <FileTextOutlined
                                    className="text-4xl"
                                    style={{ color: token.colorPrimary }}
                                  />
                                ) : (
                                  <img
                                    src={getImageUrl(doc.fileUrl)}
                                    alt={doc.fileName || doc.type}
                                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      e.target.parentNode.innerHTML =
                                        '<span style="font-size: 40px;">📄</span>';
                                    }}
                                  />
                                )}
                              </div>
                              <Text
                                className="text-[10px] uppercase font-semibold block truncate"
                                style={{ color: token.colorText }}
                              >
                                {(doc.type || "Document").replaceAll("_", " ")}
                              </Text>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    ) : (
                      <div
                        className="py-12 text-center rounded-xl border border-dashed"
                        style={{ borderColor: token.colorBorderSecondary }}
                      >
                        <Empty
                          description={false}
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                        <Text
                          className="text-xs block mt-2"
                          style={{ color: token.colorTextSecondary }}
                        >
                          No documents uploaded
                        </Text>
                        <Button
                          type="primary"
                          onClick={openUploadModal}
                          size="small"
                          className="mt-4 rounded-lg text-xs"
                        >
                          Upload Document
                        </Button>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "3",
                label: (
                  <span className="flex items-center text-xs font-medium">
                    <LaptopOutlined className="mr-1.5" /> Internships
                  </span>
                ),
                children: (
                  <div className="p-5">
                    {(student.internshipApplications || []).length > 0 ? (
                      <Row gutter={[12, 12]}>
                        {(student.internshipApplications || [])
                          .sort(
                            (a, b) =>
                              new Date(b.appliedDate) - new Date(a.appliedDate),
                          )
                          .map((app, i) => {
                            const isSelf = !app.internshipId || !app.internship;
                            return (
                              <Col xs={24} sm={12} key={i}>
                                <div
                                  className="p-4 rounded-xl border"
                                  style={{
                                    backgroundColor: token.colorBgContainer,
                                    borderColor: token.colorBorderSecondary,
                                  }}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1 min-w-0">
                                      {isSelf && (
                                        <Tag
                                          className="m-0 mb-1.5 text-[9px] rounded-md border-0"
                                          color="purple"
                                        >
                                          Self-Identified
                                        </Tag>
                                      )}
                                      <Title
                                        level={5}
                                        className="!mb-0 !text-sm font-semibold truncate"
                                        style={{ color: token.colorText }}
                                      >
                                        {isSelf
                                          ? app.jobProfile || app.companyName
                                          : app.internship?.title}
                                      </Title>
                                      {isSelf && app.companyName && (
                                        <Text 
                                          className="text-[11px] block mt-0.5 truncate" 
                                          style={{ color: token.colorTextTertiary }}
                                        >
                                          {app.companyName}
                                        </Text>
                                      )}
                                      {!isSelf && app.internship?.industry?.companyName && (
                                        <Text 
                                          className="text-[11px] block mt-0.5 truncate" 
                                          style={{ color: token.colorTextTertiary }}
                                        >
                                          {app.internship.industry.companyName}
                                        </Text>
                                      )}
                                    </div>
                                    <Tag
                                      color={getInternshipStatusColor(
                                        app.status,
                                      )}
                                      className="m-0 text-[10px] rounded-md shrink-0 border-0"
                                    >
                                      {app.status}
                                    </Tag>
                                  </div>

                                  <div
                                    className="flex gap-4 pt-2 mt-2 border-t text-xs"
                                    style={{
                                      borderColor: token.colorBorderSecondary,
                                      color: token.colorTextSecondary,
                                    }}
                                  >
                                    <div className="flex-1">
                                      <span
                                        className="text-[10px] uppercase block mb-0.5"
                                        style={{
                                          color: token.colorTextTertiary,
                                        }}
                                      >
                                        Duration
                                      </span>
                                      <span className="font-medium">
                                        {(() => {
                                          if (app.internshipDuration) return app.internshipDuration;
                                          if (app.internship?.duration) return app.internship.duration;
                                          if (app.startDate && app.endDate) {
                                            const start = new Date(app.startDate);
                                            const end = new Date(app.endDate);
                                            const months = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30));
                                            return months > 0 ? `${months} months` : 'N/A';
                                          }
                                          return 'N/A';
                                        })()}
                                      </span>
                                    </div>
                                    <div className="flex-1">
                                      <span
                                        className="text-[10px] uppercase block mb-0.5"
                                        style={{
                                          color: token.colorTextTertiary,
                                        }}
                                      >
                                        Applied
                                      </span>
                                      <span className="font-medium">
                                        {formatDate(app.appliedDate || app.createdAt || app.applicationDate)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </Col>
                            );
                          })}
                      </Row>
                    ) : (
                      <div
                        className="py-12 text-center rounded-xl border border-dashed"
                        style={{ borderColor: token.colorBorderSecondary }}
                      >
                        <Empty
                          description={
                            <span
                              className="text-xs"
                              style={{ color: token.colorTextSecondary }}
                            >
                              No internship history
                            </span>
                          }
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      {/* Edit Modal */}
      <Modal
        title={
          <span
            className="text-base font-semibold"
            style={{ color: token.colorText }}
          >
            Edit Profile
          </span>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={imageUploading}
        onOk={() => form.submit()}
        width={640}
        className="rounded-xl"
        styles={{ content: { borderRadius: "16px", padding: "20px" } }}
        footer={[
          <Button
            key="back"
            onClick={() => setIsModalOpen(false)}
            className="rounded-lg h-9 text-xs"
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={imageUploading}
            onClick={() => form.submit()}
            className="rounded-lg h-9 text-xs font-medium"
          >
            Save Changes
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEditSubmit}
          className="mt-4"
        >
          <Row gutter={16}>
            {/* Profile Image Upload */}
            <Col span={24}>
              <Form.Item
                label={
                  <span
                    className="text-xs font-medium"
                    style={{ color: token.colorTextSecondary }}
                  >
                    Profile Image
                  </span>
                }
              >
                <div
                  className="flex items-center gap-4 p-3 rounded-xl"
                  style={{ backgroundColor: token.colorFillQuaternary }}
                >
                  <ProfileAvatar
                    size={56}
                    profileImage={student?.profileImage}
                    className="border-2"
                    style={{ borderColor: token.colorBgContainer }}
                  />
                  <ImgCrop
                    rotationSlider
                    aspect={1}
                    quality={0.8}
                    modalTitle="Crop Image"
                  >
                    <Upload
                      listType="picture-card"
                      fileList={profileImageList}
                      onChange={({ fileList: newFileList }) =>
                        setProfileImageList(newFileList)
                      }
                      beforeUpload={(file) => {
                        const isJpgOrPng =
                          file.type === "image/jpeg" ||
                          file.type === "image/jpg" ||
                          file.type === "image/png";
                        if (!isJpgOrPng) {
                          toast.error("Only JPG/PNG files allowed!");
                          return Upload.LIST_IGNORE;
                        }
                        const isLt2M = file.size / 1024 / 1024 < 2;
                        if (!isLt2M) {
                          toast.error("Image must be < 2MB!");
                          return Upload.LIST_IGNORE;
                        }
                        return false;
                      }}
                      maxCount={1}
                      className="avatar-uploader"
                    >
                      {profileImageList.length < 1 && (
                        <div
                          className="flex flex-col items-center text-xs"
                          style={{ color: token.colorTextTertiary }}
                        >
                          <CameraOutlined className="mb-1" />
                          <span>Upload</span>
                        </div>
                      )}
                    </Upload>
                  </ImgCrop>
                </div>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="name"
                label={<span className="text-xs font-medium">Name</span>}
                rules={[{ required: true }]}
              >
                <Input
                  prefix={
                    <UserOutlined style={{ color: token.colorTextTertiary }} />
                  }
                  className="rounded-lg h-9 text-xs"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label={<span className="text-xs font-medium">Email</span>}
                rules={[{ required: true, type: "email" }]}
              >
                <Input
                  prefix={
                    <MailOutlined style={{ color: token.colorTextTertiary }} />
                  }
                  className="rounded-lg h-9 text-xs"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contact"
                label={<span className="text-xs font-medium">Contact</span>}
                rules={[{ required: true }]}
              >
                <Input
                  prefix={
                    <PhoneOutlined style={{ color: token.colorTextTertiary }} />
                  }
                  className="rounded-lg h-9 text-xs"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="category"
                label={<span className="text-xs font-medium">Category</span>}
                rules={[{ required: true }]}
              >
                <Select placeholder="Select" className="h-9 rounded-lg text-xs">
                  <Option value="GENERAL">General</Option>
                  <Option value="SC">SC</Option>
                  <Option value="ST">ST</Option>
                  <Option value="OBC">OBC</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="parentName"
                label={<span className="text-xs font-medium">Parent Name</span>}
                rules={[{ required: true }]}
              >
                <Input
                  prefix={
                    <TeamOutlined style={{ color: token.colorTextTertiary }} />
                  }
                  className="rounded-lg h-9 text-xs"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="parentContact"
                label={
                  <span className="text-xs font-medium">Parent Contact</span>
                }
                rules={[{ required: true }]}
              >
                <Input
                  prefix={
                    <PhoneOutlined style={{ color: token.colorTextTertiary }} />
                  }
                  className="rounded-lg h-9 text-xs"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="gender"
                label={<span className="text-xs font-medium">Gender</span>}
                rules={[{ required: true }]}
              >
                <Select placeholder="Select" className="h-9 rounded-lg text-xs">
                  <Option value="Male">Male</Option>
                  <Option value="Female">Female</Option>
                  <Option value="Others">Others</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dob"
                label={
                  <span className="text-xs font-medium">Date of Birth</span>
                }
              >
                <Input type="date" className="rounded-lg h-9 text-xs" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="pinCode"
                label={<span className="text-xs font-medium">Pin Code</span>}
                rules={[{ required: true }]}
              >
                <Input className="rounded-lg h-9 text-xs" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="address"
                label={<span className="text-xs font-medium">Address</span>}
                rules={[{ required: true }]}
              >
                <Input className="rounded-lg h-9 text-xs" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="city"
                label={
                  <span className="text-xs font-medium">City/Village</span>
                }
                rules={[{ required: true }]}
              >
                <Input className="rounded-lg h-9 text-xs" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="state"
                label={<span className="text-xs font-medium">State</span>}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder="Select State"
                  showSearch
                  className="h-9 rounded-lg text-xs"
                  filterOption={(input, option) =>
                    option.children
                      .toLowerCase()
                      .indexOf(input.toLowerCase()) >= 0
                  }
                  onChange={(value) => {
                    setSelectedState(value);
                    setSelectedDistrict("");
                    form.setFieldsValue({
                      district: undefined,
                      tehsil: undefined,
                    });
                  }}
                >
                  {Object.keys(stateDistrictTehsilData)
                    .sort()
                    .map((state) => (
                      <Option key={state} value={state}>
                        {state}
                      </Option>
                    ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="district"
                label={<span className="text-xs font-medium">District</span>}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder={
                    selectedState ? "Select District" : "Select State First"
                  }
                  disabled={!selectedState}
                  showSearch
                  className="h-9 rounded-lg text-xs"
                  filterOption={(input, option) =>
                    option.children
                      .toLowerCase()
                      .indexOf(input.toLowerCase()) >= 0
                  }
                  onChange={(value) => {
                    setSelectedDistrict(value);
                    form.setFieldsValue({ tehsil: undefined });
                  }}
                >
                  {selectedState &&
                    Object.keys(stateDistrictTehsilData[selectedState] || {})
                      .sort()
                      .map((district) => (
                        <Option key={district} value={district}>
                          {district}
                        </Option>
                      ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tehsil"
                label={<span className="text-xs font-medium">Tehsil</span>}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder={
                    selectedDistrict ? "Select Tehsil" : "Select District First"
                  }
                  disabled={!selectedDistrict}
                  showSearch
                  className="h-9 rounded-lg text-xs"
                  filterOption={(input, option) =>
                    option.children
                      .toLowerCase()
                      .indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {selectedState &&
                    selectedDistrict &&
                    stateDistrictTehsilData[selectedState]?.[
                      selectedDistrict
                    ]?.map((tehsil) => (
                      <Option key={tehsil} value={tehsil}>
                        {tehsil}
                      </Option>
                    ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Upload Document Modal */}
      <Modal
        title={
          <span
            className="text-base font-semibold"
            style={{ color: token.colorText }}
          >
            Upload Document
          </span>
        }
        open={uploadModal}
        onCancel={() => setUploadModal(false)}
        onOk={() => uploadForm.submit()}
        className="rounded-xl"
        styles={{ content: { borderRadius: "16px", padding: "20px" } }}
        footer={[
          <Button
            key="back"
            onClick={() => setUploadModal(false)}
            className="rounded-lg h-9 text-xs"
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={uploading}
            onClick={() => uploadForm.submit()}
            className="rounded-lg h-9 text-xs font-medium"
          >
            Upload
          </Button>,
        ]}
      >
        <Form
          form={uploadForm}
          layout="vertical"
          onFinish={handleUpload}
          className="mt-4"
        >
          <Form.Item
            name="type"
            label={<span className="text-xs font-medium">Document Type</span>}
            rules={[{ required: true }]}
          >
            <Select
              placeholder="Select type"
              className="h-9 rounded-lg text-xs"
            >
              <Option value="MARKSHEET_10TH">10th Marksheet</Option>
              <Option value="MARKSHEET_12TH">12th Marksheet</Option>
              <Option value="CASTE_CERTIFICATE">Caste Certificate</Option>
              <Option value="PHOTO">Photo</Option>
              <Option value="OTHER">Other</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label={<span className="text-xs font-medium">Upload File</span>}
          >
            <Upload
              beforeUpload={(file) => {
                const isUnderLimit = file.size / 1024 <= 200;
                if (!isUnderLimit) {
                  toast.error("File must be < 200KB.");
                  return Upload.LIST_IGNORE;
                }
                setFileList([file]);
                return false;
              }}
              fileList={fileList}
              onRemove={() => setFileList([])}
              maxCount={1}
              listType="picture"
              className="w-full"
            >
              <Button
                loading={uploading}
                icon={<UploadOutlined />}
                className="w-full h-10 rounded-lg border-dashed text-xs"
              >
                Select File (Max 200KB)
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
