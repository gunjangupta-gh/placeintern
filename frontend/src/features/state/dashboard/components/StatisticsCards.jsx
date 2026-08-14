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
  RiseOutlined,
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
            {String(line.label || '')}:{" "}
            {line.tooltip ? (
              <Tooltip title={line.tooltip}>
                <span className="font-semibold text-slate-800 border-b border-dashed border-slate-400 cursor-help">
                  {String(line.value ?? '-')}
                </span>
              </Tooltip>
            ) : (
              <span className="font-semibold text-slate-800">{String(line.value ?? '-')}</span>
            )}
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
  const testPerformance = dashboard.testPerformance || {};
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
          startDate: item?.startDate,
          endDate: item?.endDate,
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
      // Use training-wise data if available (each item has per-training engagement breakdown)
      if (Array.isArray(trainingWiseSummary) && trainingWiseSummary.length > 0) {
        return trainingWiseSummary.map((item, index) => ({
          trainingId: item?.trainingId || `training-${index + 1}`,
          trainingTitle: item?.trainingTitle || item?.title || `Training ${index + 1}`,
          startDate: item?.startDate,
          endDate: item?.endDate,
          lessonPlanRequired: item?.lessonPlanRequired ?? 0,
          lessonPlanDone: item?.lessonPlanDone ?? 0,
          preTestRequired: item?.preTestRequired ?? 0,
          preTestDone: item?.preTestDone ?? 0,
          postTestRequired: item?.postTestRequired ?? 0,
          postTestDone: item?.postTestDone ?? 0,
          feedbackRequired: item?.feedbackRequired ?? 0,
          feedbackDone: item?.feedbackDone ?? 0,
        }));
      }

      // Fallback: simple item-wise format
      return [
        {
          item: 'Lesson Plan',
          required: engagementDetails.lessonPlan?.required ?? approvedApplicationsCount,
          done: engagementDetails.lessonPlan?.done ?? lessonPlans.total ?? 0,
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
  }, [trainingModalType, trainingWiseSummary, facultyTrainingDetails, facultyMetrics.facultyWithCompletedTrainings, trainings.total, approvedApplicationsCount, engagementDetails, lessonPlans.total, preTestResponses.total, postTestResponses.total, feedback.total]);

  const closeTrainingModal = () => setTrainingModalType(null);

  const engagementOverall = useMemo(() => {
    const calculatePercentage = (done, required) => {
      if (!required) return "0%";
      return `${Math.round((done / required) * 100)}%`;
    };

    let preTestReq = 0, preTestDone = 0;
    let postTestReq = 0, postTestDone = 0;
    let feedbackReq = 0, feedbackDone = 0;
    let lessonPlanReq = 0, lessonPlanDone = 0;

    if (Array.isArray(trainingWiseSummary) && trainingWiseSummary.length > 0) {
      trainingWiseSummary.forEach(item => {
        preTestReq += item.preTestRequired || 0;
        preTestDone += item.preTestDone || 0;
        postTestReq += item.postTestRequired || 0;
        postTestDone += item.postTestDone || 0;
        feedbackReq += item.feedbackRequired || 0;
        feedbackDone += item.feedbackDone || 0;
        lessonPlanReq += item.lessonPlanRequired || 0;
        lessonPlanDone += item.lessonPlanDone || 0;
      });
    } else {
      preTestReq = engagementDetails.preTest?.required ?? preTestResponses.total ?? 0;
      preTestDone = engagementDetails.preTest?.done ?? preTestResponses.total ?? 0;
      postTestReq = engagementDetails.postTest?.required ?? postTestResponses.total ?? 0;
      postTestDone = engagementDetails.postTest?.done ?? postTestResponses.total ?? 0;
      feedbackReq = engagementDetails.feedback?.required ?? feedback.total ?? 0;
      feedbackDone = engagementDetails.feedback?.done ?? feedback.total ?? 0;
      lessonPlanReq = engagementDetails.lessonPlan?.required ?? approvedApplicationsCount;
      lessonPlanDone = engagementDetails.lessonPlan?.done ?? lessonPlans.total ?? 0;
    }

    return {
      preTest: calculatePercentage(preTestDone, preTestReq),
      postTest: calculatePercentage(postTestDone, postTestReq),
      feedback: calculatePercentage(feedbackDone, feedbackReq),
      lessonPlan: calculatePercentage(lessonPlanDone, lessonPlanReq),
    };
  }, [trainingWiseSummary, engagementDetails, preTestResponses, postTestResponses, lessonPlans, feedback, approvedApplicationsCount]);

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
          label: 'No. of Attendees',
          value: facultyTrainingDetails.facultyAttendeesCount ?? 0,
          tooltip: 'Unique faculty who attended at least one day of a completed training out of their approved nominations.',
        },
        { label: 'Ongoing', value: trainings.ongoing || 0 },
      ],
      onView: () => setTrainingModalType('faculty'),
      infoTooltip: 'Unique faculty counts based on approved nominations. "No. of Attendees" counts faculty with at least one day of marked attendance in a completed training — full attendance is not required.',
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
        { label: 'Pre-Test Filled', value: engagementOverall.preTest },
        { label: 'Post-Test Filled', value: engagementOverall.postTest },
        { label: 'Feedback Submitted', value: engagementOverall.feedback },
        { label: 'Lesson Plans', value: engagementOverall.lessonPlan },
      ],
      onView: () => setTrainingModalType('engagement'),
    },
    {
      title: 'Test Performance',
      icon: RiseOutlined,
      variant: 'success',
      lines: [
        { label: 'Avg Pre-Test Score', value: `${testPerformance.avgPreTestScore ?? 0}%` },
        { label: 'Avg Post-Test Score', value: `${testPerformance.avgPostTestScore ?? 0}%` },
        {
          label: (testPerformance.avgImprovement ?? 0) >= 0 ? 'Improvement' : 'Decline',
          value: `${(testPerformance.avgImprovement ?? 0) >= 0 ? '+' : ''}${testPerformance.avgImprovement ?? 0}%`,
          tooltip: `Based on ${testPerformance.totalCompared ?? 0} faculty who submitted both pre-test and post-test. Improved: ${testPerformance.facultyImproved ?? 0}, Declined: ${testPerformance.facultyDeclined ?? 0}, No Change: ${testPerformance.facultyNoChange ?? 0}.`,
        },
      ],
      infoTooltip: 'Improvement = Avg Post-Test Score − Avg Pre-Test Score, across faculty who submitted both tests for a training.',
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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

      <EngagementDetailsModal
        open={trainingModalType !== null}
        onCancel={closeTrainingModal}
        engagementData={trainingModalRows}
        type={trainingModalType || 'engagement'}
      />

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
