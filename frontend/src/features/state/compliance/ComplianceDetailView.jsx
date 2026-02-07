import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Typography, Spin, Tag, Tabs, Progress, Card, Statistic, Row, Col } from 'antd';
import {
  BankOutlined,
  FileTextOutlined,
  EyeOutlined,
  TeamOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  FolderOutlined,
  UserOutlined,
  CheckCircleFilled,
  WarningFilled,
  CloseCircleFilled,
  PieChartOutlined,
} from '@ant-design/icons';

import StudentComplianceTable from './StudentComplianceTable';
import ComplianceFileExplorer from './ComplianceFileExplorer';
import {
  selectMonthlyComplianceSelectedDetails,
  selectMonthlyComplianceDetailsLoading,
  selectMonthlyComplianceDetailsError,
} from '../store/stateSlice';

const { Text, Title } = Typography;

const ComplianceDetailView = ({ institutionId, month, year }) => {
  const details = useSelector(selectMonthlyComplianceSelectedDetails);
  const loading = useSelector(selectMonthlyComplianceDetailsLoading);
  const error = useSelector(selectMonthlyComplianceDetailsError);
  const [activeTab, setActiveTab] = useState('overview');

  // Memoized summary data
  const summaryData = useMemo(() => {
    if (!details?.summary) return null;
    const { summary } = details;
    return {
      reports: {
        expected: summary.expectedReports || 0,
        submitted: summary.submittedReports || 0,
        rate: summary.reportComplianceRate,
      },
      visits: {
        expected: summary.expectedVisits || 0,
        completed: summary.completedVisits || 0,
        rate: summary.visitComplianceRate,
      },
      overall: summary.overallCompliance,
      studentsInTraining: summary.studentsInTraining || 0,
    };
  }, [details]);

  // Student status breakdown
  const studentStats = useMemo(() => {
    if (!details?.students) return { complete: 0, partial: 0, critical: 0 };
    return details.students.reduce((acc, s) => {
      const reportOk = s.reportStatus === 'submitted';
      const visitOk = s.visitStatus === 'completed';
      if (reportOk && visitOk) acc.complete++;
      else if (s.reportStatus === 'not_submitted') acc.critical++;
      else acc.partial++;
      return acc;
    }, { complete: 0, partial: 0, critical: 0 });
  }, [details]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-full gap-3">
        <Spin size="large" />
        <Text className="text-text-secondary text-sm">Loading institution details...</Text>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-full gap-3">
        <CloseCircleOutlined className="text-3xl text-error" />
        <Text className="text-error">Error loading details</Text>
        <Text className="text-text-tertiary text-sm">{error}</Text>
      </div>
    );
  }

  // No selection state
  if (!institutionId || !details) {
    return (
      <div className="flex flex-col justify-center items-center h-full gap-4">
        <div className="w-20 h-20 rounded-full bg-background-tertiary flex items-center justify-center">
          <BankOutlined className="text-3xl text-text-tertiary" />
        </div>
        <div className="text-center">
          <Text className="text-text-primary font-medium text-lg block">Select an Institution</Text>
          <Text className="text-text-tertiary text-sm">
            Click on an institution from the list to view compliance details
          </Text>
        </div>
      </div>
    );
  }

  const { institution } = details;

  const getStatusColor = (rate) => {
    if (rate === null || rate === undefined) return '#d9d9d9';
    if (rate >= 90) return '#52c41a';
    if (rate >= 50) return '#faad14';
    return '#ff4d4f';
  };

  const getTagColor = (rate) => {
    if (rate === null || rate === undefined) return 'default';
    if (rate >= 90) return 'success';
    if (rate >= 50) return 'warning';
    return 'error';
  };

  // Overview Tab Content
  const OverviewContent = () => (
    <div className="p-4 space-y-4">
      {/* Main Stats Cards */}
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card size="small" className="h-full border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <Text className="text-text-tertiary text-xs block mb-1">Monthly Reports</Text>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-text-primary">
                    {summaryData?.reports.submitted}
                  </span>
                  <span className="text-text-tertiary">/ {summaryData?.reports.expected}</span>
                </div>
              </div>
              <Progress
                type="circle"
                percent={summaryData?.reports.rate || 0}
                size={50}
                strokeColor={getStatusColor(summaryData?.reports.rate)}
                format={(percent) => <span className="text-xs font-semibold">{percent}%</span>}
              />
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" className="h-full border-l-4 border-l-green-500">
            <div className="flex items-center justify-between">
              <div>
                <Text className="text-text-tertiary text-xs block mb-1">Faculty Visits</Text>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-text-primary">
                    {summaryData?.visits.completed}
                  </span>
                  <span className="text-text-tertiary">/ {summaryData?.visits.expected}</span>
                </div>
              </div>
              <Progress
                type="circle"
                percent={summaryData?.visits.rate || 0}
                size={50}
                strokeColor={getStatusColor(summaryData?.visits.rate)}
                format={(percent) => <span className="text-xs font-semibold">{percent}%</span>}
              />
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" className="h-full border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <Text className="text-text-tertiary text-xs block mb-1">Overall Compliance</Text>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-text-primary">
                    {summaryData?.overall ?? 0}%
                  </span>
                </div>
              </div>
              <Progress
                type="circle"
                percent={summaryData?.overall || 0}
                size={50}
                strokeColor={getStatusColor(summaryData?.overall)}
                format={(percent) => <span className="text-xs font-semibold">{percent}%</span>}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Student Status Breakdown */}
      <Card size="small" title={<span className="text-sm"><TeamOutlined className="mr-2" />Student Status Breakdown</span>}>
        <Row gutter={16}>
          <Col span={8}>
            <div className="text-center p-3 bg-success/10 rounded-lg">
              <CheckCircleFilled className="text-success text-xl mb-1" />
              <div className="text-2xl font-bold text-success">{studentStats.complete}</div>
              <Text className="text-xs text-text-tertiary">Fully Compliant</Text>
            </div>
          </Col>
          <Col span={8}>
            <div className="text-center p-3 bg-warning/10 rounded-lg">
              <WarningFilled className="text-warning text-xl mb-1" />
              <div className="text-2xl font-bold text-warning">{studentStats.partial}</div>
              <Text className="text-xs text-text-tertiary">Partially Compliant</Text>
            </div>
          </Col>
          <Col span={8}>
            <div className="text-center p-3 bg-error/10 rounded-lg">
              <CloseCircleFilled className="text-error text-xl mb-1" />
              <div className="text-2xl font-bold text-error">{studentStats.critical}</div>
              <Text className="text-xs text-text-tertiary">Non-Compliant</Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Visit Type Breakdown */}
      {details?.visitsByType && details.visitsByType.total > 0 && (
        <Card size="small" title={<span className="text-sm"><EyeOutlined className="mr-2" />Visits by Type</span>}>
          <Row gutter={16}>
            <Col span={12}>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
                <EnvironmentOutlined className="text-xl mb-1" style={{ color: '#22c55e' }} />
                <div className="text-2xl font-bold" style={{ color: '#22c55e' }}>{details.visitsByType.inPerson}</div>
                <Text className="text-xs text-text-tertiary block">In-Person Visits</Text>
                <Text className="text-xs text-text-tertiary" style={{ fontSize: 10 }}>(Physical)</Text>
              </div>
            </Col>
            <Col span={12}>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <EyeOutlined className="text-xl mb-1" style={{ color: '#3b82f6' }} />
                <div className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{details.visitsByType.online}</div>
                <Text className="text-xs text-text-tertiary block">Online Visits</Text>
                <Text className="text-xs text-text-tertiary" style={{ fontSize: 10 }}>(Virtual: {details.visitsByType.virtual}, Telephonic: {details.visitsByType.telephonic})</Text>
              </div>
            </Col>
          </Row>
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-1">
              <Text className="text-xs text-text-tertiary">Distribution</Text>
              <Text className="text-xs text-text-tertiary ml-auto">{details.visitsByType.total} total visits</Text>
            </div>
            <div className="w-full overflow-hidden flex" style={{ height: 8, borderRadius: 4, backgroundColor: '#f3f4f6' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(details.visitsByType.physical / details.visitsByType.total) * 100}%`,
                  backgroundColor: '#22c55e',
                  borderRadius: '4px 0 0 4px',
                }}
              />
              <div
                style={{
                  height: '100%',
                  width: `${(details.visitsByType.virtual / details.visitsByType.total) * 100}%`,
                  backgroundColor: '#3b82f6',
                }}
              />
              <div
                style={{
                  height: '100%',
                  width: `${(details.visitsByType.telephonic / details.visitsByType.total) * 100}%`,
                  backgroundColor: '#f59e0b',
                  borderRadius: '0 4px 4px 0',
                }}
              />
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e' }} />
                <Text className="text-xs text-text-tertiary" style={{ fontSize: 10 }}>Physical ({details.visitsByType.physical})</Text>
              </div>
              <div className="flex items-center gap-1">
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                <Text className="text-xs text-text-tertiary" style={{ fontSize: 10 }}>Virtual ({details.visitsByType.virtual})</Text>
              </div>
              <div className="flex items-center gap-1">
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <Text className="text-xs text-text-tertiary" style={{ fontSize: 10 }}>Telephonic ({details.visitsByType.telephonic})</Text>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Info */}
      <Card size="small" title={<span className="text-sm"><BankOutlined className="mr-2" />Institution Details</span>}>
        <Row gutter={[16, 8]}>
          <Col span={12}>
            <Text className="text-text-tertiary text-xs block">Institution Code</Text>
            <Text className="font-mono">{institution?.code || 'N/A'}</Text>
          </Col>
          <Col span={12}>
            <Text className="text-text-tertiary text-xs block">Location</Text>
            <Text>{institution?.city || 'N/A'}</Text>
          </Col>
          <Col span={12}>
            <Text className="text-text-tertiary text-xs block">Students in Training</Text>
            <Text className="font-semibold">{summaryData?.studentsInTraining || 0}</Text>
          </Col>
          <Col span={12}>
            <Text className="text-text-tertiary text-xs block">Status</Text>
            <Tag color={getTagColor(summaryData?.overall)}>
              {summaryData?.overall >= 90 ? 'Excellent' : summaryData?.overall >= 50 ? 'Needs Attention' : 'Critical'}
            </Tag>
          </Col>
        </Row>
      </Card>
    </div>
  );

  // Tab items
  const tabItems = [
    {
      key: 'overview',
      label: (
        <span className="flex items-center gap-2">
          <PieChartOutlined />
          Overview
        </span>
      ),
      children: <OverviewContent />,
    },
    {
      key: 'students',
      label: (
        <span className="flex items-center gap-2">
          <UserOutlined />
          Students
          <Tag className="m-0 text-xs px-1.5">{details?.students?.length || 0}</Tag>
        </span>
      ),
      children: (
        <div className="p-4 h-full">
          <StudentComplianceTable students={details?.students || []} />
        </div>
      ),
    },
    {
      key: 'files',
      label: (
        <span className="flex items-center gap-2">
          <FolderOutlined />
          Files
        </span>
      ),
      children: (
        <div className="p-4 h-full">
          <ComplianceFileExplorer
            institutionId={institutionId}
            institutionName={institution?.shortName || institution?.name}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="compliance-detail-view h-full flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BankOutlined className="text-primary text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Title level={5} className="!m-0 !text-text-primary">
                  {institution?.name || 'Unknown Institution'}
                </Title>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Tag className="m-0 font-mono text-xs bg-background-tertiary border-0">
                  {institution?.code}
                </Tag>
                {institution?.city && (
                  <Text className="text-xs text-text-tertiary flex items-center gap-1">
                    <EnvironmentOutlined /> {institution.city}
                  </Text>
                )}
              </div>
            </div>
          </div>

          {/* Overall Score Badge */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <Text className="text-xs text-text-tertiary block">Overall Score</Text>
              <Text className="text-2xl font-bold" style={{ color: getStatusColor(summaryData?.overall) }}>
                {summaryData?.overall ?? 0}%
              </Text>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="compliance-detail-tabs h-full"
          tabBarStyle={{
            paddingLeft: 16,
            paddingRight: 16,
            marginBottom: 0,
            borderBottom: '1px solid #f0f0f0'
          }}
        />
      </div>

      <style>{`
        .compliance-detail-tabs .ant-tabs-content-holder {
          overflow: auto;
          height: calc(100% - 46px);
        }
        .compliance-detail-tabs .ant-tabs-content {
          height: 100%;
        }
        .compliance-detail-tabs .ant-tabs-tabpane {
          height: 100%;
          overflow: auto;
        }
      `}</style>
    </div>
  );
};

export default ComplianceDetailView;
