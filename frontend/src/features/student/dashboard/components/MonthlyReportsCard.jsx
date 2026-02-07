import React from 'react';
import { Card, Tag, Button, Typography, Empty, Progress, Avatar } from 'antd';
import {
  FileTextOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const getStatusConfig = (status) => {
  const configs = {
    DRAFT: { color: 'default', icon: <ClockCircleOutlined />, label: 'Draft' },
    APPROVED: { color: 'green', icon: <CheckCircleOutlined />, label: 'Approved' },
  };
  return configs[status] || { color: 'default', icon: <ClockCircleOutlined />, label: status };
};

const MonthlyReportsCard = ({
  reports = [],
  loading,
  onUploadReport,
  canUpload,
  totalRequired,
  submitted,
  activeInternship,
}) => {
  // Use ONLY counter fields from API, default to 0 if not available
  const submittedCount = activeInternship?.submittedReportsCount ?? 0;
  const totalExpected = activeInternship?.totalExpectedReports ?? 0;
  const progressPercent = totalExpected > 0 ? Math.round((submittedCount / totalExpected) * 100) : 0;

  // Check if internship starts in the future and get start date display
  const getStartDateInfo = () => {
    if (!activeInternship) return null;

    const startDate = new Date(
      activeInternship.isSelfIdentified
        ? activeInternship.startDate
        : activeInternship.joiningDate || activeInternship.internship?.startDate
    );

    if (!startDate || isNaN(startDate.getTime())) return null;

    const now = new Date();
    const threeMonthsLater = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());

    // Show start date if internship hasn't started yet and starts within next 3 months
    if (startDate >= now && startDate <= threeMonthsLater) {
      const startMonth = startDate.toLocaleString('default', { month: 'short' });
      const monthsUntilStart = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24 * 30));

      return {
        dateStr: `${startMonth} ${startDate.getDate()}, ${startDate.getFullYear()}`,
        message: monthsUntilStart <= 1
          ? "Starting soon - Reports will be due monthly"
          : `Starts in ~${monthsUntilStart} month${monthsUntilStart > 1 ? 's' : ''}`
      };
    }

    return null;
  };

  const startDateInfo = getStartDateInfo();

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-secondary-500" />
          <span>Monthly Reports</span>
        </div>
      }
      extra={
        canUpload && (
          <Button type="primary" icon={<UploadOutlined />} onClick={onUploadReport}>
            Upload Report
          </Button>
        )
      }
      className="h-full border border-border rounded-xl"
    >
      {/* Progress Summary */}
      {totalExpected > 0 && (
        <div className="mb-4 p-3 bg-secondary-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <Text className="text-sm">Report Submission Progress</Text>
            <Text className="text-sm font-medium">{submittedCount}/{totalExpected}</Text>
          </div>
          <Progress
            percent={progressPercent}
            size="small"
            showInfo={false}
          />
        </div>
      )}

      {/* Reports List */}
      {reports.length > 0 ? (
        <div className="flex flex-col gap-3">
          {reports.slice(0, 5).map((report, index) => {
            const statusConfig = getStatusConfig(report.status);
            const monthName = dayjs()
              .month(report.reportMonth - 1)
              .format('MMMM');

            return (
              <div key={report.id || index} className={`flex items-center justify-between w-full pb-3 ${index !== reports.slice(0, 5).length - 1 ? 'border-b border-border/50' : ''}`}>
                <div className="flex items-center gap-3">
                  <Avatar
                    size="small"
                    icon={<FileTextOutlined />}
                    className="bg-secondary-100 text-secondary-600"
                  />
                  <div>
                    <Text className="text-sm font-medium block">
                      {monthName} {report.reportYear}
                    </Text>
                    <Text className="text-xs text-text-secondary">
                      {report.submittedAt
                        ? `Submitted ${dayjs(report.submittedAt).format('MMM DD')}`
                        : 'Not submitted'}
                    </Text>
                  </div>
                </div>
                <Tag color={statusConfig.color} icon={statusConfig.icon} className="m-0">
                  {statusConfig.label}
                </Tag>
              </div>
            );
          })}
        </div>
      ) : totalExpected === 0 && startDateInfo ? (
        // Show internship start date when no reports yet and internship starts soon
        <div className="text-center py-6">
          <div className="mb-3">
            <Tag color="blue" className="!px-3 !py-1.5 text-sm">
              Starts: {startDateInfo.dateStr}
            </Tag>
          </div>
          <Text type="secondary" className="text-xs block">
            {startDateInfo.message}
          </Text>
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No reports submitted yet"
        />
      )}
    </Card>
  );
};

export default MonthlyReportsCard;