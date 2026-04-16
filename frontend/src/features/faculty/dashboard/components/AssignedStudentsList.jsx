import React, { useState, useMemo } from 'react';
import { Card, Table, Input, Button, Typography, Badge, Tooltip, Space, Tag, theme } from 'antd';
import {
  TeamOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import UnifiedVisitLogModal from '../../visits/UnifiedVisitLogModal';

const { Text } = Typography;

const AssignedStudentsList = ({
  students = [],
  loading,
  onViewAll,
  onViewStudent,
  onScheduleVisit
}) => {
  const { token } = theme.useToken();
  const [searchText, setSearchText] = useState('');
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Helper to extract company name from student record
  const getCompanyName = (student) => {
    return student.companyName ||
           student.company?.companyName ||
           student.internship?.industry?.companyName ||
           student.student?.internshipApplications?.[0]?.companyName ||
           'Not Assigned';
  };

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!searchText) return students;

    const search = searchText.toLowerCase();
    return students.filter(student => {
      const name = (student?.user?.name || student.student?.user?.name || '').toLowerCase();
      const rollNumber = (student?.user?.rollNumber || student.student?.user?.rollNumber || '').toLowerCase();
      const company = getCompanyName(student).toLowerCase();

      return name.includes(search) || rollNumber.includes(search) || company.includes(search);
    });
  }, [students, searchText]);

  // Handle Log Visit button click - open UnifiedVisitLogModal
  const handleLogVisit = (student, e) => {
    e.stopPropagation();
    setSelectedStudent(student);
    setVisitModalVisible(true);
  };

  // Handle visit modal success
  const handleVisitSuccess = () => {
    setVisitModalVisible(false);
    setSelectedStudent(null);
    // Trigger refresh if callback is provided
    if (onScheduleVisit) {
      onScheduleVisit();
    }
  };

  // Helper to get internship application from student record
  const getInternshipApp = (student) => {
    return student.student?.internshipApplications?.[0] ||
           student.internshipApplications?.[0] ||
           student.activeInternship ||
           null;
  };

  /**
   * Get expected reports count from backend counter fields.
   * Falls back to 0 if counter not available.
   */
  const getExpectedReports = (internshipApp) => {
    return internshipApp?.totalExpectedReports || 0;
  };

  /**
   * Get submitted reports count by counting non-deleted reports from the array.
   * This ensures accuracy after soft-delete filtering.
   */
  const getSubmittedReports = (internshipApp, student) => {
    // Get reports array from various possible locations
    const reports = internshipApp?.monthlyReports ||
                   student?.student?.monthlyReports ||
                   student?.monthlyReports ||
                   [];
    // Count non-deleted, submitted reports (SUBMITTED, APPROVED, or any non-DRAFT status)
    const submittedCount = reports.filter(r =>
      !r.isDeleted && r.status !== 'DRAFT'
    ).length;
    // Use array count if available, otherwise fall back to counter field
    return reports.length > 0 ? submittedCount : (internshipApp?.submittedReportsCount || 0);
  };

  /**
   * Get expected visits count from backend counter fields.
   * Falls back to 0 if counter not available.
   */
  const getExpectedVisits = (internshipApp) => {
    return internshipApp?.totalExpectedVisits || 0;
  };

  /**
   * Get completed visits count by counting non-deleted, completed visits from the array.
   * This ensures accuracy after soft-delete filtering.
   */
  const getCompletedVisits = (internshipApp, student) => {
    // Get visits array from various possible locations
    const visits = internshipApp?.facultyVisitLogs ||
                  student?.student?.facultyVisitLogs ||
                  student?.facultyVisitLogs ||
                  [];
    // Count non-deleted, completed visits
    const completedCount = visits.filter(v =>
      !v.isDeleted && v.status === 'COMPLETED'
    ).length;
    // Use array count if available, otherwise fall back to counter field
    return visits.length > 0 ? completedCount : (internshipApp?.completedVisitsCount || 0);
  };

  // Get visit status with done/expected using backend counter fields
  const getVisitStatus = (student) => {
    const internshipApp = getInternshipApp(student);
    const done = getCompletedVisits(internshipApp, student);
    const expected = getExpectedVisits(internshipApp);

    // Determine color based on completion
    let color = token.colorTextQuaternary; // grey - no progress
    let bgColor = token.colorFillQuaternary;
    if (expected > 0) {
      const ratio = done / expected;
      if (ratio >= 1) {
        color = token.colorSuccess; // green - complete
        bgColor = token.colorSuccessBg;
      } else if (ratio >= 0.5) {
        color = token.colorWarning; // orange - partial
        bgColor = token.colorWarningBg;
      } else if (done > 0) {
        color = token.colorError; // light red - started (using error color for low progress)
        bgColor = token.colorErrorBg;
      }
    }

    return (
      <Tooltip title={`${done} of ${expected} visits completed`}>
        <div
          style={{
            background: bgColor,
            padding: '2px 8px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <EnvironmentOutlined style={{ color, fontSize: 12 }} />
          <Text style={{ color, fontSize: 12, fontWeight: 600 }}>
            {done}/{expected}
          </Text>
        </div>
      </Tooltip>
    );
  };

  // Get report status with done/expected using backend counter fields
  const getReportStatus = (student) => {
    const internshipApp = getInternshipApp(student);
    const done = getSubmittedReports(internshipApp, student);
    const expected = getExpectedReports(internshipApp);

    // Get reports array to check for draft reports
    const reports = internshipApp?.monthlyReports ||
                   student.student?.monthlyReports ||
                   student.monthlyReports ||
                   student.reports ||
                   [];
    // Check for draft reports (with auto-approval, only DRAFT is pending) - filter out deleted
    const pendingCount = reports.filter(r => !r.isDeleted && r.status === 'DRAFT').length;

    // Determine color based on completion
    let color = token.colorTextQuaternary; // grey - no progress
    let bgColor = token.colorFillQuaternary;
    let icon = <MinusCircleOutlined style={{ color, fontSize: 12 }} />;

    if (expected > 0) {
      const ratio = done / expected;
      if (ratio >= 1) {
        color = token.colorSuccess; // green - complete
        bgColor = token.colorSuccessBg;
        icon = <CheckCircleOutlined style={{ color, fontSize: 12 }} />;
      } else if (pendingCount > 0) {
        color = token.colorWarning; // orange - has pending
        bgColor = token.colorWarningBg;
        icon = <ClockCircleOutlined style={{ color, fontSize: 12 }} />;
      } else if (done > 0) {
        color = token.colorPrimary; // blue - in progress
        bgColor = token.colorPrimaryBg;
        icon = <CheckCircleOutlined style={{ color, fontSize: 12 }} />;
      }
    }

    const tooltipText = pendingCount > 0
      ? `${done}/${expected} reports (${pendingCount} draft)`
      : `${done} of ${expected} reports submitted`;

    return (
      <Tooltip title={tooltipText}>
        <div
          style={{
            background: bgColor,
            padding: '2px 8px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {icon}
          <Text style={{ color, fontSize: 12, fontWeight: 600 }}>
            {done}/{expected}
          </Text>
        </div>
      </Tooltip>
    );
  };

  // Get joining letter status icon
  const getJoiningLetterStatusIcon = (student) => {
    const letter = student.joiningLetter || student.joiningLetters?.[0];
    // Check if there's a joining letter URL in the internship application
    const internshipApp = getInternshipApp(student);
    const hasJoiningLetterUrl = internshipApp?.joiningLetterUrl;

    if (!letter && !hasJoiningLetterUrl) {
      return (
        <Tooltip title="No joining report submitted">
          <MinusCircleOutlined style={{ color: token.colorTextQuaternary, fontSize: 16 }} />
        </Tooltip>
      );
    }

    // If we have a joining letter URL but no letter object, show as pending
    if (!letter && hasJoiningLetterUrl) {
      return (
        <Tooltip title="Joining report uploaded">
          <ClockCircleOutlined style={{ color: token.colorWarning, fontSize: 16 }} />
        </Tooltip>
      );
    }

    const isVerified = letter.isVerified || letter.verifiedAt || letter.status === 'VERIFIED';
    const isPending = letter.status === 'PENDING' || letter.status === 'SUBMITTED' || (!letter.reviewedAt && !isVerified);

    if (isVerified) {
      return (
        <Tooltip title="Joining report verified">
          <CheckCircleOutlined style={{ color: token.colorSuccess, fontSize: 16 }} />
        </Tooltip>
      );
    } else if (isPending) {
      return (
        <Tooltip title="Joining report pending verification">
          <ClockCircleOutlined style={{ color: token.colorWarning, fontSize: 16 }} />
        </Tooltip>
      );
    } else {
      return (
        <Tooltip title="No joining report">
          <MinusCircleOutlined style={{ color: token.colorTextQuaternary, fontSize: 16 }} />
        </Tooltip>
      );
    }
  };

  const columns = [
    {
      title: 'Student',
      key: 'student',
      width: 150,
      ellipsis: true,
      sorter: (a, b) => {
        const nameA = (a?.user?.name || a.student?.user?.name || '').toLowerCase();
        const nameB = (b?.user?.name || b.student?.user?.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      },
      render: (_, student) => {
        const name = student?.user?.name || student.student?.user?.name || 'N/A';
        const rollNumber = student?.user?.rollNumber || student.student?.user?.rollNumber || 'N/A';
        const isExternal = student.isExternalStudent || false;
        const institution = student.student?.Institution || student.Institution;

        return (
          <div style={{ maxWidth: 140 }}>
            <div className="flex items-center gap-1">
              <Text strong style={{ display: 'block', fontSize: 13 }} ellipsis={{ tooltip: name }}>
                {name}
              </Text>
              {isExternal && (
                <Tooltip title={`External student from ${institution?.name || 'Other Institution'}`}>
                  <Tag color="purple" className="m-0 px-1 py-0 text-[9px] leading-[14px] border-0">
                    <GlobalOutlined style={{ fontSize: '8px' }} />
                  </Tag>
                </Tooltip>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>{rollNumber}</Text>
            {isExternal && institution && (
              <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }} ellipsis={{ tooltip: institution.name }}>
                <GlobalOutlined style={{ fontSize: 8, marginRight: 2 }} />
                {institution.code || institution.name}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Company & Duration',
      key: 'company',
      width: 200,
      ellipsis: true,
      sorter: (a, b) => {
        const companyA = getCompanyName(a).toLowerCase();
        const companyB = getCompanyName(b).toLowerCase();
        return companyA.localeCompare(companyB);
      },
      render: (_, student) => {
        const internshipApp = getInternshipApp(student);
        const startDate = internshipApp?.startDate;
        const endDate = internshipApp?.endDate;

        return (
          <div style={{ maxWidth: 190 }}>
            <Text strong style={{ fontSize: 12, display: 'block' }} ellipsis={{ tooltip: getCompanyName(student) }}>
              {getCompanyName(student)}
            </Text>
            {(startDate || endDate) && (
              <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                {startDate && dayjs(startDate).format('DD MMM')}
                {startDate && endDate && ' - '}
                {endDate && dayjs(endDate).format('DD MMM YY')}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Visits',
      key: 'visits',
      width: 70,
      align: 'center',
      sorter: (a, b) => {
        const internshipAppA = getInternshipApp(a);
        const internshipAppB = getInternshipApp(b);
        const visitsA = getCompletedVisits(internshipAppA, a);
        const visitsB = getCompletedVisits(internshipAppB, b);
        return visitsA - visitsB;
      },
      render: (_, student) => getVisitStatus(student),
    },
    {
      title: 'Reports',
      key: 'reports',
      width: 70,
      align: 'center',
      sorter: (a, b) => {
        const internshipAppA = getInternshipApp(a);
        const internshipAppB = getInternshipApp(b);
        const reportsA = getSubmittedReports(internshipAppA, a);
        const reportsB = getSubmittedReports(internshipAppB, b);
        return reportsA - reportsB;
      },
      render: (_, student) => getReportStatus(student),
    },
    // {
    //   title: 'Letter',
    //   key: 'joiningLetter',
    //   width: 60,
    //   align: 'center',
    //   render: (_, student) => getJoiningLetterStatusIcon(student),
    // },
    {
      title: '',
      key: 'actions',
      width: 70,
      align: 'center',
      fixed: 'right',
      render: (_, student) => (
        <Space size={2}>
          <Tooltip title="View">
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              style={{ padding: '0 6px' }}
              onClick={(e) => {
                e.stopPropagation();
                const studentId = student.id || student.studentId || student.student?.id;
                if (onViewStudent) {
                  onViewStudent(studentId);
                }
              }}
            />
          </Tooltip>
          <Tooltip title="Log Visit">
            <Button
              size="small"
              icon={<EnvironmentOutlined />}
              style={{ padding: '0 6px' }}
              onClick={(e) => handleLogVisit(student, e)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title={
          <div className="flex items-center gap-2">
            <TeamOutlined style={{ color: token.colorPrimary }} />
            <span>Assigned Students</span>
            <Badge count={students.length} className="ml-2" />
          </div>
        }
        extra={
          <Input
            placeholder="Search students..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
        }
        className="h-full !rounded-xl"
        style={{ borderColor: token.colorBorder }}
      >
        <Table
          loading={loading}
          dataSource={filteredStudents}
          columns={columns}
          rowKey={(record) => record.id || record.studentId}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} students`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          scroll={{ x: 'max-content' }}
          size="middle"
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => {
              const studentId = record.id || record.studentId || record.student?.id;
              if (onViewStudent) {
                onViewStudent(studentId);
              }
            },
          })}
        />
      </Card>

      {/* Unified Visit Log Modal */}
      <UnifiedVisitLogModal
        visible={visitModalVisible}
        onClose={() => {
          setVisitModalVisible(false);
          setSelectedStudent(null);
        }}
        onSuccess={handleVisitSuccess}
        selectedStudent={selectedStudent}
        students={students}
      />
    </>
  );
};

export default AssignedStudentsList;