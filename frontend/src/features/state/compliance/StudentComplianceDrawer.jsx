import React, { useState, useEffect, useMemo } from 'react';
import {
  Drawer,
  Typography,
  Tag,
  Spin,
  Empty,
  Button,
  Tooltip,
  Space,
  Tabs,
  List,
  Descriptions,
  Timeline,
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  CalendarOutlined,
  ShopOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileUnknownOutlined,
  FolderOutlined,
  SafetyCertificateOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import stateService from '../../../services/state.service';

const { Text } = Typography;

// Document type labels
const DOCUMENT_TYPE_LABELS = {
  MARKSHEET_10TH: '10th Marksheet',
  MARKSHEET_12TH: '12th Marksheet',
  CASTE_CERTIFICATE: 'Caste Certificate',
  PHOTO: 'Photo',
  JOINING_LETTER: 'Joining Report',
  MONTHLY_REPORT: 'Monthly Report',
  OTHER: 'Other',
};

// Get document icon based on file type
const getDocumentIcon = (fileName, type) => {
  if (type === 'JOINING_LETTER') return <SafetyCertificateOutlined className="text-green-500" />;
  if (type === 'MONTHLY_REPORT') return <FileTextOutlined className="text-blue-500" />;
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext)) return <FilePdfOutlined className="text-red-500" />;
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return <FileImageOutlined className="text-purple-500" />;
  return <FileUnknownOutlined className="text-gray-500" />;
};

