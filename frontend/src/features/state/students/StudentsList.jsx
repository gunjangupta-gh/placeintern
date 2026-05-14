import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Avatar,
  Select,
  Row,
  Col,
  Tooltip,
  Typography,
  Statistic,
  Drawer,
  Descriptions,
  Divider,
  Badge,
  Tabs,
  Progress,
  Timeline,
  Empty,
  Spin,
} from "antd";
import {
  SearchOutlined,
  UserOutlined,
  ReloadOutlined,
  FilterOutlined,
  ClearOutlined,
  PhoneOutlined,
  MailOutlined,
  BankOutlined,
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  DownloadOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  StarOutlined,
  TrophyOutlined,
  IdcardOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";
import { fetchAllStudents, fetchStudentsSummary } from "../store/stateSlice";
import stateService from "../../../services/state.service";
import dayjs from "dayjs";

const { Text, Title } = Typography;

const StudentsList = () => {
  const dispatch = useDispatch();
  const {
    list: students,
    loading,
    pagination,
    filters: availableFilters,
    summary,
    summaryLoading,
    currentMonth,
    currentYear,
  } = useSelector((state) => state.state.students);

  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState({
    institutionId: "",
    branchName: "",
    status: "",
    internshipStatus: "",
    mentorStatus: "",
    // reportStatus: "",
  });
  const [tableParams, setTableParams] = useState({
    page: 1,
    limit: 20,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState("overview");
  const [exporting, setExporting] = useState(false);

  const loadStudents = useCallback(
    (params = {}) => {
      dispatch(
        fetchAllStudents({
          page: tableParams.page,
          limit: tableParams.limit,
          search: searchText,
          ...filters,
          ...params,
        }),
      );
    },
    [dispatch, tableParams.page, tableParams.limit, searchText, filters],
  );

  useEffect(() => {
    loadStudents();
    dispatch(fetchStudentsSummary());
  }, []);

  const handleSearch = (value) => {
    setSearchText(value);
    setTableParams((prev) => ({ ...prev, page: 1 }));
    loadStudents({ search: value, page: 1 });
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setTableParams((prev) => ({ ...prev, page: 1 }));
    loadStudents({ ...filters, page: 1 });
  };

  const clearFilters = () => {
    setFilters({
      institutionId: "",
      branchName: "",
      status: "",
      internshipStatus: "",
      mentorStatus: "",
      // reportStatus: "",
    });
    setSearchText("");
    setTableParams((prev) => ({ ...prev, page: 1 }));
    loadStudents({ forceRefresh: true, page: 1 });
  };

  const handleTableChange = (paginationConfig) => {
    const newParams = {
      page: paginationConfig.current,
      limit: paginationConfig.pageSize,
    };
    setTableParams(newParams);
    loadStudents({ ...newParams, search: searchText, ...filters });
  };

  const handleViewStudent = (student) => {
    setSelectedStudent(student);
    setDrawerOpen(true);
    setDrawerTab("overview");
  };

  const handleExportToExcel = async () => {
    setExporting(true);
    try {
      // Fetch all students with current filters (no pagination)
      const allStudents = await stateService.getAllStudentsForExport({
        search: searchText,
        ...filters,
      });

      if (!allStudents?.length) {
        setExporting(false);
        return;
      }

      const exportData = allStudents.map((student) => ({
        "Student Name": student.name || "",
        "Roll Number": student.rollNumber || "",
        Email: student.email || "",
        Phone: student.phoneNo || "",
        "College Name": student.collegeName || "",
        "College Code": student.collegeCode || "",
        Branch: student.branch || "",
        Status: student.status || "",
        "Internship Status": student.internshipStatus || "",
        "Company Name": student.companyName || "",
        "Job Profile": student.jobProfile || "",
        Stipend: student.stipend || "",
        "Internship Start Date": student.startDate
          ? dayjs(student.startDate).format("DD-MM-YYYY")
          : "",
        "Internship End Date": student.endDate
          ? dayjs(student.endDate).format("DD-MM-YYYY")
          : "",
        "Mentor Name": student.mentorName || "",
        "Mentor Email": student.mentorEmail || "",
        "Mentor Phone": student.mentorPhone || "",
        "Joining Report": student.hasJoiningLetter ? "Submitted" : "Pending",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

      // Auto-size columns
      const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
        wch: Math.max(key.length, 15),
      }));
      worksheet["!cols"] = colWidths;

      const fileName = `Students_Directory_${dayjs().format("DD-MM-YYYY_HH-mm")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  const getStatusColor = (active) => {
    return active ? "green" : "red";
  };

  const getInternshipStatusColor = (status) => {
    const colors = {
      active: "green",
      completed: "blue",
      not_started: "orange",
      none: "default",
    };
    return colors[status] || "default";
  };

  const getInternshipStatusLabel = (status) => {
    const labels = {
      active: "Active",
      completed: "Completed",
      not_started: "Not Started",
      none: "No Internship",
    };
    return labels[status] || status;
  };

  const getReportStatusColor = (status) => {
    const colors = {
      submitted: "green",
      pending: "orange",
      not_submitted: "red",
    };
    return colors[status] || "default";
  };

  const getReportStatusLabel = (status) => {
    const labels = {
      submitted: "Submitted",
      pending: "Draft",
      not_submitted: "Not Submitted",
    };
    return labels[status] || status;
  };

  const columns = [
    {
      title: "Student",
      key: "student",
      render: (_, record) => (
        <Space>
          <Avatar size={32} icon={<UserOutlined />} />
          <div>
            <div className="font-medium text-sm">{record.name}</div>
            <div className="text-gray-500 text-xs">{record.rollNumber}</div>
          </div>
        </Space>
      ),
    },
    {
      title: "College",
      key: "college",
      render: (_, record) => (
        <div>
          <Tooltip title={record.institution?.name}>
            <div className="font-medium text-xs truncate max-w-[150px]">{record.institution?.name || "N/A"}</div>
          </Tooltip>
          <div className="text-gray-500 text-xs">{record.institution?.code}</div>
        </div>
      ),
    },
    {
      title: "Branch",
      dataIndex: "branchName",
      key: "branchName",
      width: 100,
      render: (text) => <span className="text-xs">{text || "-"}</span>,
    },
    {
      title: "Phone",
      dataIndex: "phoneNo",
      key: "phoneNo",
      width: 120,
      render: (text) => <span className="text-xs">{text || "N/A"}</span>,
    },
    {
      title: "Status",
      dataIndex: "active",
      key: "status",
      width: 80,
      render: (active) => (
        <Tag color={getStatusColor(active)} className="text-xs">
          {active ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Internship",
      key: "internshipStatus",
      width: 130,
      render: (_, record) => (
        <div>
          <Tag color={getInternshipStatusColor(record.internshipStatus)} className="text-xs">
            {getInternshipStatusLabel(record.internshipStatus)}
          </Tag>
          {record.internship?.companyName && (
            <div className="text-xs text-gray-500 mt-1 truncate max-w-[120px]">
              {record.internship.companyName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Mentor",
      key: "mentor",
      width: 120,
      render: (_, record) => (
        <div>
          {record.mentor ? (
            <>
              <div className="font-medium text-xs">{record.mentor.name}</div>
              {record.mentor.isCrossInstitution && (
                <Tag color="purple" className="text-xs mt-1">
                  External
                </Tag>
              )}
            </>
          ) : (
            <Tag color="red" className="text-xs">Unassigned</Tag>
          )}
        </div>
      ),
    },
    {
      title: "Joining Report",
      key: "joiningLetter",
      width: 100,
      render: (_, record) => (
        <Tag color={record.hasJoiningLetter ? "green" : "orange"} className="text-xs">
          {record.hasJoiningLetter ? "Submitted" : "Pending"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewStudent(record)}
        >
          View
        </Button>
      ),
    },
  ];

  const studentsList = Array.isArray(students) ? students : [];

  return (
    <div className="">
      <Card
        title="Students Directory"
        extra={
          <Space>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadStudents({ forceRefresh: true })}
            >
              Refresh
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportToExcel}
              loading={exporting}
            >
              {exporting ? "Exporting..." : "Export to Excel"}
            </Button>
          </Space>
        }
        variant="borderless"
      >
        {/* Search */}
        <div className="mb-4">
          <Input.Search
            placeholder="Search by name, roll number, email, or phone..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 350 }}
            allowClear
            enterButton
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-4 p-4 bg-gray-50 rounded">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Select
                  placeholder="Institution"
                  style={{ width: "100%" }}
                  allowClear
                  value={filters.institutionId || undefined}
                  onChange={(value) =>
                    handleFilterChange("institutionId", value || "")
                  }
                  showSearch
                  optionFilterProp="children"
                >
                  {availableFilters?.institutions?.map((inst) => (
                    <Select.Option key={inst.id} value={inst.id}>
                      {inst.name}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Select
                  placeholder="Branch"
                  style={{ width: "100%" }}
                  allowClear
                  value={filters.branchName || undefined}
                  onChange={(value) =>
                    handleFilterChange("branchName", value || "")
                  }
                  showSearch
                  optionFilterProp="children"
                >
                  {availableFilters?.branches?.map((branch) => (
                    <Select.Option key={branch} value={branch}>
                      {branch}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Select
                  placeholder="Status"
                  style={{ width: "100%" }}
                  allowClear
                  value={filters.status || undefined}
                  onChange={(value) =>
                    handleFilterChange("status", value || "")
                  }
                >
                  <Select.Option value="active">Active</Select.Option>
                  <Select.Option value="inactive">Inactive</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Select
                  placeholder="Internship Status"
                  style={{ width: "100%" }}
                  allowClear
                  value={filters.internshipStatus || undefined}
                  onChange={(value) =>
                    handleFilterChange("internshipStatus", value || "")
                  }
                >
                  <Select.Option value="with_internship">
                    With Internship
                  </Select.Option>
                  <Select.Option value="without_internship">
                    Without Internship
                  </Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Select
                  placeholder="Mentor Status"
                  style={{ width: "100%" }}
                  allowClear
                  value={filters.mentorStatus || undefined}
                  onChange={(value) =>
                    handleFilterChange("mentorStatus", value || "")
                  }
                >
                  <Select.Option value="assigned">Assigned</Select.Option>
                  <Select.Option value="unassigned">Unassigned</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={24} md={12} lg={4}>
                <Space>
                  <Button type="primary" onClick={applyFilters}>
                    Apply
                  </Button>
                  <Button icon={<ClearOutlined />} onClick={clearFilters}>
                    Clear
                  </Button>
                </Space>
              </Col>
            </Row>
          </div>
        )}

        <div className="custom-table">
          <Table
            columns={columns}
            dataSource={studentsList}
            loading={loading}
            rowKey="id"
            onChange={handleTableChange}
            scroll={{ x: 'max-content' }}
            size="small"
            pagination={{
              current: pagination?.page || tableParams.page,
              pageSize: pagination?.limit || tableParams.limit,
              total: pagination?.total || 0,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} students`,
            }}
          />
        </div>
      </Card>

      {/* Student Details Drawer */}
      <Drawer
        title={null}
        placement="right"
        width={480}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        styles={{ body: { padding: 0 } }}
      >
        {selectedStudent && (
          <div className="h-full flex flex-col bg-background">
            {/* Profile Header - Clean Design */}
            <div className="border-b border-border bg-surface !p-4">
              <div className="flex items-center !gap-3">
                <Avatar size={56} icon={<UserOutlined />} className="bg-primary/10 text-primary border border-border" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Title level={5} className="!mb-0 truncate">
                      {selectedStudent.name}
                    </Title>
                    <Tag color={getStatusColor(selectedStudent.active)} className="m-0 text-[10px]">
                      {selectedStudent.active ? "Active" : "Inactive"}
                    </Tag>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-text-secondary text-xs">
                    <span className="flex items-center gap-1">
                      <IdcardOutlined /> {selectedStudent.rollNumber}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="truncate">{selectedStudent.branchName || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-3 gap-2 !mt-3">
                <div className="bg-background rounded-lg p-2 text-center border border-border">
                  <div className={`text-sm font-bold ${selectedStudent.mentor ? "text-success" : "text-warning"}`}>
                    {selectedStudent.mentor ? "Assigned" : "None"}
                  </div>
                  <div className="text-[10px] text-text-tertiary">Mentor</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border">
                  <div className={`text-sm font-bold ${selectedStudent.hasJoiningLetter ? "text-success" : "text-warning"}`}>
                    {selectedStudent.hasJoiningLetter ? "Yes" : "No"}
                  </div>
                  <div className="text-[10px] text-text-tertiary">Joining Report</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border">
                  <Tag color={getReportStatusColor(selectedStudent.reportStatus)} className="m-0 text-[10px]">
                    {getReportStatusLabel(selectedStudent.reportStatus)}
                  </Tag>
                  <div className="text-[10px] text-text-tertiary mt-0.5">Monthly Report</div>
                </div>
              </div>
            </div>

            {/* Tabbed Content */}
            <Tabs
              activeKey={drawerTab}
              onChange={setDrawerTab}
              className="flex-1 overflow-auto"
              tabBarStyle={{ padding: "0 16px", marginBottom: 0 }}
              items={[
                {
                  key: "overview",
                  label: <span className="text-xs flex items-center gap-1"><UserOutlined /> Overview</span>,
                  children: (
                    <div className="!space-y-3 p-4">
                      {/* Contact Info */}
                      <Card size="small" className="rounded-lg" bodyStyle={{ padding: "12px" }}>
                        <div className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                          <PhoneOutlined className="text-primary" /> Contact
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] text-text-tertiary">Email</div>
                            <div className="text-xs font-medium truncate">{selectedStudent.email || "N/A"}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-text-tertiary">Phone</div>
                            <div className="text-xs font-medium">{selectedStudent.phoneNo || "N/A"}</div>
                          </div>
                        </div>
                      </Card>

                      {/* Academic Info */}
                      <Card size="small" className="rounded-lg" bodyStyle={{ padding: "12px" }}>
                        <div className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                          <BankOutlined className="text-blue-500" /> Academic
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] text-text-tertiary">Institution</div>
                            <div className="text-xs font-medium truncate">{selectedStudent.institution?.name || "N/A"}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-text-tertiary">Branch</div>
                            <div className="text-xs font-medium">{selectedStudent.branchName || "N/A"}</div>
                          </div>
                        </div>
                      </Card>

                      {/* Mentor Info */}
                      <Card size="small" className="rounded-lg" bodyStyle={{ padding: "12px" }}>
                        <div className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                          <TeamOutlined className="text-purple-500" /> Mentor
                        </div>
                        {selectedStudent.mentor ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-[10px] text-text-tertiary">Name</div>
                              <div className="text-xs font-medium flex items-center gap-1">
                                {selectedStudent.mentor.name}
                                {selectedStudent.mentor.isCrossInstitution && (
                                  <Tag color="purple" className="text-[9px] m-0 px-1 py-0">External</Tag>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-text-tertiary">Contact</div>
                              <div className="text-xs font-medium">{selectedStudent.mentor.phoneNo || "N/A"}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-warning flex items-center gap-1.5">
                            <ClockCircleOutlined /> No mentor assigned
                          </div>
                        )}
                      </Card>

                      {/* Activity */}
                      {selectedStudent.lastLoginAt && (
                        <Card size="small" className="rounded-lg" bodyStyle={{ padding: "12px" }}>
                          <div className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                            <CalendarOutlined className="text-green-500" /> Activity
                          </div>
                          <div className="text-xs">
                            <span className="text-text-tertiary">Last Login:</span>{" "}
                            <span className="font-medium">{dayjs(selectedStudent.lastLoginAt).format("DD MMM YYYY HH:mm")}</span>
                          </div>
                        </Card>
                      )}
                    </div>
                  ),
                },
                {
                  key: "internship",
                  label: <span className="text-xs flex items-center gap-1"><BankOutlined /> Internship</span>,
                  children: (
                    <div className="p-4">
                      {selectedStudent.internship ? (
                        <div className="!space-y-3">
                          {/* Internship Card */}
                          <Card size="small" className="rounded-lg border-success/30 bg-success/5" bodyStyle={{ padding: "12px" }}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-semibold text-success">
                                {selectedStudent.internship.companyName}
                              </div>
                              <Tag color={getInternshipStatusColor(selectedStudent.internshipStatus)} className="m-0 text-[10px]">
                                {getInternshipStatusLabel(selectedStudent.internshipStatus)}
                              </Tag>
                            </div>
                            <div className="text-xs text-text-secondary mb-2">
                              {selectedStudent.internship.jobProfile || "Job Profile N/A"}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <div className="text-text-tertiary text-[10px]">Stipend</div>
                                <div className="font-medium">
                                  {selectedStudent.internship.stipend
                                    ? `₹${selectedStudent.internship.stipend}/month`
                                    : "N/A"}
                                </div>
                              </div>
                              <div>
                                <div className="text-text-tertiary text-[10px]">Duration</div>
                                <div className="font-medium">
                                  {selectedStudent.internship.startDate && selectedStudent.internship.endDate
                                    ? `${dayjs(selectedStudent.internship.startDate).format("DD MMM")} - ${dayjs(selectedStudent.internship.endDate).format("DD MMM YYYY")}`
                                    : "N/A"}
                                </div>
                              </div>
                            </div>
                          </Card>

                          {/* Status Cards */}
                          <div className="grid grid-cols-2 gap-2">
                            <Card size="small" className="rounded-lg" bodyStyle={{ padding: "10px" }}>
                              <div className="text-[10px] text-text-tertiary mb-1">Joining Report</div>
                              <div className="flex items-center gap-1">
                                {selectedStudent.hasJoiningLetter ? (
                                  <>
                                    <CheckCircleOutlined className="text-success text-sm" />
                                    <span className="text-success text-xs font-medium">Submitted</span>
                                  </>
                                ) : (
                                  <>
                                    <ClockCircleOutlined className="text-warning text-sm" />
                                    <span className="text-warning text-xs font-medium">Pending</span>
                                  </>
                                )}
                              </div>
                            </Card>
                            <Card size="small" className="rounded-lg" bodyStyle={{ padding: "10px" }}>
                              <div className="text-[10px] text-text-tertiary mb-1">Monthly Report ({currentMonth}/{currentYear})</div>
                              <Tag color={getReportStatusColor(selectedStudent.reportStatus)} className="m-0 text-[10px]">
                                {getReportStatusLabel(selectedStudent.reportStatus)}
                              </Tag>
                            </Card>
                          </div>
                        </div>
                      ) : (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={<span className="text-xs text-text-tertiary">No internship assigned</span>}
                        />
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default StudentsList;
