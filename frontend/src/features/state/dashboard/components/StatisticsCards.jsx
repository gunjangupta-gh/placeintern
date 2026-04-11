import React, { useState } from 'react';
import { Row, Col, Modal, Table, Spin, Typography } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  TeamOutlined,
  EyeOutlined,
  UserSwitchOutlined,
  CalendarOutlined,
  PlusOutlined,
  SettingOutlined,
  BookOutlined,
} from '@ant-design/icons';
import stateService from '../../../../services/state.service';

const { Text } = Typography;

const STAT_VARIANTS = {
  primary: {
    iconWrap: 'bg-blue-100',
    iconColor: 'text-blue-700',
  },
  warning: {
    iconWrap: 'bg-amber-100',
    iconColor: 'text-amber-700',
  },
  purple: {
    iconWrap: 'bg-purple-100',
    iconColor: 'text-purple-700',
  },
  success: {
    iconWrap: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
  },
  rose: {
    iconWrap: 'bg-rose-100',
    iconColor: 'text-rose-700',
  },
};

// College-wise breakdown modal
const CollegeBreakdownModal = ({ visible, onClose, title, loading, data, columns }) => (
  <Modal
    title={<span className="font-semibold text-base">{title}</span>}
    open={visible}
    onCancel={onClose}
    footer={null}
    width={700}
    className="[&_.ant-modal-content]:rounded-2xl"
  >
    {loading ? (
      <div className="flex justify-center py-12"><Spin /></div>
    ) : (
      <Table
        dataSource={data}
        columns={columns}
        rowKey={(record) => record.id || record.institutionId || record.name}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: false, size: 'small' }}
        className="mt-4 [&_.ant-table-thead_th]:bg-gray-50 [&_.ant-table-thead_th]:text-[10px] [&_.ant-table-thead_th]:font-bold [&_.ant-table-thead_th]:uppercase [&_.ant-table-thead_th]:text-text-tertiary"
      />
    )}
  </Modal>
);

const StatCard = ({ icon: Icon, title, lines = [], onClick, variant = 'primary' }) => {
  const styles = STAT_VARIANTS[variant] || STAT_VARIANTS.primary;

  return (
    <div
      className={`rounded-xl p-3 h-full border border-slate-200 bg-slate-50 ${onClick ? 'cursor-pointer hover:shadow-sm transition-all' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${styles.iconWrap}`}>
          <Icon className={`text-xs ${styles.iconColor}`} />
        </span>
        <Text className="text-[11px] text-slate-600 font-medium leading-tight line-clamp-1">
          {title}
        </Text>
      </div>
      <div className="space-y-1 mt-1">
        {lines.map((line) => (
          <Text key={line.label} className="block text-[12px] leading-snug text-slate-600">
            {line.label}: <span className="font-semibold text-slate-800">{line.value}</span>
          </Text>
        ))}
      </div>
    </div>
  );
};

