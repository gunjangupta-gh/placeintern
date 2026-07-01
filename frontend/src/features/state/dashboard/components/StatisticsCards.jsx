import React, { useState, useMemo } from 'react';
import { Row, Col, Modal, Table, Spin, Typography, Tooltip } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  TeamOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  UserSwitchOutlined,
  CalendarOutlined,
  PlusOutlined,
  SettingOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import stateService from '../../../../services/state.service';
import EngagementDetailsModal from '../../../../components/training/EngagementDetailsModal';
import EngagementCard from '../../../../components/training/EngagementCard';

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

const StatCard = ({ icon: Icon, title, lines = [], onClick, onView, infoTooltip, variant = 'primary' }) => {
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
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${styles.iconWrap}`}>
            <Icon className={`text-xs ${styles.iconColor}`} />
          </span>
          <Text className="text-[11px] text-slate-600 font-medium leading-tight line-clamp-1">
            {title}
          </Text>
          {infoTooltip ? (
            <Tooltip title={infoTooltip}>
              <InfoCircleOutlined className="text-[11px] text-slate-400" />
            </Tooltip>
          ) : null}
        </div>
        {onView ? (
          <button
            type="button"
            aria-label={`View ${title}`}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:bg-slate-200/70 transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              onView();
            }}
          >
            <EyeOutlined className="text-xs" />
          </button>
        ) : onClick ? (
          <button
            type="button"
            aria-label={`View ${title}`}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:bg-slate-200/70 transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          >
            <EyeOutlined className="text-xs" />
          </button>
        ) : null}
      </div>
      <div className="space-y-1 mt-1">
        {lines.map((line) => (
          <Text key={String(line.label || '')} className="block text-[12px] leading-snug text-slate-600">
            {String(line.label || '')}: <span className="font-semibold text-slate-800">{String(line.value ?? '-')}</span>
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
  const [trainingModalType, setTrainingModalType] = useState(null);

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
      render: (text, record) => <Text className="text-sm font-medium">{String(text || record.name || 'Unknown')}</Text>,
    }];
    const safeLocaleString = (val) => {
      const num = Number(val || 0);
      return num.toLocaleString();
    };
    switch (type) {
      case 'students':
        return [...baseColumns,
          { title: 'Total', dataIndex: 'totalStudents', align: 'center', render: (val) => <Text className="font-semibold">{safeLocaleString(val)}</Text> },
          { title: 'Active', dataIndex: 'activeStudents', align: 'center', render: (val) => <Text className="font-semibold text-green-600">{safeLocaleString(val)}</Text> },
        ];
      case 'mentors':
        return [...baseColumns,
          { title: 'Mentors', dataIndex: 'totalMentors', align: 'center', render: (val) => <Text className="font-semibold">{safeLocaleString(val)}</Text> },
          { title: 'Students Assigned', dataIndex: 'assignedStudents', align: 'center', render: (val) => <Text className="font-semibold text-blue-600">{safeLocaleString(val)}</Text> },
        ];
      case 'teachingStaff':
        return [...baseColumns,
          { title: 'Mentors/Coordinators', dataIndex: 'mentorsAndCoordinators', align: 'center', render: (val) => <Text className="font-semibold text-blue-600">{safeLocaleString(val)}</Text> },
          { title: 'Teachers', dataIndex: 'teachers', align: 'center', render: (val) => <Text className="font-semibold">{safeLocaleString(val)}</Text> },
          { title: 'Coordinators', dataIndex: 'coordinators', align: 'center', render: (val) => <Text className="font-semibold">{safeLocaleString(val)}</Text> },
        ];
      case 'adminStaff':
        return [...baseColumns,
          { title: 'Mentors/Coordinators', dataIndex: 'mentorsAndCoordinators', align: 'center', render: (val) => <Text className="font-semibold text-blue-600">{safeLocaleString(val)}</Text> },
          { title: 'Teachers (No Assignment)', dataIndex: 'teachers', align: 'center', render: (val) => <Text className="font-semibold">{safeLocaleString(val)}</Text> },
          { title: 'Coordinators', dataIndex: 'coordinators', align: 'center', render: (val) => <Text className="font-semibold">{safeLocaleString(val)}</Text> },
          { title: 'Admin Staff', dataIndex: 'adminStaff', align: 'center', render: (val) => <Text className="font-semibold">{safeLocaleString(val)}</Text> },
        ];
      case 'reports':
        return [...baseColumns,
          { title: 'Submitted', dataIndex: 'submitted', align: 'center', render: (val) => <Text className="font-semibold text-green-600">{safeLocaleString(val)}</Text> },
          { title: 'Expected', dataIndex: 'expected', align: 'center', render: (val) => <Text className="font-semibold">{safeLocaleString(val)}</Text> },
        ];
      case 'visits':
        return [...baseColumns,
          { title: 'Completed', dataIndex: 'completed', align: 'center', render: (val) => <Text className="font-semibold text-green-600">{safeLocaleString(val)}</Text> },
          { title: 'Expected', dataIndex: 'expected', align: 'center', render: (val) => <Text className="font-semibold">{safeLocaleString(val)}</Text> },
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
  const feedback = dashboard.feedback || {};
  const preTestResponses = dashboard.preTestResponses || {};
  const postTestResponses = dashboard.postTestResponses || {};
  const facultyTrainingDetails = dashboard?.facultyTrainingDetails || {};
  const trainingWiseSummary = dashboard?.trainingWiseSummary || [];
  const engagementDetails = dashboard?.engagementDetails || {};
  const approvedApplicationsCount = summary?.nominations || applications?.total || 0;

  const trainingModalRows = useMemo(() => {
    if (trainingModalType === 'faculty') {
      if (Array.isArray(trainingWiseSummary) && trainingWiseSummary.length > 0) {
        return trainingWiseSummary.map((item, index) => ({
          trainingId: item?.trainingId || `training-${index + 1}`,
          trainingTitle: item?.trainingTitle || item?.title || `Training ${index + 1}`,
          totalTrainings: item?.totalTrainings ?? 1,
          totalNominations: item?.totalNominations ?? 0,
          facultyWithFullAttendanceMarked: item?.facultyWithFullAttendanceMarked ?? 0,
          facultyWithNotFullAttendance: item?.facultyWithNotFullAttendance ?? 0,
        }));
      }

      return [
        { metric: 'Total Trainings', count: facultyTrainingDetails.totalTrainings ?? trainings.total ?? 0 },
        { metric: 'Total Nominations', count: facultyTrainingDetails.totalNominations ?? approvedApplicationsCount },
        {
          metric: 'Faculty with Full Attendance Marked',
          count:
            facultyTrainingDetails.facultyWithFullAttendanceMarked ??
            facultyMetrics.facultyWithCompletedTrainings ??
            0,
        },
        { metric: 'Faculty with Not Full Attendance', count: facultyTrainingDetails.facultyWithNotFullAttendance ?? 0 },
      ];
    }

    if (trainingModalType === 'engagement') {
      return [
        {
          item: 'Lesson Plan',
          required: engagementDetails.lessonPlan?.required ?? approvedApplicationsCount,
          done: engagementDetails.lessonPlan?.done ?? lessonPlans.approved ?? 0,
        },
        {
          item: 'Pre-Test',
          required: engagementDetails.preTest?.required ?? preTestResponses.total ?? 0,
          done: engagementDetails.preTest?.done ?? preTestResponses.total ?? 0,
        },
        {
          item: 'Post-Test',
          required: engagementDetails.postTest?.required ?? postTestResponses.total ?? 0,
          done: engagementDetails.postTest?.done ?? postTestResponses.total ?? 0,
        },
        {
          item: 'Feedback',
          required: engagementDetails.feedback?.required ?? feedback.total ?? 0,
          done: engagementDetails.feedback?.done ?? feedback.total ?? 0,
        },
      ];
    }

    return [];
  }, [trainingModalType, trainingWiseSummary, facultyTrainingDetails, facultyMetrics.facultyWithCompletedTrainings, trainings.total, approvedApplicationsCount, engagementDetails, lessonPlans.approved, preTestResponses.total, postTestResponses.total, feedback.total]);

  const trainingModalConfig = useMemo(() => {
    if (trainingModalType === 'faculty') {
      const hasTrainingRows = Array.isArray(trainingWiseSummary) && trainingWiseSummary.length > 0;
      return {
        title: 'Training Wise Summary',
        width: 800,
        columns: hasTrainingRows
          ? [
              { title: 'Training', dataIndex: 'trainingTitle', key: 'trainingTitle', render: (value) => (
                  <Tooltip title={String(value || '')}>
                    <div
                      className="text-sm"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        wordBreak: 'break-word',
                      }}
                    >
                      {String(value || '')}
                    </div>
                  </Tooltip>
                ) },
              { title: 'Total Trainings', dataIndex: 'totalTrainings', key: 'totalTrainings', align: 'right', width: 120, render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text> },
              { title: 'Total Nominations', dataIndex: 'totalNominations', key: 'totalNominations', align: 'right', width: 140, render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text> },
              { title: 'Faculty with Full Attendance Marked', dataIndex: 'facultyWithFullAttendanceMarked', key: 'facultyWithFullAttendanceMarked', align: 'right', width: 180, render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text> },
              { title: 'Faculty with Not Full Attendance', dataIndex: 'facultyWithNotFullAttendance', key: 'facultyWithNotFullAttendance', align: 'right', width: 180, render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text> },
            ]
          : [
              { title: 'Metric', dataIndex: 'metric', key: 'metric', render: (value) => <Text className="text-sm">{String(value || '')}</Text> },
              { title: 'Count', dataIndex: 'count', key: 'count', align: 'right', width: 120, render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text> },
            ],
        dataSource: trainingModalRows,
      };
    }

    if (trainingModalType === 'engagement') {
      return {
        title: 'Engagement Details',
        width: 720,
        columns: [
          { title: 'Item', dataIndex: 'item', key: 'item', render: (value) => <Text className="text-sm">{String(value || '')}</Text> },
          { title: 'Required', dataIndex: 'required', key: 'required', align: 'right', width: 120, render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text> },
          { title: 'Done', dataIndex: 'done', key: 'done', align: 'right', width: 120, render: (value) => <Text className="text-sm font-semibold text-emerald-600">{Number(value || 0)}</Text> },
        ],
      };
    }

    return null;
  }, [trainingModalType, trainingWiseSummary]);

  const closeTrainingModal = () => setTrainingModalType(null);

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
          label: 'Total Nominations',
          value: summary.nominations || applications.nominations || applications.total || 0,
        },
        {
          label: 'Completed',
          value:
            facultyTrainingDetails.facultyWithFullAttendanceMarked ??
            facultyMetrics.facultyWithCompletedTrainings ??
            0,
        },
        { label: 'Ongoing', value: trainings.ongoing || 0 },
      ],
      onView: () => setTrainingModalType('faculty'),
      infoTooltip: 'Unique faculty counts based on approved nominations. Full attendance means all scheduled training days were marked.',
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
      infoTooltip: 'Completed ≥ 40 Hours counts faculty whose total attended hours across approved trainings are at least 40. Completed < 40 Hours is the remaining faculty total after subtracting the 40+ hour group.',
    },
    {
      title: 'Engagement',
      icon: CheckCircleOutlined,
      variant: 'warning',
      lines: [
        { label: 'Pre-Test Filled', value: preTestResponses.total || 0 },
        { label: 'Post-Test Filled', value: postTestResponses.total || 0 },
        { label: 'Feedback Submitted', value: feedback.total || 0 },
        { label: 'Lesson Plans', value: summary.lessonPlanCreated || lessonPlans.created || lessonPlans.total || 0 },
      ],
      onView: () => setTrainingModalType('engagement'),
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
              { label: 'Submitted', value: `${reportsSubmitted}/${reportsExpected}` },
              { label: 'Coverage', value: `${reportsPercent}%` },
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
              { label: 'Completed', value: `${visitsCompleted}/${visitsExpected}` },
               { label: 'Coverage', value: `${visitsPercent}%` },
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {trainingLoading
            ? Array.from({ length: 5 }).map((_, idx) => (
                <div key={`training-loading-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 h-full">
                  <Spin size="small" />
                </div>
              ))
            : trainingCards.map((card) => (
                <StatCard key={card.title} {...card} />
              ))}
        </div>
      </div>

      {trainingModalType === 'engagement' ? (
        <EngagementDetailsModal
          open={trainingModalType === 'engagement'}
          onCancel={closeTrainingModal}
          engagementData={trainingModalRows}
        />
      ) : (
        <Modal
          title={<span className="font-semibold text-base">{trainingModalConfig?.title || 'Training Details'}</span>}
          open={trainingModalType !== null}
          onCancel={closeTrainingModal}
          footer={null}
          width={trainingModalConfig?.width || 720}
          className="[&_.ant-modal-content]:rounded-2xl"
          destroyOnClose
        >
          <Table
            rowKey={(record) => record.trainingId || record.metric || record.item}
            columns={trainingModalConfig?.columns || []}
            dataSource={trainingModalRows}
            size="small"
            pagination={false}
            className="mt-4 [&_.ant-table-thead_th]:bg-gray-50 [&_.ant-table-thead_th]:text-[10px] [&_.ant-table-thead_th]:font-bold [&_.ant-table-thead_th]:uppercase [&_.ant-table-thead_th]:text-slate-500"
          />
        </Modal>
      )}

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
