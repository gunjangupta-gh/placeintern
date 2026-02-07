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
          <Avatar icon={<UserOutlined />} />
          <div>
            <div className="font-medium">{record.name}</div>
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
          <div className="font-medium">{record.institution?.name || "N/A"}</div>
          <div className="text-gray-500 text-xs">
            {record.institution?.code}
          </div>
        </div>
      ),
    },
    {
      title: "Branch",
      dataIndex: "branchName",
      key: "branchName",
      render: (text) => text || "-",
    },
    {
      title: "Phone",
      dataIndex: "phoneNo",
      key: "phoneNo",
      render: (text) => text || "N/A",
    },
    {
      title: "Status",
      dataIndex: "active",
      key: "status",
      render: (active) => (
        <Tag color={getStatusColor(active)}>
          {active ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Internship",
      key: "internshipStatus",
      render: (_, record) => (
        <div>
          <Tag color={getInternshipStatusColor(record.internshipStatus)}>
            {getInternshipStatusLabel(record.internshipStatus)}
          </Tag>
          {record.internship?.companyName && (
            <div className="text-xs text-gray-500 mt-1 truncate max-w-[130px]">
              {record.internship.companyName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Mentor",
      key: "mentor",
      render: (_, record) => (
        <div>
          {record.mentor ? (
            <>
              <div className="font-medium text-sm">{record.mentor.name}</div>
              {record.mentor.isCrossInstitution && (
                <Tag color="purple" className="text-xs mt-1">
                  External
                </Tag>
              )}
            </>
          ) : (
            <Tag color="red">Unassigned</Tag>
          )}
        </div>
      ),
    },
    {
      title: "Joining Report",
      key: "joiningLetter",
      render: (_, record) => (
        <Tag color={record.hasJoiningLetter ? "green" : "orange"}>
          {record.hasJoiningLetter ? "Submitted" : "Pending"}
        </Tag>
      ),
    },
  ];

  const studentsList = Array.isArray(students) ? students : [];

  return (
    <>
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

        <Table
          columns={columns}
          dataSource={studentsList}
          loading={loading}
          rowKey="id"
          onChange={handleTableChange}
          scroll={{ x: 1400 }}
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
      </Card>

      {/* Student Details Drawer */}
      <Drawer
        title="Student Details"
        placement="right"
        width={500}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        {selectedStudent && (
          <div>
            <div className="text-center mb-6">
              <Avatar size={80} icon={<UserOutlined />} />
              <Title level={4} className="mt-3 mb-1">
                {selectedStudent.name}
              </Title>
              <Text type="secondary">{selectedStudent.rollNumber}</Text>
              <div className="mt-2">
                <Tag color={getStatusColor(selectedStudent.active)}>
                  {selectedStudent.active ? "Active" : "Inactive"}
                </Tag>
              </div>
            </div>

            <Divider>Contact Information</Divider>
            <Descriptions column={1} size="small">
              <Descriptions.Item
                label={
                  <>
                    <MailOutlined /> Email
                  </>
                }
              >
                {selectedStudent.email || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <>
                    <PhoneOutlined /> Phone
                  </>
                }
              >
                {selectedStudent.phoneNo || "N/A"}
              </Descriptions.Item>
            </Descriptions>

            <Divider>Academic Information</Divider>
            <Descriptions column={1} size="small">
              <Descriptions.Item
                label={
                  <>
                    <BankOutlined /> Institution
                  </>
                }
              >
                {selectedStudent.institution?.name || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Branch">
                {selectedStudent.branchName || "N/A"}
              </Descriptions.Item>
            </Descriptions>

            {selectedStudent.mentor && (
              <>
                <Divider>Mentor</Divider>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Name">
                    {selectedStudent.mentor.name}
                    {selectedStudent.mentor.isCrossInstitution && (
                      <Tag color="purple" className="ml-2">
                        External
                      </Tag>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {selectedStudent.mentor.email || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Phone">
                    {selectedStudent.mentor.phoneNo || "N/A"}
                  </Descriptions.Item>
                  {selectedStudent.mentor.institution && (
                    <Descriptions.Item label="Institution">
                      {selectedStudent.mentor.institution.name}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </>
            )}

            {selectedStudent.internship && (
              <>
                <Divider>Internship</Divider>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Company">
                    {selectedStudent.internship.companyName || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Job Profile">
                    {selectedStudent.internship.jobProfile || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Stipend">
                    {selectedStudent.internship.stipend
                      ? `${selectedStudent.internship.stipend}/month`
                      : "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Duration">
                    {selectedStudent.internship.startDate &&
                    selectedStudent.internship.endDate
                      ? `${dayjs(selectedStudent.internship.startDate).format("DD MMM YYYY")} - ${dayjs(selectedStudent.internship.endDate).format("DD MMM YYYY")}`
                      : "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag
                      color={getInternshipStatusColor(
                        selectedStudent.internshipStatus,
                      )}
                    >
                      {getInternshipStatusLabel(
                        selectedStudent.internshipStatus,
                      )}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Joining Letter">
                    <Tag
                      color={
                        selectedStudent.hasJoiningLetter ? "green" : "orange"
                      }
                    >
                      {selectedStudent.hasJoiningLetter
                        ? "Uploaded"
                        : "Pending"}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}

            <Divider>Monthly Report</Divider>
            <Descriptions column={1} size="small">
              <Descriptions.Item
                label={`Status (${currentMonth}/${currentYear})`}
              >
                <Tag color={getReportStatusColor(selectedStudent.reportStatus)}>
                  {getReportStatusLabel(selectedStudent.reportStatus)}
                </Tag>
              </Descriptions.Item>
              {selectedStudent.currentMonthReport?.submittedAt && (
                <Descriptions.Item label="Submitted At">
                  {dayjs(selectedStudent.currentMonthReport.submittedAt).format(
                    "DD MMM YYYY HH:mm",
                  )}
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedStudent.lastLoginAt && (
              <>
                <Divider>Activity</Divider>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Last Login">
                    {dayjs(selectedStudent.lastLoginAt).format(
                      "DD MMM YYYY HH:mm",
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
};

export default StudentsList;
