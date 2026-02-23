import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  theme,
} from "antd";
import {
  DeleteOutlined,
  EnvironmentOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileDoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";
import principalService from "../../../services/principal.service";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const VISIT_TYPE_OPTIONS = [
  { value: "PHYSICAL", label: "Physical" },
  { value: "VIRTUAL", label: "Virtual" },
  { value: "PHONE", label: "Phone" },
];

const STATUS_OPTIONS = [
  { value: "COMPLETED", label: "Completed", color: "green" },
  { value: "DRAFT", label: "Draft", color: "orange" },
];

// Map statuses to colors (both uppercase DB values and display values)
const statusColorMap = {
  COMPLETED: "green",
  DRAFT: "orange",
  Completed: "green",
  Draft: "orange",
};

const PrincipalFeedback = () => {
  const { token } = theme.useToken();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({
    totalVisits: 0,
    avgRating: 0,
    visitsThisMonth: 0,
  });
  const [selectedReport, setSelectedReport] = useState(null);
  const [students, setStudents] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [searchText, setSearchText] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedVisitType, setSelectedVisitType] = useState("PHYSICAL");
  const [visitStatus, setVisitStatus] = useState("COMPLETED");
  const [capturing, setCapturing] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingFeedbackId, setEditingFeedbackId] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(undefined);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [studentAttendance, setStudentAttendance] = useState({});

  const isCompletedStatus = visitStatus === "COMPLETED";

  const loadCompanies = useCallback(async () => {
    try {
      const response = await principalService.getCompaniesForFeedback();
      setCompanies(response?.companies || []);
    } catch (error) {
      toast.error(error?.message || "Failed to load companies");
    }
  }, []);

  const loadStudentsByCompany = useCallback(async (companyName) => {
    try {
      const response = await principalService.getStudentsByCompany(companyName);
      const studentList = response?.students || [];
      setStudents(studentList);
    } catch (error) {
      toast.error(error?.message || "Failed to load students");
    }
  }, []);

  const loadStudents = useCallback(async () => {
    try {
      const response = await principalService.getStudentsByCompany();
      const studentList = response?.students || [];
      setStudents(studentList);
    } catch (error) {
      toast.error(error?.message || "Failed to load students");
    }
  }, []);

  const fetchReports = useCallback(
    async ({ page = 1, limit = pagination.pageSize } = {}) => {
      try {
        setLoading(true);

        const params = {
          page,
          limit,
          studentId: selectedStudentId || undefined,
          startDate: dateRange?.[0]
            ? dateRange[0].startOf("day").toISOString()
            : undefined,
          endDate: dateRange?.[1]
            ? dateRange[1].endOf("day").toISOString()
            : undefined,
        };

        const response =
          await principalService.getPrincipalVisitReports(params);
        const apiReports = response?.reports || [];

        const filteredReports = searchText
          ? apiReports.filter((item) => {
              const q = searchText.toLowerCase();
              const studentNames = (item.students || [])
                .map((student) => student?.name || "")
                .join(" ")
                .toLowerCase();
              const studentRolls = (item.students || [])
                .map((student) => student?.rollNumber || "")
                .join(" ")
                .toLowerCase();

              return (
                item.principalName?.toLowerCase().includes(q) ||
                studentNames.includes(q) ||
                studentRolls.includes(q) ||
                item.visitType?.toLowerCase().includes(q)
              );
            })
          : apiReports;

        setReports(filteredReports);
        setStats(
          response?.stats || {
            totalVisits: 0,
            avgRating: 0,
            visitsThisMonth: 0,
          },
        );
        setPagination((prev) => ({
          ...prev,
          current: page,
          pageSize: limit,
          total: response?.pagination?.total || 0,
        }));
      } catch (error) {
        toast.error(error?.message || "Failed to load principal feedback");
      } finally {
        setLoading(false);
      }
    },
    [dateRange, pagination.pageSize, searchText, selectedStudentId],
  );

  useEffect(() => {
    loadStudents();
    loadCompanies();
  }, [loadStudents, loadCompanies]);

  useEffect(() => {
    fetchReports({ page: 1, limit: pagination.pageSize });
  }, [fetchReports, pagination.pageSize]);

  const companyOptions = useMemo(
    () =>
      (companies || []).map((company) => ({
        value: company,
        label: company,
      })),
    [companies],
  );

  const studentOptions = useMemo(
    () =>
      (students || []).map((entry) => {
        const student = entry.student || entry;
        const name = student?.user?.name || student?.name || entry?.name || "Unknown";
        const rollNumber =
          student?.user?.rollNumber || student?.rollNumber || entry?.rollNumber || "-";
        const companyName = student?.companyName || entry?.companyName || "";

        return {
          value: student?.id || entry?.id,
          label: companyName ? `${name} (${rollNumber}) - ${companyName}` : `${name} (${rollNumber})`,
          name,
          rollNumber,
          companyName,
        };
      }),
    [students],
  );

  const handleDelete = useCallback((record) => {
    Modal.confirm({
      title: "Delete Principal Feedback",
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete this feedback from ${record.visitDate ? dayjs(record.visitDate).format("DD MMM YYYY") : "unknown date"}?`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await principalService.deletePrincipalFeedback(record.id);
          toast.success("Feedback deleted successfully");
          fetchReports({ page: 1, limit: pagination.pageSize });
        } catch (error) {
          toast.error(error?.message || "Failed to delete feedback");
        }
      },
    });
  }, [fetchReports, pagination.pageSize]);

  const columns = useMemo(
    () => [
      {
        title: "Visit Date",
        dataIndex: "visitDate",
        key: "visitDate",
        width: 120,
        render: (value) => (value ? dayjs(value).format("DD MMM YYYY") : "-"),
      },
      {
        title: "Industry",
        dataIndex: "industry",
        key: "industry",
        width: 180,
        render: (_, record) => {
          // Try to get industry/company from first student or a dedicated field
          const students = record.students || [];
          const company = students[0]?.companyName || record.industry || record.companyName || "-";
          return company || "-";
        },
      },
      {
        title: "Students",
        key: "students",
        width: 220,
        render: (_, record) => {
          const list = record.students || [];
          if (list.length === 0) return "-";
          // Comma separated names (with roll)
          return list.map((student) => `${student.name || "-"} (${student.rollNumber || "-"})`).join(", ");
        },
      },
      {
        title: "Visit Type",
        dataIndex: "visitType",
        key: "visitType",
        width: 110,
        render: (value) => <Tag color="purple">{value || "-"}</Tag>,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 100,
        render: (value) => {
          // Normalize to uppercase for mapping
          const status = (value || "").toUpperCase();
          const label = status === "COMPLETED" ? "Completed" : status === "DRAFT" ? "Draft" : value || "-";
          return <Tag color={statusColorMap[status] || "default"}>{label}</Tag>;
        },
      },
      {
        title: "Action",
        key: "action",
        width: 150,
        fixed: "right",
        render: (_, record) => (
          <Space size={0}>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => setSelectedReport(record)}
            />
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Space>
        ),
      },
    ],
    [handleDelete],
  );

  const resetFormState = () => {
    form.resetFields();
    form.setFieldsValue({
      visitDate: dayjs(),
      visitType: "PHYSICAL",
      status: "COMPLETED",
      followUpRequired: false,
    });
    setSelectedVisitType("PHYSICAL");
    setVisitStatus("COMPLETED");
    setGpsLocation(null);
    setIsEditMode(false);
    setEditingFeedbackId(null);
    setSelectedCompany(undefined);
    setSelectedStudents([]);
    setStudentAttendance({});
    loadStudents(); // Reset to all students
  };

  const normalizeVisitTypeForForm = (value) => {
    const visitType = (value || "").toUpperCase();
    return visitType === "TELEPHONIC" ? "PHONE" : visitType;
  };

  const captureGpsLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    setCapturing(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        setGpsLocation(coords);
        form.setFieldsValue({
          visitLocation: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
        });
        toast.success("GPS captured");
        setCapturing(false);
      },
      (error) => {
        toast.error(
          error.code === 1
            ? "Location permission denied"
            : "Failed to capture location",
        );
        setCapturing(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const openCreateModal = () => {
    resetFormState();
    setCreateOpen(true);
  };

  const openEditModal = async (record) => {
    try {
      setSubmitting(true);
      resetFormState();

      const response = await principalService.getPrincipalVisitReportById(record.id);
      const raw = response?.raw || {};
      const studentsData = raw.students || [];
      const studentIds = studentsData.map((s) => s.studentId);
      const normalizedVisitType = normalizeVisitTypeForForm(raw.visitType || record.visitType || "PHYSICAL");

      // Build attendance map
      const attendanceMap = {};
      studentsData.forEach((s) => {
        attendanceMap[s.studentId] = s.isPresent !== false;
      });

      form.setFieldsValue({
        visitDate: raw.visitDate ? dayjs(raw.visitDate) : record.visitDate ? dayjs(record.visitDate) : dayjs(),
        visitType: normalizedVisitType,
        status: raw.status || "COMPLETED",
        visitLocation: raw.visitLocation || "",
        visitDuration: raw.visitDuration || "",
        followUpRequired: !!raw.followUpRequired,
        nextVisitDate: raw.nextVisitDate ? dayjs(raw.nextVisitDate) : null,
        responseFromOrganisation: raw.responseFromOrganisation || "",
        observationsAboutIndustry: raw.observationsAboutIndustry || "",
      });

      setSelectedStudents(studentIds);
      setStudentAttendance(attendanceMap);
      setSelectedVisitType(normalizedVisitType || "PHYSICAL");
      setVisitStatus(raw.status || "COMPLETED");
      setIsEditMode(true);
      setEditingFeedbackId(record.id);
      setCreateOpen(true);
    } catch (error) {
      toast.error(error?.message || "Failed to load feedback for edit");
    } finally {
      setSubmitting(false);
    }
  };

  const closeCreateModal = () => {
    setCreateOpen(false);
    resetFormState();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (selectedStudents.length === 0) {
        toast.error("Please select at least one student");
        return;
      }

      setSubmitting(true);

      // Build students array with attendance
      const studentsPayload = selectedStudents.map((studentId) => ({
        studentId,
        isPresent: studentAttendance[studentId] !== false,
      }));

      const payload = {
        students: studentsPayload,
        visitType: values.visitType,
        visitDate: values.visitDate
          ? values.visitDate.toISOString()
          : undefined,
        status: values.status,
        visitLocation: values.visitLocation || undefined,
        visitDuration: values.visitDuration || undefined,
        followUpRequired: values.followUpRequired || false,
        nextVisitDate: values.nextVisitDate
          ? values.nextVisitDate.toISOString()
          : undefined,
        responseFromOrganisation: values.responseFromOrganisation,
        observationsAboutIndustry: values.observationsAboutIndustry,
      };

      if (isEditMode && editingFeedbackId) {
        await principalService.updatePrincipalFeedback(editingFeedbackId, payload);
        toast.success("Principal feedback updated");
      } else {
        await principalService.createPrincipalFeedback(payload);
        toast.success(
          values.status === "DRAFT"
            ? "Feedback saved as draft"
            : "Principal feedback submitted",
        );
      }

      closeCreateModal();
      fetchReports({ page: 1, limit: pagination.pageSize });
    } catch (error) {
      toast.error(error?.message || "Failed to save principal feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="p-4 md:p-6 min-h-screen"
      style={{ backgroundColor: token.colorBgLayout }}
    >
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileDoneOutlined className="text-primary text-lg" />
            <Title level={4} className="!mb-0 text-base sm:text-lg">
              Principal Feedback
            </Title>
          </div>
          <Space wrap className="w-full sm:w-auto">
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() =>
                fetchReports({ page: 1, limit: pagination.pageSize })
              }
              className="flex-1 sm:flex-none"
            >
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
              className="flex-1 sm:flex-none"
            >
              <span className="hidden xs:inline">Add</span> Feedback
            </Button>
          </Space>
        </div>

        <Row gutter={[12, 12]}>
          <Col xs={12} sm={12} md={12}>
            <Card size="small" className="h-full">
              <Text type="secondary" className="text-xs sm:text-sm">Total Visits</Text>
              <div className="text-xl sm:text-2xl font-bold">{stats.totalVisits || 0}</div>
            </Card>
          </Col>
          <Col xs={12} sm={12} md={12}>
            <Card size="small" className="h-full">
              <Text type="secondary" className="text-xs sm:text-sm">This Month</Text>
              <div className="text-xl sm:text-2xl font-bold">
                {stats.visitsThisMonth || 0}
              </div>
            </Card>
          </Col>
        </Row>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 mb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input
                placeholder="Search..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                className="w-full"
              />
              <Select
                placeholder="Filter by student"
                value={selectedStudentId}
                onChange={setSelectedStudentId}
                allowClear
                className="w-full"
                options={studentOptions}
                showSearch
                optionFilterProp="label"
              />
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                format="DD/MM/YYYY"
                className="w-full"
              />
              <Button
                type="primary"
                onClick={() =>
                  fetchReports({ page: 1, limit: pagination.pageSize })
                }
                className="w-full sm:w-auto"
              >
                Apply
              </Button>
            </div>
          </div>

          <Table
            rowKey="id"
            columns={columns}
            dataSource={reports}
            loading={loading}
            locale={{
              emptyText: <Empty description="No principal feedback found" />,
            }}
            scroll={{ x: 1100 }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              onChange: (page, pageSize) =>
                fetchReports({ page, limit: pageSize }),
            }}
          />
        </Card>
      </div>

      <Modal
        title="Principal Feedback Details"
        open={!!selectedReport}
        onCancel={() => setSelectedReport(null)}
        footer={<Button onClick={() => setSelectedReport(null)}>Close</Button>}
        width="90%"
        style={{ maxWidth: 760 }}
      >
        {selectedReport && (
          <Space direction="vertical" size={10} className="w-full">
            <div>
              <Text strong>Principal:</Text>{" "}
              <Text>{selectedReport.principalName || "-"}</Text>
            </div>
            <div>
              <Text strong>Students:</Text>{" "}
              <Text>
                {(selectedReport.students || [])
                  .map(
                    (student) =>
                      `${student.name || "-"} (${student.rollNumber || "-"})`,
                  )
                  .join(", ") || "-"}
              </Text>
            </div>
            <div>
              <Text strong>Visit Date:</Text>{" "}
              <Text>
                {selectedReport.visitDate
                  ? dayjs(selectedReport.visitDate).format(
                      "DD MMM YYYY, hh:mm A",
                    )
                  : "-"}
              </Text>
            </div>
            <div>
              <Text strong>Type:</Text>{" "}
              <Tag color="purple">{selectedReport.visitType || "-"}</Tag>
            </div>
            <div>
              <Text strong>Status:</Text>{" "}
              <Tag color={statusColorMap[selectedReport.status] || "default"}>
                {selectedReport.status || "-"}
              </Tag>
            </div>
            {/* <div>
              <Text strong>Location:</Text>{" "}
              <Text>{selectedReport.location || "-"}</Text>
            </div> */}
            <div>
              <Text strong>Duration:</Text>{" "}
              <Text>{selectedReport.duration || "-"}</Text>
            </div>
            <div>
              <Text strong>Response From Organisation About The Students:</Text>
              <Paragraph>
                {selectedReport.responseFromOrganisation || "-"}
              </Paragraph>
            </div>
            <div>
              <Text strong>Observations About Industry:</Text>
              <Paragraph>
                {selectedReport.observationsAboutIndustry || "-"}
              </Paragraph>
            </div>
            <div>
              <Text strong>Students Attendance:</Text>
              <Space wrap size={[4, 4]} className="mt-1">
                {(selectedReport.students || []).map((student) => (
                  <Tag
                    key={student.id}
                    color={student.isPresent === false ? "red" : "green"}
                  >
                    {student.name || "-"}: {student.isPresent === false ? "Absent" : "Present"}
                  </Tag>
                ))}
              </Space>
            </div>
          </Space>
        )}
      </Modal>

      <Modal
        title={isEditMode ? "Edit Principal Feedback" : "Add Principal Feedback"}
        open={createOpen}
        onCancel={closeCreateModal}
        width="90%"
        style={{ maxWidth: 760 }}
        destroyOnHidden
        styles={{
          body: { maxHeight: "70vh", overflowY: "auto", padding: "12px 16px" },
        }}
        footer={
          <Space>
            <Button onClick={closeCreateModal} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={handleSubmit}
            >
              {isEditMode ? "Update" : "Save"}
            </Button>
          </Space>
        }
      >
        {/* <Alert
          message="Required: Core fields + Principal feedback"
          description="Core visit details are required. The three principal feedback fields are mandatory for backend-compatible submission."
          type="info"
          showIcon
          className="mb-3"
        /> */}

        <Form form={form} layout="vertical" size="small" className="space-y-3">
          <Card size="small" className="mb-3!">
            <Text
              strong
              className="text-xs uppercase tracking-wide text-gray-500 block mb-2"
            >
              Visit Details
            </Text>
            <Row gutter={[12, 0]}>
              <Col xs={24} sm={8}>
                <Form.Item label="Filter by Company" className="mb-2!">
                  <Select
                    placeholder="Select company (optional)"
                    options={companyOptions}
                    value={selectedCompany}
                    onChange={(value) => {
                      setSelectedCompany(value);
                      if (value) {
                        loadStudentsByCompany(value);
                      } else {
                        loadStudents();
                      }
                    }}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={16}>
                <Form.Item label="Students" className="mb-2!">
                  <Select
                    mode="multiple"
                    placeholder="Select students"
                    options={studentOptions}
                    value={selectedStudents}
                    onChange={(values) => {
                      setSelectedStudents(values);
                      // Initialize attendance for newly selected students
                      const newAttendance = { ...studentAttendance };
                      values.forEach((id) => {
                        if (!(id in newAttendance)) {
                          newAttendance[id] = true;
                        }
                      });
                      setStudentAttendance(newAttendance);
                    }}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
            </Row>

            {selectedStudents.length > 0 && (
              <Card size="small" className="mb-2! bg-gray-50">
                <Text strong className="text-xs block mb-2">
                  Mark Attendance
                </Text>
                <Space wrap size={[8, 8]}>
                  {selectedStudents.map((studentId) => {
                    const student = studentOptions.find((s) => s.value === studentId);
                    return (
                      <Checkbox
                        key={studentId}
                        checked={studentAttendance[studentId] !== false}
                        onChange={(e) => {
                          setStudentAttendance((prev) => ({
                            ...prev,
                            [studentId]: e.target.checked,
                          }));
                        }}
                      >
                        <span className={studentAttendance[studentId] === false ? "text-red-500" : ""}>
                          {student?.name || "Unknown"} ({student?.rollNumber || "-"})
                          {studentAttendance[studentId] === false && " - Absent"}
                        </span>
                      </Checkbox>
                    );
                  })}
                </Space>
              </Card>
            )}

            <Row gutter={[12, 0]}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="visitDate"
                  label="Date & Time"
                  rules={[
                    { required: true, message: "Please select date & time" },
                  ]}
                  className="mb-2!"
                >
                  <DatePicker
                    showTime
                    className="w-full"
                    format="DD/MM/YY HH:mm"
                  />
                </Form.Item>
              </Col>
              <Col xs={12} sm={8}>
                <Form.Item
                  name="visitType"
                  label="Type"
                  rules={[
                    { required: true, message: "Please select visit type" },
                  ]}
                  className="mb-2!"
                >
                  <Select
                    options={VISIT_TYPE_OPTIONS}
                    onChange={(value) => setSelectedVisitType(value)}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} sm={8}>
                <Form.Item name="status" label="Status" className="mb-2!">
                  <Select
                    options={STATUS_OPTIONS.map((entry) => ({
                      value: entry.value,
                      label: <Tag color={entry.color}>{entry.label}</Tag>,
                    }))}
                    onChange={(value) => setVisitStatus(value || "COMPLETED")}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[12, 0]}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="visitDuration"
                  label="Visit Duration"
                  className="mb-2!"
                >
                  <Input placeholder="e.g. 2 hours" maxLength={50} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={16}>
                <Form.Item
                  name="visitLocation"
                  label="Visit Location"
                  className="mb-2!"
                  rules={
                    selectedVisitType === "PHYSICAL" && isCompletedStatus
                      ? [
                          {
                            required: true,
                            message:
                              "Please enter visit location for physical visits",
                          },
                        ]
                      : []
                  }
                >
                  <Space.Compact className="w-full">
                    <Input
                      placeholder="Location or GPS"
                      prefix={<EnvironmentOutlined />}
                    />
                    <Button
                      type="primary"
                      icon={<EnvironmentOutlined />}
                      onClick={captureGpsLocation}
                      loading={capturing}
                    />
                  </Space.Compact>
                </Form.Item>
                {gpsLocation && (
                  <Text type="success" className="text-xs">
                    GPS: {gpsLocation.latitude.toFixed(4)},{" "}
                    {gpsLocation.longitude.toFixed(4)} (±
                    {gpsLocation.accuracy?.toFixed(0)}m)
                  </Text>
                )}
              </Col>
            </Row>

            <Row gutter={[12, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="nextVisitDate"
                  label="Next Visit Date"
                  className="mb-2! sm:mb-0!"
                >
                  <DatePicker className="w-full" format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="followUpRequired"
                  label="Follow-up Required"
                  valuePropName="checked"
                  className="mb-0!"
                >
                  <Switch checkedChildren="Yes" unCheckedChildren="No" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card size="small">
            <Text
              strong
              className="text-xs uppercase tracking-wide text-gray-500 block mb-2"
            >
              Observations & Feedback
            </Text>

            <Form.Item
              name="responseFromOrganisation"
              label="Response From Organisation About The Students"
              rules={[
                {
                  required: true,
                  message: "Response from organisation is required",
                },
              ]}
              className="mb-2!"
            >
              <TextArea
                rows={3}
                maxLength={2000}
                showCount
                placeholder="Response from the organisation about the students"
              />
            </Form.Item>

            <Form.Item
              name="observationsAboutIndustry"
              label="Observations About Industry"
              rules={[
                {
                  required: true,
                  message: "Observations about industry are required",
                },
              ]}
              className="mb-0!"
            >
              <TextArea
                rows={3}
                maxLength={3000}
                showCount
                placeholder="Observations about the industry/company"
              />
            </Form.Item>
          </Card>
        </Form>
      </Modal>
    </div>
  );
};

export default PrincipalFeedback;
