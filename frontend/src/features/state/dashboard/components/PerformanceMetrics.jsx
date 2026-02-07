import React from 'react';
import { Card, Row, Col, Progress, Typography, Divider, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  UserSwitchOutlined,
  CalendarOutlined,
  FileTextOutlined,
  BarChartOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

const MetricItem = ({ label, value, total, color, icon, tooltip }) => {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <Text className="text-text-secondary font-medium text-sm">
            {label}
            {tooltip && (
              <Tooltip title={tooltip}>
                <InfoCircleOutlined className="ml-1 text-text-tertiary text-xs" />
              </Tooltip>
            )}
          </Text>
        </div>
        <div className="text-right">
          <Text strong className="text-text-primary mr-1">{value}</Text>
          <Text type="secondary" className="text-xs">/ {total}</Text>
        </div>
      </div>
      <Progress
        percent={percent}
        strokeColor={color}
        railColor="rgba(var(--color-border), 0.5)"
        size="small"
        className="!m-0"
      />
    </div>
  );
};

const PerformanceMetrics = ({ stats }) => {
  if (!stats) return null;

  // Use the detailed stats if available, otherwise fallback
  // Use activeStudentsWithInternships as fallback (students with active internships)
  const assignments = stats.assignments || {
    total: stats.assignments?.activeStudentsWithInternships || 0,
    assigned: 0,
    unassigned: stats.assignments?.activeStudentsWithInternships || 0,
    activeStudentsWithInternships: stats.assignments?.activeStudentsWithInternships || 0
  };

  const visits = stats.facultyVisits || {
    expectedThisMonth: 0,
    thisMonth: 0,
    pendingThisMonth: 0
  };

  const reports = stats.monthlyReports || {
    expectedThisMonth: 0,
    thisMonth: 0,
    missingThisMonth: 0
  };

  // Use applications data from backend (not internships)
  const applications = stats.applications || {
    total: 0,
    accepted: 0,
    approvalRate: 0
  };

  // Calculate pending as difference (backend doesn't provide rejected count)
  const internships = {
    total: applications.total || 0,
    approved: applications.accepted || 0,
    pending: (applications.total || 0) - (applications.accepted || 0),
    rejected: 0  // Backend doesn't track rejected separately
  };

  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
            <BarChartOutlined className="text-indigo-500 text-lg" />
          </div>
          <span className="font-bold text-text-primary text-lg">Performance Metrics</span>
        </div>
      }
      className="shadow-sm border-border rounded-2xl h-full bg-surface"
      styles={{ header: { borderBottom: '1px solid var(--color-border)', padding: '20px 24px' }, body: { padding: '24px' } }}
    >
      <Row gutter={[32, 24]}>
        <Col xs={24} md={12}>
          <Title level={5} className="!mb-4 text-xs uppercase tracking-widest text-text-tertiary font-bold">Process Adherence</Title>
          
          <MetricItem
            label="Mentor Assignment"
            value={assignments.activeStudentsWithMentors || assignments.assigned || 0}
            total={assignments.activeStudents || assignments.activeStudentsWithInternships || assignments.total || 0}
            color="rgb(var(--color-primary))"
            icon={<UserSwitchOutlined className="text-primary" />}
            tooltip="Active students with assigned mentors"
          />
          
          <MetricItem
            label="Faculty Visits"
            value={visits.thisMonth || 0}
            total={visits.expectedThisMonth || (visits.thisMonth + visits.pendingThisMonth) || 0}
            color="rgb(var(--color-info))"
            icon={<CalendarOutlined className="text-info" />}
            tooltip="Completed visits vs expected for this month"
          />
          
          <MetricItem
            label="Monthly Reports"
            value={reports.thisMonth}
            total={reports.expectedThisMonth || (reports.thisMonth + reports.missingThisMonth)}
            color="rgb(var(--color-warning))"
            icon={<FileTextOutlined className="text-warning" />}
            tooltip="Submitted reports vs expected for this month"
          />
        </Col>

        <Col xs={24} md={12} className="relative md:pl-8">
          {/* Vertical divider for md screens and up */}
          <div className="hidden md:block absolute left-0 top-0 bottom-0 w-px bg-border"></div>
          
          <Title level={5} className="!mb-4 text-xs uppercase tracking-widest text-text-tertiary font-bold">Application Status</Title>
          
          <MetricItem
            label="Approved Applications"
            value={internships.approved}
            total={internships.total}
            color="rgb(var(--color-success))"
            icon={<CheckCircleOutlined className="text-success" />}
          />
          
          <MetricItem
            label="Pending Review"
            value={internships.pending}
            total={internships.total}
            color="rgb(var(--color-warning))"
            icon={<ClockCircleOutlined className="text-warning" />}
          />
          
          <MetricItem
            label="Rejected Applications"
            value={internships.rejected}
            total={internships.total}
            color="rgb(var(--color-error))"
            icon={<CloseCircleOutlined className="text-error" />}
          />
        </Col>
      </Row>
    </Card>
  );
};

export default PerformanceMetrics;