const StudentComplianceDrawer = ({
  open,
  onClose,
  student,
  month,
  year,
}) => {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Set initial tab based on openTab prop
  useEffect(() => {
    if (student?.openTab) {
      setActiveTab(student.openTab);
    } else {
      setActiveTab('overview');
    }
  }, [student?.openTab, student?.studentId]);

  // Fetch student documents when drawer opens
  useEffect(() => {
    if (open && student?.studentId) {
      fetchStudentDocuments();
    }
  }, [open, student?.studentId]);

  const fetchStudentDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await stateService.getStudentDocuments(student.studentId);
      setDocuments(response.documents || []);
    } catch (err) {
      console.error('Failed to fetch student documents:', err);
      setError(err.message || 'Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // Group documents by type
  const groupedDocs = useMemo(() => {
    const groups = {
      marksheets: documents.filter(d => d.type?.includes('MARKSHEET')),
      certificates: documents.filter(d => d.type === 'CASTE_CERTIFICATE'),
      photos: documents.filter(d => d.type === 'PHOTO'),
      others: documents.filter(d => !['MARKSHEET_10TH', 'MARKSHEET_12TH', 'CASTE_CERTIFICATE', 'PHOTO'].includes(d.type)),
    };
    return groups;
  }, [documents]);

  if (!student) return null;

  const reportSubmitted = student.reportStatus === 'submitted';
  const reportPending = student.reportStatus === 'pending';
  const visitCompleted = student.visitStatus === 'completed';
  const monthName = month ? dayjs().month(month - 1).format('MMMM') : '';

  // Tab items
  const tabItems = [
    {
      key: 'overview',
      label: (
        <span className="flex items-center gap-1.5">
          <UserOutlined />
          <span className="text-xs">Overview</span>
        </span>
      ),
      children: (
        <div className="space-y-3">
          {/* Student Quick Info */}
          <div className="bg-background-tertiary rounded-lg p-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <Text className="text-text-tertiary text-xs block">Roll Number</Text>
                <Text className="font-mono">{student.rollNumber || 'N/A'}</Text>
              </div>
              <div>
                <Text className="text-text-tertiary text-xs block">Branch</Text>
                <Text>{student.branch || 'N/A'}</Text>
              </div>
              <div className="col-span-2">
                <Text className="text-text-tertiary text-xs block">Company</Text>
                <Text className="flex items-center gap-1">
                  <ShopOutlined className="text-text-tertiary" />
                  {student.companyName || 'N/A'}
                </Text>
              </div>
              {student.internshipPeriod && (
                <div className="col-span-2">
                  <Text className="text-text-tertiary text-xs block">Internship Period</Text>
                  <Text className="flex items-center gap-1">
                    <CalendarOutlined className="text-text-tertiary" />
                    {dayjs(student.internshipPeriod.startDate).format('DD MMM YYYY')}
                    {' - '}
                    {student.internshipPeriod.endDate ? dayjs(student.internshipPeriod.endDate).format('DD MMM YYYY') : 'Ongoing'}
                  </Text>
                </div>
              )}
            </div>
          </div>

          {/* Compliance Summary */}
          <div className="bg-background-tertiary rounded-lg p-3">
            <Text className="text-xs text-text-tertiary block mb-2">
              {monthName} {year} Compliance
            </Text>
            <div className="flex items-center justify-around">
              <div className="text-center">
                <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center ${reportSubmitted ? 'bg-success/20' : reportPending ? 'bg-warning/20' : 'bg-error/20'}`}>
                  <FileTextOutlined className={reportSubmitted ? 'text-success' : reportPending ? 'text-warning' : 'text-error'} />
                </div>
                <Text className="text-xs block mt-1">Report</Text>
                <Tag color={reportSubmitted ? 'success' : reportPending ? 'warning' : 'error'} className="m-0 mt-1 text-[10px]">
                  {reportSubmitted ? 'Done' : reportPending ? 'Review' : 'Missing'}
                </Tag>
              </div>
              <div className="text-center">
                <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center ${visitCompleted ? 'bg-success/20' : 'bg-warning/20'}`}>
                  <EyeOutlined className={visitCompleted ? 'text-success' : 'text-warning'} />
                </div>
                <Text className="text-xs block mt-1">Visit</Text>
                <Tag color={visitCompleted ? 'success' : 'warning'} className="m-0 mt-1 text-[10px]">
                  {visitCompleted ? 'Done' : 'Pending'}
                </Tag>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'report',
      label: (
        <span className="flex items-center gap-1.5">
          <FileTextOutlined className={reportSubmitted ? 'text-success' : ''} />
          <span className="text-xs">Report</span>
        </span>
      ),
      children: (
        <div className="space-y-3">
          <div className={`rounded-lg p-4 ${reportSubmitted ? 'bg-success/10' : reportPending ? 'bg-warning/10' : 'bg-error/10'}`}>
            <div className="flex items-center justify-between mb-3">
              <Text className="font-medium">{monthName} {year} Report</Text>
              <Tag
                icon={reportSubmitted ? <CheckCircleOutlined /> : reportPending ? <ClockCircleOutlined /> : <CloseCircleOutlined />}
                color={reportSubmitted ? 'success' : reportPending ? 'warning' : 'error'}
              >
                {reportSubmitted ? 'Submitted' : reportPending ? 'Pending Review' : 'Not Submitted'}
              </Tag>
            </div>
            {student.reportSubmittedAt && (
              <Text className="text-sm text-text-secondary block">
                <CalendarOutlined className="mr-1" />
                Submitted on {dayjs(student.reportSubmittedAt).format('DD MMM YYYY, HH:mm')}
              </Text>
            )}
            {student.reportFileUrl && (
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                className="mt-3"
                onClick={() => window.open(student.reportFileUrl, '_blank')}
              >
                View Report
              </Button>
            )}
            {!reportSubmitted && !reportPending && (
              <Text className="text-sm text-text-tertiary block mt-2">
                Report has not been submitted for this month.
              </Text>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'visit',
      label: (
        <span className="flex items-center gap-1.5">
          <EyeOutlined className={visitCompleted ? 'text-success' : ''} />
          <span className="text-xs">Visit</span>
        </span>
      ),
      children: (
        <div className="space-y-3">
          <div className={`rounded-lg p-4 ${visitCompleted ? 'bg-success/10' : 'bg-warning/10'}`}>
            <div className="flex items-center justify-between mb-3">
              <Text className="font-medium">{monthName} {year} Faculty Visit</Text>
              <Tag
                icon={visitCompleted ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                color={visitCompleted ? 'success' : 'warning'}
              >
                {visitCompleted ? 'Completed' : 'Pending'}
              </Tag>
            </div>
            {student.visitDate && (
              <Text className="text-sm text-text-secondary block">
                <CalendarOutlined className="mr-1" />
                Visit on {dayjs(student.visitDate).format('DD MMM YYYY')}
              </Text>
            )}
            {student.mentorName && (
              <Text className="text-sm text-text-secondary block mt-1">
                <UserOutlined className="mr-1" />
                Faculty: {student.mentorName}
              </Text>
            )}
            {!visitCompleted && (
              <Text className="text-sm text-text-tertiary block mt-2">
                Faculty visit is yet to be completed for this month.
              </Text>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'documents',
      label: (
        <span className="flex items-center gap-1.5">
          <FolderOutlined />
          <span className="text-xs">Docs</span>
          {!loading && <Tag className="m-0 text-[10px] px-1">{documents.length}</Tag>}
        </span>
      ),
      children: (
        <div className="space-y-2">
          {loading ? (
            <div className="flex flex-col justify-center items-center py-8 gap-2">
              <Spin size="small" />
              <Text className="text-text-tertiary text-xs">Loading...</Text>
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <Text className="text-error text-sm">{error}</Text>
              <Button type="link" size="small" onClick={fetchStudentDocuments}>Retry</Button>
            </div>
          ) : documents.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No documents" className="py-4" />
          ) : (
            <>
              {/* Quick document categories */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center p-2 bg-background-tertiary rounded-lg">
                  <Text className="text-lg font-semibold block">{groupedDocs.marksheets.length}</Text>
                  <Text className="text-[10px] text-text-tertiary">Marksheets</Text>
                </div>
                <div className="text-center p-2 bg-background-tertiary rounded-lg">
                  <Text className="text-lg font-semibold block">{groupedDocs.certificates.length}</Text>
                  <Text className="text-[10px] text-text-tertiary">Certificates</Text>
                </div>
                <div className="text-center p-2 bg-background-tertiary rounded-lg">
                  <Text className="text-lg font-semibold block">{groupedDocs.photos.length}</Text>
                  <Text className="text-[10px] text-text-tertiary">Photos</Text>
                </div>
                <div className="text-center p-2 bg-background-tertiary rounded-lg">
                  <Text className="text-lg font-semibold block">{groupedDocs.others.length}</Text>
                  <Text className="text-[10px] text-text-tertiary">Others</Text>
                </div>
              </div>

              {/* Document list */}
              <List
                size="small"
                dataSource={documents}
                renderItem={(doc) => (
                  <List.Item
                    className="hover:bg-background-tertiary rounded px-2 -mx-2 cursor-pointer"
                    onClick={() => doc.downloadUrl && window.open(doc.downloadUrl, '_blank')}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {getDocumentIcon(doc.fileName, doc.type)}
                      <div className="flex-1 min-w-0">
                        <Text className="text-sm block truncate">
                          {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                        </Text>
                        <Text className="text-[10px] text-text-tertiary block truncate">
                          {doc.fileName}
                        </Text>
                      </div>
                      {doc.downloadUrl && (
                        <DownloadOutlined className="text-text-tertiary" />
                      )}
                    </div>
                  </List.Item>
                )}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <UserOutlined className="text-primary" />
          </div>
          <div>
            <Text className="font-semibold text-text-primary text-sm block leading-tight">
              {student.studentName || 'Unknown Student'}
            </Text>
            <Text className="text-[10px] text-text-tertiary">
              {student.rollNumber} | {student.branch || 'N/A'}
            </Text>
          </div>
        </div>
      }
      placement="right"
      width={360}
      onClose={onClose}
      open={open}
      bodyStyle={{ padding: 0 }}
      headerStyle={{ padding: '12px 16px' }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="small"
        className="compliance-drawer-tabs px-3"
        tabBarStyle={{ marginBottom: 12 }}
      />
    </Drawer>
  );
};

export default StudentComplianceDrawer;