const StatisticsCards = ({ stats, selectedMonth, trainingDashboard = null, trainingLoading = false }) => {
  const [modalType, setModalType] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [collegeData, setCollegeData] = useState([]);

  const filterMonth = selectedMonth ? selectedMonth.month() + 1 : null;
  const filterYear = selectedMonth ? selectedMonth.year() : null;

  // Extract stats
  const students = stats?.students || {};
  const faculty = stats?.faculty || {};
  const internships = stats?.internships || {};
  const facultyVisits = stats?.facultyVisits || {};
  const monthlyReports = stats?.monthlyReports || {};

  // Values
  const totalStudents = students?.active ?? 0;
  const activeInternships = internships?.active ?? students?.active ?? 0;
  const totalStaff =
    stats?.staff?.total ??
    stats?.staffBreakdown?.totalStaff ??
    faculty?.total ??
    stats?.totalFaculty ??
    0;
  const totalMentors =
    stats?.staff?.mentorsAndCoordinators ??
    stats?.staff?.mentors ??
    stats?.staffBreakdown?.mentorsAndCoordinators ??
    stats?.staffBreakdown?.mentors ??
    faculty?.mentors ??
    stats?.totalMentors ??
    0;
  const totalCoordinators =
    stats?.staff?.coordinators ??
    stats?.staff?.facultyCoordinators ??
    stats?.staffBreakdown?.coordinators ??
    0;
  const totalAdminStaff =
    stats?.staff?.adminStaff ??
    stats?.staffBreakdown?.adminStaff ??
    faculty?.adminStaff ??
    0;
  const teacherNoAssignmentFromApi =
    stats?.staff?.teachers ??
    stats?.staff?.teachersWithoutAssignments ??
    stats?.staffBreakdown?.teachers;
  const teacherNoAssignmentUpperBound = Math.max(
    0,
    totalStaff - totalAdminStaff - totalMentors,
  );
  const totalTeachers =
    teacherNoAssignmentFromApi != null
      ? Math.min(Math.max(0, teacherNoAssignmentFromApi), teacherNoAssignmentUpperBound)
      : teacherNoAssignmentUpperBound;
  const totalStaffReconciled = Math.max(
    totalStaff,
    totalMentors + totalTeachers + totalAdminStaff,
  );
  const totalTeacherSafe = Math.max(
    0,
    Math.min(totalTeachers, totalStaffReconciled - totalAdminStaff - totalMentors),
  );
  const totalTeachingStaffDisplay = totalMentors + totalTeacherSafe;
  const totalAdminSafe = Math.max(0, Math.min(totalAdminStaff, totalStaffReconciled));
  // Reports
  const reportsSubmitted = monthlyReports?.thisMonth ?? 0;
  const reportsExpected = monthlyReports?.expectedThisMonth ?? totalStudents;
  const reportsPercent = reportsExpected > 0 ? Math.round((reportsSubmitted / reportsExpected) * 100) : 0;

  // Visits
  const visitsCompleted = facultyVisits?.thisMonth ?? 0;
  const visitsExpected = facultyVisits?.expectedThisMonth ?? totalStudents;
  const visitsPercent = visitsExpected > 0 ? Math.round((visitsCompleted / visitsExpected) * 100) : 0;

  const displayMonth = selectedMonth
    ? selectedMonth.format('MMM YYYY')
    : new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // Fetch college-wise breakdown
  const fetchCollegeBreakdown = async (type) => {
    setModalType(type);
    setModalLoading(true);
    try {
      const typeMap = {
        students: 'students',
        reports: 'reports',
        teachingStaff: 'mentors',
        adminStaff: 'mentors',
        visits: 'visits',
      };

      const response = await stateService.getCollegeWiseBreakdown(typeMap[type] || type, { month: filterMonth, year: filterYear });
      const rawData = response?.data || response || [];

      const normalizedData = rawData.map((row) => {
        const rowTeachingStaff =
          row.mentorsAndCoordinators ??
          row.totalMentors ??
          row.mentors ??
          0;
        const rowAdminStaff = row.adminStaff ?? 0;
        const rowTotalStaff = row.totalStaff ?? rowTeachingStaff + rowAdminStaff;
        const rowTeachersFromApi =
          row.teachers ??
          row.teachersWithoutAssignments ??
          row.totalTeachersWithoutAssignment;
        const rowTeacherUpperBound = Math.max(
          0,
          rowTotalStaff - rowAdminStaff - rowTeachingStaff,
        );
        const rowTeachers =
          rowTeachersFromApi != null
            ? Math.min(Math.max(0, rowTeachersFromApi), rowTeacherUpperBound)
            : rowTeacherUpperBound;
        const rowCoordinators =
          row.coordinators ??
          row.facultyCoordinators ??
          0;
        const rowNonAdminStaff =
          row.nonAdminStaff ??
          Math.max(0, rowTotalStaff - rowAdminStaff);

        return {
          ...row,
          mentorsAndCoordinators: rowTeachingStaff,
          teachers: rowTeachers,
          coordinators: rowCoordinators,
          totalStaff: rowTotalStaff,
          nonAdminStaff: rowNonAdminStaff,
          adminStaff: rowAdminStaff,
        };
      });

      setCollegeData(normalizedData);
    } catch (error) {
      console.error('Error fetching college breakdown:', error);
      setCollegeData([]);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setCollegeData([]);
  };

  const getColumns = (type) => {
    const baseColumns = [{
      title: 'Institution',
      dataIndex: 'institutionName',
      key: 'institutionName',
      render: (text, record) => <Text className="text-sm font-medium">{text || record.name || 'Unknown'}</Text>,
    }];
    switch (type) {
      case 'students':
        return [...baseColumns,
          { title: 'Total', dataIndex: 'totalStudents', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
          { title: 'Active', dataIndex: 'activeStudents', align: 'center', render: (val) => <Text className="font-semibold text-green-600">{val?.toLocaleString() || 0}</Text> },
        ];
      case 'mentors':
        return [...baseColumns,
          { title: 'Mentors', dataIndex: 'totalMentors', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
          { title: 'Students Assigned', dataIndex: 'assignedStudents', align: 'center', render: (val) => <Text className="font-semibold text-blue-600">{val?.toLocaleString() || 0}</Text> },
        ];
      case 'teachingStaff':
        return [...baseColumns,
          { title: 'Mentors/Coordinators', dataIndex: 'mentorsAndCoordinators', align: 'center', render: (val) => <Text className="font-semibold text-blue-600">{val?.toLocaleString() || 0}</Text> },
          { title: 'Teachers', dataIndex: 'teachers', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
          { title: 'Coordinators', dataIndex: 'coordinators', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
        ];
      case 'adminStaff':
        return [...baseColumns,
          { title: 'Mentors/Coordinators', dataIndex: 'mentorsAndCoordinators', align: 'center', render: (val) => <Text className="font-semibold text-blue-600">{val?.toLocaleString() || 0}</Text> },
          { title: 'Teachers (No Assignment)', dataIndex: 'teachers', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
          { title: 'Coordinators', dataIndex: 'coordinators', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
          { title: 'Admin Staff', dataIndex: 'adminStaff', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
        ];
      case 'reports':
        return [...baseColumns,
          { title: 'Submitted', dataIndex: 'submitted', align: 'center', render: (val) => <Text className="font-semibold text-green-600">{val?.toLocaleString() || 0}</Text> },
          { title: 'Expected', dataIndex: 'expected', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
        ];
      case 'visits':
        return [...baseColumns,
          { title: 'Completed', dataIndex: 'completed', align: 'center', render: (val) => <Text className="font-semibold text-green-600">{val?.toLocaleString() || 0}</Text> },
          { title: 'Expected', dataIndex: 'expected', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
        ];
      default:
        return baseColumns;
    }
  };

  const getModalTitle = (type) => {
    switch (type) {
      case 'students': return 'College-wise Students';
      case 'mentors': return 'College-wise Mentors';
      case 'teachingStaff': return 'College-wise Teaching Staff (Mentors/Coordinators, Teachers)';
      case 'adminStaff': return 'College-wise Admin Staff';
      case 'reports': return 'College-wise Monthly Reports';
      case 'visits': return 'College-wise Faculty Visits';
      default: return 'College Breakdown';
    }
  };

  const dashboard = trainingDashboard?.dashboard || trainingDashboard || {};
  const trainings = dashboard.trainings || {};
  const applications = dashboard.applications || {};
  const summary = dashboard.summary || {};
  const lessonPlans = dashboard.lessonPlans || {};
  const trainingMetrics = dashboard.trainingMetrics || {};
  const facultyMetrics = dashboard.facultyMetrics || {};
  const completionMetrics = dashboard.completionMetrics || {};
  const hoursDistribution = dashboard.hoursDistribution || {};

  const trainingCards = [
    {
      title: 'Trainings',
      icon: CalendarOutlined,
      variant: 'primary',
      lines: [
        { label: 'Published', value: summary.totalTrainingsPublished || trainings.published || 0 },
        { label: 'Conducted', value: trainingMetrics.totalTrainingsConducted || 0 },
        { label: 'Hours Delivered', value: trainingMetrics.totalTrainingHoursDelivered || 0 },
      ],
    },
    {
      title: 'Faculty Trainings',
      icon: PlusOutlined,
      variant: 'warning',
      lines: [
        {
          label: 'Applications',
          value: summary.nominations || applications.nominations || applications.total || 0,
        },
        { label: 'Completed', value: facultyMetrics.facultyWithCompletedTrainings || 0 },
        { label: 'Ongoing', value: facultyMetrics.facultyWithOngoingTrainings || 0 },
      ],
    },
    {
      title: 'Lesson Plan',
      icon: BookOutlined,
      variant: 'purple',
      lines: [
        {
          label: 'Lesson Plans Created',
          value: summary.lessonPlanCreated || lessonPlans.created || lessonPlans.total || 0,
        },
      ],
    },
    {
      title: 'Completion & Hours',
      icon: SettingOutlined,
      variant: 'primary',
      lines: [
        { label: 'Completed ≥ 40 Hours', value: completionMetrics.facultyCompleted40Hours || 0 },
        { label: 'Completed < 40 Hours', value: completionMetrics.facultyCompletedUnder40Hours || 0 },
        { label: 'Avg. Hours per Faculty', value: hoursDistribution.averageHoursPerFaculty || 0 },
      ],
    },
  ];

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8} xl={5}>
          <StatCard
            icon={UserOutlined}
            title="Students"
            lines={[
              { label: 'Total Active', value: totalStudents.toLocaleString() },
              { label: 'Active Internships', value: activeInternships.toLocaleString() },
            ]}
            variant="primary"
            onClick={() => fetchCollegeBreakdown('students')}
          />
        </Col>

        <Col xs={24} sm={12} lg={8} xl={5}>
          <StatCard
            icon={FileTextOutlined}
            title="Monthly Reports"
            lines={[
              { label: 'Coverage', value: `${reportsPercent}%` },
              { label: 'Submitted', value: `${reportsSubmitted}/${reportsExpected}` },
              { label: 'Month', value: displayMonth },
            ]}
            variant="success"
            onClick={() => fetchCollegeBreakdown('reports')}
          />
        </Col>

        <Col xs={24} sm={12} lg={8} xl={5}>
          <StatCard
            icon={TeamOutlined}
            title="Teaching Staff"
            lines={[
              { label: 'Total', value: totalTeachingStaffDisplay.toLocaleString() },
              { label: 'Mentors/Coordinators', value: totalMentors.toLocaleString() },
              { label: 'Teachers (No Assign)', value: totalTeacherSafe.toLocaleString() },
            ]}
            variant="warning"
            onClick={() => fetchCollegeBreakdown('teachingStaff')}
          />
        </Col>

        <Col xs={24} sm={12} lg={8} xl={5}>
          <StatCard
            icon={UserSwitchOutlined}
            title="Admin Staff"
            lines={[
              { label: 'Total', value: totalAdminSafe.toLocaleString() },
            ]}
            variant="purple"
            onClick={() => fetchCollegeBreakdown('adminStaff')}
          />
        </Col>

        <Col xs={24} sm={12} lg={8} xl={4}>
          <StatCard
            icon={EyeOutlined}
            title="Faculty Visits"
            lines={[
              { label: 'Coverage', value: `${visitsPercent}%` },
              { label: 'Completed', value: `${visitsCompleted}/${visitsExpected}` },
              { label: 'Month', value: displayMonth },
            ]}
            variant="rose"
            onClick={() => fetchCollegeBreakdown('visits')}
          />
        </Col>
      </Row>

      <div className="mt-4">
        <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
          Training Statistics
        </Text>
        <Row gutter={[16, 16]}>
          {trainingLoading
            ? Array.from({ length: 4 }).map((_, idx) => (
                <Col key={`training-loading-${idx}`} xs={24} sm={12} lg={6}>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 h-full">
                    <Spin size="small" />
                  </div>
                </Col>
              ))
            : trainingCards.map((card) => (
                <Col key={card.title} xs={24} sm={12} lg={6}>
                  <StatCard {...card} />
                </Col>
              ))}
        </Row>
      </div>

      <CollegeBreakdownModal
        visible={modalType !== null}
        onClose={closeModal}
        title={getModalTitle(modalType)}
        loading={modalLoading}
        data={collegeData}
        columns={getColumns(modalType)}
      />
    </>
  );
};

export default StatisticsCards;
