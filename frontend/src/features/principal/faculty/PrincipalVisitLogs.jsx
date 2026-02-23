import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  Typography,
  Table,
  Tag,
  Space,
  Button,
  Select,
  DatePicker,
  Input,
  Modal,
  Row,
  Col,
  Empty,
  theme,
} from "antd";
import {
  FileDoneOutlined,
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";
import principalService from "../../../services/principal.service";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const statusColorMap = {
  Approved: "success",
  "Under Review": "processing",
  Pending: "warning",
};

const PrincipalVisitLogs = () => {
  const { token } = theme.useToken();

  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ totalVisits: 0, avgRating: 0, visitsThisMonth: 0 });
  const [facultyList, setFacultyList] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  // Restore to fetch faculty visit logs
  const fetchReports = useCallback(async ({ page = 1, limit = pagination.pageSize } = {}) => {
    try {
      setLoading(true);

      const params = {
        page,
        limit,
        facultyId: selectedFacultyId || undefined,
        startDate: dateRange?.[0] ? dateRange[0].startOf("day").toISOString() : undefined,
        endDate: dateRange?.[1] ? dateRange[1].endOf("day").toISOString() : undefined,
      };

      // Use the correct faculty visit logs API
      const response = await principalService.getFacultyVisitReports(params);
      const apiReports = response?.reports || [];

      const filteredReports = searchText
        ? apiReports.filter((item) => {
            const q = searchText.toLowerCase();
            return (
              item.facultyName?.toLowerCase().includes(q) ||
              item.studentName?.toLowerCase().includes(q) ||
              item.studentRollNumber?.toLowerCase().includes(q) ||
              item.visitType?.toLowerCase().includes(q)
            );
          })
        : apiReports;

      setReports(filteredReports);
      setStats(response?.stats || { totalVisits: 0, avgRating: 0, visitsThisMonth: 0 });
      setFacultyList(response?.facultyList || []);
      setPagination((prev) => ({
        ...prev,
        current: page,
        pageSize: limit,
        total: response?.pagination?.total || 0,
      }));
    } catch (error) {
      toast.error(error?.message || "Failed to load faculty visit logs");
    } finally {
      setLoading(false);
    }
  }, [dateRange, pagination.pageSize, searchText, selectedFacultyId]);

  useEffect(() => {
    fetchReports({ page: 1, limit: pagination.pageSize });
  }, [fetchReports, pagination.pageSize]);

  const columns = useMemo(() => [
    {
      title: "Visit Date",
      dataIndex: "visitDate",
      key: "visitDate",
      width: 130,
      render: (value) => (value ? dayjs(value).format("DD MMM YYYY") : "-"),
    },
    {
      title: "Faculty",
      dataIndex: "facultyName",
      key: "facultyName",
      width: 180,
      ellipsis: true,
    },
    {
      title: "Student",
      key: "student",
      width: 220,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.studentName || "-"}</div>
          <div className="text-xs text-gray-500">{record.studentRollNumber || "-"}</div>
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "visitType",
      key: "visitType",
      width: 120,
      render: (value) => <Tag color="blue">{value || "-"}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (value) => <Tag color={statusColorMap[value] || "default"}>{value || "-"}</Tag>,
    },
    {
      title: "Action",
      key: "action",
      width: 90,
      fixed: "right",
      render: (_, record) => (
        <Button type="text" icon={<EyeOutlined />} onClick={() => setSelectedReport(record)} />
      ),
    },
  ], []);

  return (
    <div className="p-4 md:p-6 min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileDoneOutlined className="text-primary text-lg" />
            <Title level={4} style={{ marginBottom: 0 }}>Faculty Visit Logs</Title>
          </div>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => fetchReports({ page: 1, limit: pagination.pageSize })}>
            Refresh
          </Button>
        </div>

        <Row gutter={12}>
          <Col xs={24} md={12}><Card size="small"><Text type="secondary">Total Visits</Text><div className="text-2xl font-bold">{stats.totalVisits || 0}</div></Card></Col>
          <Col xs={24} md={12}><Card size="small"><Text type="secondary">Visits This Month</Text><div className="text-2xl font-bold">{stats.visitsThisMonth || 0}</div></Card></Col>
          {/* <Col xs={24} md={8}><Card size="small"><Text type="secondary">Average Rating</Text><div className="text-2xl font-bold">{stats.avgRating || 0}</div></Card></Col> */}
        </Row>

        <Card>
          <Space wrap className="mb-3">
            <Input
              placeholder="Search faculty/student/roll/type"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 260 }}
            />
            <Select
              placeholder="Filter by faculty"
              value={selectedFacultyId}
              onChange={setSelectedFacultyId}
              allowClear
              style={{ width: 220 }}
              options={(facultyList || []).map((f) => ({ value: f.id, label: f.name }))}
            />
            <RangePicker value={dateRange} onChange={setDateRange} format="DD/MM/YYYY" />
            <Button type="primary" onClick={() => fetchReports({ page: 1, limit: pagination.pageSize })}>Apply</Button>
          </Space>

          <Table
            rowKey="id"
            columns={columns}
            dataSource={reports}
            loading={loading}
            locale={{ emptyText: <Empty description="No visit logs found" /> }}
            scroll={{ x: 1050 }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              onChange: (page, pageSize) => fetchReports({ page, limit: pageSize }),
            }}
          />
        </Card>
      </div>

      <Modal
        title="Visit Log Details"
        open={!!selectedReport}
        onCancel={() => setSelectedReport(null)}
        footer={<Button onClick={() => setSelectedReport(null)}>Close</Button>}
        width={720}
      >
        {selectedReport && (
          <Space direction="vertical" size={10} className="w-full">
            <div><Text strong>Faculty:</Text> <Text>{selectedReport.facultyName || "-"}</Text></div>
            <div><Text strong>Student:</Text> <Text>{selectedReport.studentName || "-"} ({selectedReport.studentRollNumber || "-"})</Text></div>
            <div><Text strong>Visit Date:</Text> <Text>{selectedReport.visitDate ? dayjs(selectedReport.visitDate).format("DD MMM YYYY, hh:mm A") : "-"}</Text></div>
            <div><Text strong>Type:</Text> <Tag color="blue">{selectedReport.visitType || "-"}</Tag></div>
            <div><Text strong>Status:</Text> <Tag color={statusColorMap[selectedReport.status] || "default"}>{selectedReport.status || "-"}</Tag></div>
            <div><Text strong>Duration:</Text> <Text>{selectedReport.duration || "-"}</Text></div>
            <div><Text strong>Location:</Text> <Text>{selectedReport.location || "-"}</Text></div>
            <div><Text strong>Rating:</Text> <Text>{selectedReport.rating ? `${selectedReport.rating}/5` : "-"}</Text></div>
            <div><Text strong>Summary:</Text><Paragraph>{selectedReport.summary || "-"}</Paragraph></div>
            <div><Text strong>Observations:</Text><Paragraph>{selectedReport.observations || "-"}</Paragraph></div>
            <div><Text strong>Recommendations:</Text><Paragraph>{selectedReport.recommendations || "-"}</Paragraph></div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default PrincipalVisitLogs;
