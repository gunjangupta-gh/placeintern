// src/pages/faculty/AssignedStudents.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Table, Typography, Card, Tag, Spin, Empty, Alert, Button, theme, Input, Select, Space, Row, Col, Statistic, Popconfirm } from "antd";
import { toast } from 'react-hot-toast';
import {
  PhoneOutlined,
  MailOutlined,
  ReloadOutlined,
  TeamOutlined,
  SearchOutlined,
  EyeOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  PlayCircleOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  fetchAssignedStudents,
  selectStudents,
  toggleStudentStatus,
} from "../store/facultySlice";
import StudentDetailsModal from "../dashboard/components/StudentDetailsModal";
import ProfileAvatar from "../../../components/common/ProfileAvatar";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const AssignedStudents = React.memo(() => {
  const { token } = theme.useToken();
  const dispatch = useDispatch();
  const studentsState = useSelector(selectStudents);

  const rawStudents = studentsState?.list || [];
  const loading = studentsState?.loading || false;
  const error = studentsState?.error || null;

  // Local state for filters and modal
  const [searchText, setSearchText] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    dispatch(fetchAssignedStudents());
  }, [dispatch]);

  const forceRefresh = useCallback(() => {
    dispatch(fetchAssignedStudents({ forceRefresh: true }));
  }, [dispatch]);

  // Handle toggle student status
  const handleToggleStatus = useCallback(async (student) => {
    try {
      const result = await dispatch(toggleStudentStatus({ studentId: student.id })).unwrap();
      toast.success(result.message || `Student ${result.active ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      toast.error(error || 'Failed to toggle student status');
    }
  }, [dispatch]);

  // Flatten and process student data
  const students = useMemo(() => {
    if (!Array.isArray(rawStudents)) return [];
    return rawStudents.map(item => {
        // item might be the student object itself or an assignment object containing 'student'
        const student = item.student || item;
        return {
            ...student,
            // Keep reference to original wrapper if needed, or just student properties
            assignmentId: item.id !== student.id ? item.id : null,
            // Ensure these fields exist for filtering/sorting - user relation fields
            name: student?.user?.name || student.name,
            email: student?.user?.email || student.email,
            rollNumber: student?.user?.rollNumber || student.rollNumber,
            phoneNo: student?.user?.phoneNo || student.contact || student.phoneNo,
            branchName: student?.user?.branchName || student.branchName || student.branch?.name || "N/A",
            // User SOT pattern: prefer user.active, fallback to isActive
            isActive: student?.user?.active ?? student.active ?? student.isActive ?? true,
            // Helper for active internship
            activeInternship: student.internshipApplications?.find(app => app.internshipPhase === 'ACTIVE' && !app.completionDate),
            // Helper for pending applications
            hasPendingApps: student.internshipApplications?.some(app => app.status === 'APPLIED' || app.status === 'UNDER_REVIEW')
        };
    });
  }, [rawStudents]);

  // Derived lists for filters
  const branches = useMemo(() => {
    const s = new Set(students.map(st => st.branchName).filter(b => b !== "N/A"));
    return Array.from(s).sort();
  }, [students]);

  // Filtering
  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      const matchSearch = !searchText ||
        st?.user?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        st?.user?.rollNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
        st?.user?.email?.toLowerCase().includes(searchText.toLowerCase());

      const matchBranch = branchFilter === "all" || st.branchName === branchFilter;

      return matchSearch && matchBranch;
    });
  }, [students, searchText, branchFilter]);

  // Stats
  const stats = useMemo(() => {
    return {
        total: students.length,
        active: students.filter(s => s.activeInternship).length,
        pending: students.filter(s => !s.activeInternship && s.hasPendingApps).length
    };
  }, [students]);

  // Columns
  const columns = [
    {
      title: "Student",
      key: "student",
      width: 280,
      render: (_, r) => (
        <Space>
          <ProfileAvatar profileImage={r.profileImage} size={40} />
          <div>
            <Text strong style={{ color: token.colorText, display: 'block' }}>{r.name}</Text>
            <Text style={{ color: token.colorTextSecondary, fontSize: '12px' }}>{r.rollNumber}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Contact Info",
      key: "contact",
      width: 220,
      render: (_, r) => (
        <div className="flex flex-col gap-1">
          {r.email && (
             <div className="flex items-center gap-2 text-xs" style={{ color: token.colorTextSecondary }}>
                <MailOutlined style={{ color: token.colorTextTertiary }} /> 
                <span className="truncate max-w-[180px]" title={r.email}>{r.email}</span>
             </div>
          )}
          {r.contact && (
             <div className="flex items-center gap-2 text-xs" style={{ color: token.colorTextSecondary }}>
                <PhoneOutlined style={{ color: token.colorTextTertiary }} /> {r.contact}
             </div>
          )}
        </div>
      ),
    },
    {
        title: "Academic",
        key: "academic",
        width: 180,
        render: (_, r) => (
            <div className="flex flex-col gap-1">
                <Tag className="w-fit m-0">{r.branchName}</Tag>
                {r.semester && <span className="text-xs" style={{ color: token.colorTextTertiary }}>Sem: {r.semester}</span>}
            </div>
        )
    },
    {
      title: "Internship Status",
      key: "internshipStatus",
      width: 180,
      render: (_, r) => {
        if (r.activeInternship) {
            return (
                <Tag icon={<CheckCircleOutlined />} color="success">
                    Active
                </Tag>
            );
        }
        if (r.hasPendingApps) {
            return (
                <Tag icon={<ClockCircleOutlined />} color="warning">
                    Pending Approval
                </Tag>
            );
        }
        const appCount = r.internshipApplications?.length || 0;
        if (appCount > 0) {
            return <Tag color="blue">{appCount} Applications</Tag>;
        }
        return <Tag color="default" style={{ color: token.colorTextTertiary }}>Not Applied</Tag>;
      }
    },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: (_, r) => (
        <Tag color={r.isActive ? "green" : "red"}>
          {r.isActive ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      fixed: 'right',
      width: 180,
      render: (_, r) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
                setSelectedStudent(r);
                setDetailModalVisible(true);
            }}
            style={{ color: token.colorPrimary }}
          >
            Details
          </Button>
          <Popconfirm
            title={r.isActive ? "Deactivate Student" : "Activate Student"}
            description={r.isActive
              ? "This will deactivate the student and their mentor assignments and internship applications."
              : "This will activate the student and their mentor assignments and internship applications."
            }
            onConfirm={() => handleToggleStatus(r)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: r.isActive }}
          >
            <Button
              type="text"
              icon={r.isActive ? <StopOutlined /> : <PlayCircleOutlined />}
              style={{ color: r.isActive ? token.colorError : token.colorSuccess }}
            >
              {r.isActive ? "Deactivate" : "Activate"}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading && students.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
        <Spin size="large" tip="Loading students..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4" style={{ backgroundColor: token.colorBgLayout }}>
        <Alert
          message="Error Loading Data"
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

  return (
    <div className="p-6 min-h-screen flex flex-col gap-6" style={{ backgroundColor: token.colorBgLayout }}>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm" 
                 style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
              <TeamOutlined style={{ fontSize: '24px', color: token.colorPrimary }} />
            </div>
            <div>
              <Title level={3} style={{ margin: 0 }}>Assigned Students</Title>
              <Text type="secondary">Manage your mentorship students and track their progress</Text>
            </div>
        </div>
        <Button 
            icon={<ReloadOutlined spin={loading} />} 
            onClick={forceRefresh}
            className="shadow-sm"
        >
            Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
            <Card size="small" bordered={false} className="shadow-sm">
                <Statistic title="Total Students" value={stats.total} prefix={<TeamOutlined />} valueStyle={{ color: token.colorText }} />
            </Card>
        </Col>
        <Col xs={24} sm={8}>
            <Card size="small" bordered={false} className="shadow-sm">
                <Statistic title="Active Internships" value={stats.active} prefix={<CheckCircleOutlined />} valueStyle={{ color: token.colorSuccess }} />
            </Card>
        </Col>
        <Col xs={24} sm={8}>
            <Card size="small" bordered={false} className="shadow-sm">
                <Statistic title="Pending Review" value={stats.pending} prefix={<ClockCircleOutlined />} valueStyle={{ color: token.colorWarning }} />
            </Card>
        </Col>
      </Row>

      {/* Main Content Card */}
      <Card 
        bordered={false} 
        className="shadow-sm flex-1 flex flex-col overflow-hidden" 
        bodyStyle={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        {/* Toolbar */}
        <div className="p-4 border-b flex flex-col md:flex-row gap-4 justify-between bg-white" style={{ borderColor: token.colorBorder }}>
            <Input 
                placeholder="Search students..." 
                prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />} 
                className="max-w-md"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                allowClear
            />
            <div className="flex gap-2">
                <Select 
                    defaultValue="all" 
                    style={{ width: 200 }} 
                    onChange={setBranchFilter}
                    value={branchFilter}
                    suffixIcon={<FilterOutlined style={{ color: token.colorTextTertiary }} />}
                >
                    <Option value="all">All Branches</Option>
                    {branches.map(b => <Option key={b} value={b}>{b}</Option>)}
                </Select>
            </div>
        </div>

        {/* Table */}
        <Table
            columns={columns}
            dataSource={filteredStudents}
            rowKey="id"
            loading={loading}
            pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} students`
            }}
            scroll={{ x: 1000 }}
            className="flex-1"
        />
      </Card>

      {/* Student Detail Modal */}
      <StudentDetailsModal
        visible={detailModalVisible}
        student={selectedStudent}
        onClose={() => {
            setDetailModalVisible(false);
            setSelectedStudent(null);
        }}
        onScheduleVisit={() => {
            // Optional: refresh after scheduling
            forceRefresh();
        }}
        onRefresh={forceRefresh}
        loading={loading}
      />
    </div>
  );
});

AssignedStudents.displayName = 'AssignedStudents';

export default AssignedStudents;