// src/pages/industry/ManageInternships.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Tag,
  Space,
  Typography,
  Input,
  Select,
  Row,
  Col,
  Modal,
  message,
  Dropdown,
  Progress,
  Tooltip,
  List,
  Avatar,
  Descriptions,
  Divider,
  Empty,
  Statistic,
  Tabs,
  Table,
  Alert,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  StopOutlined,
  PlayCircleOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  TeamOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  BankOutlined,
  ContactsOutlined,
  ShopOutlined,
  StarOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import API from "../../../services/api";
import Layouts from "../../../components/Layout";
import Paragraph from "antd/es/skeleton/Paragraph";
import { toast } from "react-hot-toast";
import EditInternshipModal from "../../../components/EditInternshipModal";
import { useDispatch, useSelector } from "react-redux";
import {
  selectIndustryError,
  selectIndustryLoading,
  selectIndustryProfile,
  setIndustryProfile,
} from "../store/industrySlice";
import { useSmartIndustry } from "../../../hooks";
import { useDebounce } from "../../../hooks/useDebounce";
const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;
const { confirm } = Modal;
const { TabPane } = Tabs;

const ManageInternships = () => {
  const dispatch = useDispatch();

  // Use smart fetching hook
  const { data: profile, loading, error, isStale, forceRefresh, clearError } =
    useSmartIndustry();

  // const [loading, setLoading] = useState(true);
  // const [internships, setInternships] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebounce(searchText, 300);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [activeTab, setActiveTab] = useState("1");
  const navigate = useNavigate();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  // Get internships from Redux profile
  const internships = profile?.internships || [];
  useEffect(() => {
    filterData();
  }, [debouncedSearchText, statusFilter, internships]);

  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // useEffect(() => {
  //   // Auto-select first internship when data loads
  //   if (filteredData.length > 0 && !selectedInternship) {
  //     setSelectedInternship(filteredData[0]);
  //   }
  // }, [filteredData]);

  // const fetchInternships = async () => {
  //   setLoading(true);
  //   try {
  //     const response = await API.get("/industries/profile");
  //     const internshipsFromProfile = response.data.internships;
  //     setInternships(internshipsFromProfile);
  //     await new Promise((resolve) => setTimeout(resolve, 1000));
  //   } catch (error) {
  //     toast.error("Error fetching internships");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const filterData = () => {
    let filtered = internships;

    if (debouncedSearchText) {
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
          item.fieldOfWork.toLowerCase().includes(debouncedSearchText.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    setFilteredData(filtered);
  };

  const handleStatusChange = async (id, newStatus) => {
    setActionLoading(id);
    try {
      await API.patch(`/internships/${id}/status`, { status: newStatus });
      // Update Redux store
      const updatedProfile = {
        ...profile,
        internships: profile.internships.map((item) =>
          item.id === id ? { ...item, status: newStatus } : item
        ),
      };
      dispatch(setIndustryProfile(updatedProfile));

      // Update selected internship if it's the one being changed
      if (selectedInternship && selectedInternship.id === id) {
        setSelectedInternship((prev) => ({ ...prev, status: newStatus }));
      }

      toast.success(`Internship ${newStatus.toLowerCase()} successfully`);
    } catch (error) {
      toast.error("Failed to update internship status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = (id, title) => {
    confirm({
      title: 'Delete Internship',
      content: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      confirmLoading: actionLoading === id,
      onOk: async () => {
        setActionLoading(id);
        try {
          const industryId = profile.id;
          await API.delete(`/internships/${id}`, { data: { industryId } });
          const updatedProfile = {
            ...profile,
            internships: profile.internships.filter((item) => item.id !== id),
          };
          dispatch(setIndustryProfile(updatedProfile));

          if (selectedInternship && selectedInternship.id === id) {
            const remaining = filteredData.filter((item) => item.id !== id);
            setSelectedInternship(remaining.length > 0 ? remaining[0] : null);
          }
          toast.success(`"${title}" deleted successfully`);
        } catch (error) {
          toast.error("Failed to delete internship");
          throw error;
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      ACTIVE: "green",
      INACTIVE: "orange",
      COMPLETED: "blue",
      CANCELLED: "red",
    };
    return colors[status] || "default";
  };

  const getStatusIcon = (status) => {
    const icons = {
      ACTIVE: <CheckCircleOutlined />,
      INACTIVE: <ClockCircleOutlined />,
      COMPLETED: <CheckCircleOutlined />,
      CANCELLED: <ClockCircleOutlined />,
    };
    return icons[status] || <ClockCircleOutlined />;
  };

  const handleEdit = (internship) => {
    setSelectedInternship(internship);
    setEditModalVisible(true);
  };

  const handleEditSuccess = (updatedInternship) => {
    // Update Redux store immediately
    const updatedProfile = {
      ...profile,
      internships: profile.internships.map((item) =>
        item.id === updatedInternship.id ? updatedInternship : item
      ),
    };
    dispatch(setIndustryProfile(updatedProfile));

    // Mark data as stale for other components
    dispatch(markDataStale());
    setSelectedInternship(updatedInternship);
    toast.success("Internship updated successfully!");
  };

  const getActionsMenu = (record) => ({
    items: [
      {
        key: "view",
        label: "View Applications",
        icon: <EyeOutlined />,
        onClick: () =>
          navigate(
            `/applications&internshipId=${record.id}`
          ),
        disabled: actionLoading === record.id,
      },
      {
        key: "edit",
        label: "Edit",
        icon: <EditOutlined />,
        onClick: () => handleEdit(record),
        disabled: record.status === "COMPLETED" || actionLoading === record.id,
      },
      {
        key: "divider1",
        type: "divider",
      },
      {
        key: "activate",
        label: record.status === "ACTIVE" ? "Deactivate" : "Activate",
        icon:
          record.status === "ACTIVE" ? (
            <StopOutlined />
          ) : (
            <PlayCircleOutlined />
          ),
        onClick: () =>
          handleStatusChange(
            record.id,
            record.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
          ),
        disabled: record.status === "COMPLETED" || actionLoading === record.id,
      },
      {
        key: "divider2",
        type: "divider",
      },
      {
        key: "delete",
        label: "Delete",
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => handleDelete(record.id, record.title),
        disabled: record.applications > 0 || actionLoading === record.id,
      },
    ],
  });

  // Calculate stats for selected internship
  const calculateStats = (internship) => {
    if (!internship) return null;

    const applications = internship.applications || [];
    const selectedCount = applications.filter(
      (app) => app.status === "SELECTED"
    ).length;
    const applicationRate =
      internship.numberOfPositions > 0
        ? Math.round((applications.length / internship.numberOfPositions) * 100)
        : 0;
    const selectionRate =
      applications.length > 0
        ? Math.round((selectedCount / applications.length) * 100)
        : 0;

    return {
      totalApplications: applications.length,
      selectedCount,
      applicationRate,
      selectionRate,
    };
  };

  const stats = calculateStats(selectedInternship);
  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Alert
          title="Error Loading Internships"
          description={error}
          type="error"
          showIcon
          className="mb-4"
        />
        <Button type="primary" onClick={forceRefresh} icon={<ReloadOutlined />}>
          Retry
        </Button>
      </div>
    );
  }

  // No profile state
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Empty
          description="No profile found. Please complete your company profile first."
          className="mb-4"
        />
        <Button
          type="primary"
          onClick={() => navigate("/company/profile")}
          icon={<UserOutlined />}
        >
          Complete Profile
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen overflow-hidden flex flex-col">
      <div className="max-w-[1600px] mx-auto w-full space-y-6 flex flex-col flex-1">
        {/* Stale data indicator */}
        {isStale && (
          <Alert
            title="Data update recommended"
            description="Your internship data might be outdated. Click refresh to sync latest changes."
            type="warning"
            showIcon
            action={
              <Button
                size="small"
                type="primary"
                onClick={forceRefresh}
                className="rounded-lg"
              >
                Refresh
              </Button>
            }
            className="rounded-xl border-warning/20 bg-warning-50/50 shadow-sm shrink-0"
          />
        )}

        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shrink-0">
          <div className="flex items-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm mr-3">
              <ShopOutlined className="text-lg" />
            </div>
            <div>
              <Title level={2} className="mb-0 text-text-primary text-2xl">
                Manage Internships
              </Title>
              <Paragraph className="text-text-secondary text-sm mb-0">
                Oversee your internship postings and track applicant engagement
              </Paragraph>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/postings">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                className="h-10 rounded-xl font-bold bg-primary border-0 shadow-lg shadow-primary/20"
              >
                New Posting
              </Button>
            </Link>
          </div>
        </div>

        <Row gutter={[24, 24]} className="flex-1 overflow-hidden">
          {/* Internships List - Left Column */}
          <Col
            xs={24}
            md={8}
            lg={7}
            xl={6}
            className="h-full flex flex-col min-h-[400px]"
          >
            <Card
              title={
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BankOutlined className="text-primary text-xs" />
                  </div>
                  <span className="text-text-primary font-bold text-base">Postings Directory</span>
                </div>
              }
              className="rounded-2xl border-border shadow-sm flex flex-col h-full overflow-hidden"
              styles={{ 
                body: { padding: '16px', flex: 1, overflowY: 'auto' },
                header: { padding: '16px', borderBottom: '1px solid var(--color-border)' }
              }}
            >
              <div className="space-y-3 mb-4">
                <Search
                  placeholder="Search role or field..."
                  className="rounded-xl h-11 bg-background border-border"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  prefix={<SearchOutlined className="text-text-tertiary" />}
                  allowClear
                />

                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  className="w-full h-11"
                  placeholder="Filter by status"
                >
                  <Option value="all">All Postings</Option>
                  <Option value="ACTIVE">Active</Option>
                  <Option value="INACTIVE">Inactive</Option>
                  <Option value="COMPLETED">Completed</Option>
                </Select>
              </div>

              <div className="space-y-2">
                {loading ? (
                  <div className="py-12 flex justify-center"><Spin size="small" /></div>
                ) : filteredData.length > 0 ? (
                  filteredData.map((internship) => (
                    <div
                      key={internship.id}
                      onClick={() => setSelectedInternship(internship)}
                      className={`
                        group cursor-pointer p-3 rounded-xl transition-all duration-200 border
                        ${selectedInternship?.id === internship.id
                          ? 'bg-primary/5 border-primary/20 shadow-sm'
                          : 'bg-surface border-transparent hover:bg-background-tertiary hover:border-border'
                        }
                      `}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <Text className={`font-bold block truncate leading-tight flex-1 mr-2 ${selectedInternship?.id === internship.id ? 'text-primary' : 'text-text-primary'}`}>
                          {internship.title}
                        </Text>
                        <Tag 
                          color={getStatusColor(internship.status)}
                          className="m-0 px-1.5 py-0 rounded-md border-0 text-[9px] font-black uppercase tracking-tighter shrink-0"
                        >
                          {internship.status}
                        </Tag>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ContactsOutlined className="text-[10px] text-text-tertiary" />
                          <Text className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">
                            {internship.applications?.length || 0} Applicants
                          </Text>
                        </div>
                        <Text className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">
                          {internship.numberOfPositions} Pos
                        </Text>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center opacity-50">
                    <Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    <Text className="text-text-tertiary text-xs mt-2 block">No results found</Text>
                  </div>
                )}
              </div>
            </Card>
          </Col>

          {/* Internship Details - Right Column */}
          <Col
            xs={24}
            md={16}
            lg={17}
            xl={18}
            className="h-full"
          >
            {selectedInternship ? (
              <div className="h-full flex flex-col space-y-6 overflow-y-auto hide-scrollbar pb-6">
                {/* Profile Header Card */}
                <Card 
                  className="rounded-2xl border-border shadow-sm bg-surface overflow-hidden shrink-0"
                  styles={{ body: { padding: '24px' } }}
                >
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                      <BankOutlined className="text-4xl text-primary" />
                    </div>
                    
                    <div className="flex-grow text-center md:text-left">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                        <Title level={3} className="!mb-0 !text-text-primary text-2xl font-black">
                          {selectedInternship.title}
                        </Title>
                        <Tag className="rounded-full px-3 py-0.5 bg-primary/10 text-primary border-primary/20 font-bold uppercase tracking-wider text-[10px]">
                          {selectedInternship.fieldOfWork}
                        </Tag>
                      </div>
                      
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 text-text-secondary text-sm">
                        <span className="flex items-center gap-1.5 font-medium">
                          <ClockCircleOutlined className="text-text-tertiary" /> {selectedInternship.duration}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-text-tertiary opacity-30" />
                        <span className="flex items-center gap-1.5 font-medium">
                          <EnvironmentOutlined className="text-text-tertiary" /> {selectedInternship.workLocation?.replace("_", " ") || "On-site"}
                        </span>
                        {selectedInternship.isStipendProvided && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-text-tertiary opacity-30" />
                            <span className="flex items-center gap-1.5 font-bold text-success-600">
                              <DollarOutlined /> ₹{selectedInternship.stipendAmount?.toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Dropdown
                        menu={getActionsMenu(selectedInternship)}
                        trigger={["click"]}
                        placement="bottomRight"
                        disabled={actionLoading === selectedInternship?.id}
                      >
                        <Button
                          type="text"
                          icon={<MoreOutlined className="text-xl" />}
                          className="hover:bg-background-tertiary rounded-xl w-10 h-10 flex items-center justify-center border border-transparent hover:border-border"
                          disabled={actionLoading === selectedInternship?.id}
                        />
                      </Dropdown>
                    </div>
                  </div>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                    <div className="p-4 rounded-2xl bg-background-tertiary/50 border border-border/50 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <ContactsOutlined />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-black text-text-tertiary tracking-widest leading-none mb-1">Apps</div>
                        <div className="text-lg font-black text-text-primary leading-none">{selectedInternship.applications?.length || 0}</div>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-background-tertiary/50 border border-border/50 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
                        <CheckCircleOutlined />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-black text-text-tertiary tracking-widest leading-none mb-1">Selected</div>
                        <div className="text-lg font-black text-text-primary leading-none">{stats?.selectedCount || 0}</div>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-background-tertiary/50 border border-border/50 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
                        <CalendarOutlined />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-black text-text-tertiary tracking-widest leading-none mb-1">Deadline</div>
                        <div className="text-sm font-bold text-text-primary leading-none">{dayjs(selectedInternship.applicationDeadline).format("DD MMM")}</div>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-background-tertiary/50 border border-border/50 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                        <TeamOutlined />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-black text-text-tertiary tracking-widest leading-none mb-1">Positions</div>
                        <div className="text-lg font-black text-text-primary leading-none">{selectedInternship.numberOfPositions}</div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Main Content Area */}
                <Card 
                  className="rounded-2xl border-border shadow-sm flex-1 overflow-hidden" 
                  styles={{ body: { padding: 0 } }}
                >
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    className="custom-tabs"
                    items={[
                      {
                        key: "1",
                        label: (
                          <span className="flex items-center px-4 py-3 font-bold text-xs uppercase tracking-widest">
                            <InfoCircleOutlined className="mr-2" /> Details
                          </span>
                        ),
                        children: (
                          <div className="p-6 space-y-8">
                            <div className="bg-background-tertiary/30 p-6 rounded-2xl border border-border/50">
                              <Title level={5} className="!mb-4 text-[10px] uppercase font-black text-text-tertiary tracking-widest flex items-center gap-2">
                                <FileTextOutlined className="text-primary" /> Internship Description
                              </Title>
                              <Paragraph className="text-text-primary text-base leading-relaxed mb-0">
                                {selectedInternship.description}
                              </Paragraph>
                              {selectedInternship.detailedDescription && (
                                <div className="mt-6 pt-6 border-t border-border/50">
                                  <Paragraph className="text-text-secondary text-sm leading-relaxed mb-0">
                                    {selectedInternship.detailedDescription}
                                  </Paragraph>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm">
                                <Title level={5} className="!mb-4 text-[10px] uppercase font-black text-text-tertiary tracking-widest">Work Information</Title>
                                <Descriptions column={1} size="small" colon={false}>
                                  <Descriptions.Item label={<Text className="text-text-tertiary font-medium w-24 block">Field</Text>}>
                                    <Text className="text-text-primary font-semibold">{selectedInternship.fieldOfWork}</Text>
                                  </Descriptions.Item>
                                  <Descriptions.Item label={<Text className="text-text-tertiary font-medium w-24 block">Location</Text>}>
                                    <Text className="text-text-primary font-semibold">{selectedInternship.workLocation?.replace("_", " ")}</Text>
                                  </Descriptions.Item>
                                </Descriptions>
                              </div>
                              <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm">
                                <Title level={5} className="!mb-4 text-[10px] uppercase font-black text-text-tertiary tracking-widest">Compensation</Title>
                                <div className="flex items-center gap-3">
                                  {selectedInternship.isStipendProvided ? (
                                    <div className="px-4 py-2 rounded-xl bg-success/10 text-success-700 font-black text-lg">
                                      ₹{selectedInternship.stipendAmount}
                                      <span className="text-[10px] ml-1 font-bold">/ MONTH</span>
                                    </div>
                                  ) : (
                                    <Tag className="rounded-lg px-4 py-1.5 font-bold uppercase tracking-widest border-0 bg-background-tertiary text-text-tertiary">UNPAID</Tag>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ),
                      },
                      {
                        key: "3",
                        label: (
                          <span className="flex items-center px-4 py-3 font-bold text-xs uppercase tracking-widest">
                            <UserOutlined className="mr-2" /> Applicants ({selectedInternship.applications?.length || 0})
                          </span>
                        ),
                        children: (
                          <div className="p-12 text-center max-w-lg mx-auto">
                            <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center mx-auto mb-6">
                              <ContactsOutlined className="text-3xl text-primary opacity-40" />
                            </div>
                            <Title level={4} className="text-text-primary !mb-2">Application Management</Title>
                            <Text className="text-text-tertiary block mb-10">
                              Review all {selectedInternship.applications?.length} applications received for this position. Filter, rate, and select the best candidates.
                            </Text>
                            <Button
                              type="primary"
                              size="large"
                              icon={<EyeOutlined />}
                              onClick={() => navigate(`/applications&internshipId=${selectedInternship.id}`)}
                              className="h-12 rounded-xl px-10 font-bold bg-primary border-0 shadow-lg shadow-primary/20"
                            >
                              Go to Applicants Hub
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </Card>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-surface rounded-2xl border border-dashed border-border p-12">
                <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center mb-6">
                  <ShopOutlined className="text-4xl text-primary opacity-20" />
                </div>
                <Title level={3} className="text-text-secondary !mb-2">Select Internship</Title>
                <Text className="text-text-tertiary text-center max-w-sm">
                  Choose an internship from the directory on the left to manage applicants and view engagement metrics.
                </Text>
              </div>
            )}
          </Col>
        </Row>
      </div>

      <EditInternshipModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        internship={selectedInternship}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default ManageInternships;

export default ManageInternships;