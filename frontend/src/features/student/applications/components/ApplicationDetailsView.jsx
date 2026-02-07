import React, { memo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Card, Button, Typography, Tabs, Tag, Upload, Modal, Progress, Tooltip, theme, Row, Col } from 'antd';
import { toast } from 'react-hot-toast';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  UploadOutlined,
  EyeOutlined,
  DeleteOutlined,
  BankOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { hasInternshipStarted } from '../utils/applicationUtils';
import {
  ApplicationDetailsTab,
  ApplicationTimelineTab,
  ApplicationProgressTab,
} from './tabs';
import FacultyVisitsSection from './FacultyVisitsSection';
import { uploadJoiningLetter, deleteJoiningLetter } from '../../store/studentSlice';
import { openFileWithPresignedUrl } from '../../../../utils/imageUtils';

const { Text } = Typography;

const ApplicationDetailsView = ({
  application,
  onBack,
  monthlyReports,
  monthlyReportsProgress,
  monthlyReportsLoading,
  monthlyReportsUploading,
  onUploadReport,
  onDeleteReport,
  onRefreshReports,
  facultyVisits = [],
  facultyVisitsProgress = {},
  facultyVisitsLoading = false,
  onRefresh,
}) => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  if (!application) return null;

  const isSelfIdentified = application.isSelfIdentified || !application.internship;
  const internship = application.internship;
  const industry = internship?.industry || {};
  const internshipStarted = hasInternshipStarted(application);

  const company = isSelfIdentified
    ? { companyName: application.companyName, city: application.companyAddress?.split(',')[0] }
    : industry;

  const hasJoiningLetter = !!(application?.joiningLetterUrl || application?.joiningLetter);
  const joiningLetterUrl = application?.joiningLetterUrl || application?.joiningLetter;

  // Calculate progress
  const startDate = application.joiningDate || application.startDate || internship?.startDate;
  const endDate = application.endDate || internship?.endDate;
  const totalDays = endDate && startDate ? dayjs(endDate).diff(dayjs(startDate), 'day') : 0;
  const daysCompleted = startDate ? Math.max(0, dayjs().diff(dayjs(startDate), 'day')) : 0;
  const progressPercent = totalDays > 0 ? Math.min(Math.round((daysCompleted / totalDays) * 100), 100) : 0;

  const handleFileSelect = (file) => {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return false;
    }
    if (file.size / 1024 / 1024 > 5) {
      toast.error('File must be smaller than 5MB');
      return false;
    }
    setSelectedFile(file);
    return false;
  };

  const handleUploadJoiningLetter = async () => {
    if (!selectedFile) return;
    try {
      setUploading(true);
      await dispatch(uploadJoiningLetter({ applicationId: application.id, file: selectedFile })).unwrap();
      toast.success('Joining Report uploaded successfully');
      setUploadModalVisible(false);
      setSelectedFile(null);
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to upload';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteJoiningLetter = async () => {
    try {
      setUploading(true);
      await dispatch(deleteJoiningLetter(application.id)).unwrap();
      toast.success('Joining Report deleted');
      setDeleteConfirmVisible(false);
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to delete';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleViewJoiningLetter = () => {
    if (joiningLetterUrl) openFileWithPresignedUrl(joiningLetterUrl);
  };

  const getStatusColor = (status) => {
    const colors = {
      APPLIED: 'blue', SHORTLISTED: 'orange', SELECTED: 'green',
      APPROVED: 'green', JOINED: 'purple', COMPLETED: 'cyan',
      REJECTED: 'red', WITHDRAWN: 'default',
    };
    return colors[status] || 'default';
  };

  const tabItems = [
    {
      key: 'details',
      label: <span className="flex items-center gap-1.5 text-sm"><FileTextOutlined />Details</span>,
      children: (
        <ApplicationDetailsTab
          application={application}
          isSelfIdentified={isSelfIdentified}
          internship={internship}
          industry={industry}
        />
      ),
    },
    {
      key: 'reports',
      label: (
        <span className="flex items-center gap-1.5 text-sm">
          <CalendarOutlined />Reports
          {monthlyReportsProgress?.pending > 0 && (
            <Tag color="warning" className="!ml-1 !px-1.5 !py-0 text-[10px] rounded-full border-0">{monthlyReportsProgress.pending}</Tag>
          )}
        </span>
      ),
      children: (
        <ApplicationProgressTab
          application={application}
          monthlyReports={monthlyReports}
          monthlyReportsProgress={monthlyReportsProgress}
          monthlyReportsLoading={monthlyReportsLoading}
          monthlyReportsUploading={monthlyReportsUploading}
          internshipStarted={internshipStarted}
          onUploadReport={onUploadReport}
          onDeleteReport={onDeleteReport}
          onRefreshReports={onRefreshReports}
        />
      ),
    },
    {
      key: 'visits',
      label: <span className="flex items-center gap-1.5 text-sm"><TeamOutlined />Faculty Visits</span>,
      children: (
        <FacultyVisitsSection
          application={application}
          visits={facultyVisits}
          progress={facultyVisitsProgress}
          loading={facultyVisitsLoading}
          hasStarted={internshipStarted}
        />
      ),
    },
  ];

  return (
    <div className="!space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          type="text"
          size="small"
          style={{ color: token.colorTextSecondary }}
          className="hover:text-text-primary -ml-2"
        >
          Back
        </Button>
        <Tag color={getStatusColor(application.status)} className="rounded-full px-3 py-1 border-0 font-medium">
          {application.status?.replace(/_/g, ' ')}
        </Tag>
      </div>

      {/* Company Info Card */}
      <Card
        className="rounded-xl shadow-sm border"
        style={{ borderColor: token.colorBorderSecondary, backgroundColor: token.colorBgContainer }}
        styles={{ body: { padding: '20px' } }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: token.colorPrimaryBg }}
            >
              <BankOutlined className="text-xl" style={{ color: token.colorPrimary }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Text strong className="text-base truncate" style={{ color: token.colorText }}>{company.companyName || 'Company'}</Text>
                {isSelfIdentified && <Tag color="purple" className="text-[10px] rounded-full border-0 shrink-0">Self-Identified</Tag>}
              </div>
              <Text className="text-xs block truncate" style={{ color: token.colorTextTertiary }}>{application.jobProfile || internship?.title || 'Internship'}</Text>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="hidden sm:flex items-center gap-6 shrink-0">
            <Tooltip title="Reports Submitted">
              <div className="text-center">
                <Text className="text-xl font-bold block leading-none mb-1" style={{ color: token.colorPrimary }}>{monthlyReportsProgress?.approved || 0}/{monthlyReportsProgress?.total || 0}</Text>
                <Text className="text-[10px] uppercase tracking-wide" style={{ color: token.colorTextTertiary }}>Reports</Text>
              </div>
            </Tooltip>
            <div className="w-px h-8" style={{ backgroundColor: token.colorBorderSecondary }} />
            <Tooltip title="Faculty Visits">
              <div className="text-center">
                <Text className="text-xl font-bold block leading-none mb-1" style={{ color: token.colorSuccess }}>{facultyVisitsProgress?.completed || 0}/{facultyVisitsProgress?.total || 0}</Text>
                <Text className="text-[10px] uppercase tracking-wide" style={{ color: token.colorTextTertiary }}>Visits</Text>
              </div>
            </Tooltip>
          </div>
        </div>

        {/* Progress Bar */}
        {internshipStarted && (
          <div className="mt-5 pt-5 border-t" style={{ borderColor: token.colorBorderSecondary }}>
            <div className="flex justify-between items-center mb-2">
              <Text className="text-xs font-medium" style={{ color: token.colorTextSecondary }}>Internship Progress</Text>
              <Text className="text-xs font-bold" style={{ color: token.colorPrimary }}>{progressPercent}%</Text>
            </div>
            <Progress
              percent={progressPercent}
              showInfo={false}
              strokeColor={{ '0%': token.colorPrimary, '100%': token.colorSuccess }}
              strokeWidth={6}
            />
            <div className="flex justify-between text-[10px] mt-2" style={{ color: token.colorTextTertiary }}>
              <span>{startDate ? dayjs(startDate).format('MMM D, YYYY') : 'N/A'}</span>
              <span className="font-medium">{daysCompleted} days completed</span>
              <span>{endDate ? dayjs(endDate).format('MMM D, YYYY') : 'N/A'}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Joining Report - Compact */}
      {isSelfIdentified && (
        <Card
          className="rounded-xl shadow-sm border"
          style={{ borderColor: token.colorBorderSecondary, backgroundColor: token.colorBgContainer }}
          styles={{ body: { padding: '16px' } }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: hasJoiningLetter ? token.colorSuccessBg : token.colorWarningBg }}
              >
                <FileTextOutlined className="text-base" style={{ color: hasJoiningLetter ? token.colorSuccess : token.colorWarning }} />
              </div>
              <div>
                <Text strong className="text-sm block mb-0.5" style={{ color: token.colorText }}>Joining Report</Text>
                <Text className="text-[10px] font-medium" style={{ color: hasJoiningLetter ? token.colorSuccess : token.colorWarning }}>
                  {hasJoiningLetter ? 'Uploaded' : 'Required'}
                </Text>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {hasJoiningLetter ? (
                <>
                  <Tooltip title="View">
                    <Button type="text" size="small" icon={<EyeOutlined />} onClick={handleViewJoiningLetter} className="hover:bg-transparent" />
                  </Tooltip>
                  <Tooltip title="Replace">
                    <Button type="text" size="small" icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)} className="hover:bg-transparent" />
                  </Tooltip>
                  <Tooltip title="Delete">
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setDeleteConfirmVisible(true)} className="hover:bg-transparent" />
                  </Tooltip>
                </>
              ) : (
                <Button type="primary" size="small" icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)} className="rounded-lg">
                  Upload
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Card
        className="rounded-xl shadow-sm border"
        style={{ borderColor: token.colorBorderSecondary, backgroundColor: token.colorBgContainer }}
        styles={{ body: { padding: '0' } }}
      >
        <Tabs
          defaultActiveKey="details"
          items={tabItems}
          className="!px-5"
          size="small"
        />
      </Card>

      {/* Upload Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <UploadOutlined style={{ color: token.colorPrimary }} />
            <span>Upload Joining Report</span>
          </div>
        }
        open={uploadModalVisible}
        onCancel={() => { setUploadModalVisible(false); setSelectedFile(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setUploadModalVisible(false); setSelectedFile(null); }} className="rounded-lg">
            Cancel
          </Button>,
          <Button key="upload" type="primary" loading={uploading} disabled={!selectedFile} onClick={handleUploadJoiningLetter} className="rounded-lg">
            Upload
          </Button>,
        ]}
        width={440}
        className="rounded-xl"
      >
        <div className="pt-4">
          <Upload.Dragger
            accept=".pdf"
            maxCount={1}
            beforeUpload={handleFileSelect}
            onRemove={() => setSelectedFile(null)}
            fileList={selectedFile ? [{ uid: '-1', name: selectedFile.name, status: 'done' }] : []}
            style={{ background: token.colorBgContainer, borderColor: token.colorBorder, borderRadius: '12px' }}
          >
            <p className="ant-upload-drag-icon mb-3">
              <UploadOutlined className="text-4xl" style={{ color: token.colorPrimary }} />
            </p>
            <p className="ant-upload-text text-sm font-medium mb-1" style={{ color: token.colorText }}>
              Click or drag PDF file to upload
            </p>
            <p className="ant-upload-hint text-xs" style={{ color: token.colorTextTertiary }}>
              Maximum file size: 5MB
            </p>
          </Upload.Dragger>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <DeleteOutlined style={{ color: token.colorError }} />
            <span style={{ color: token.colorError }}>Delete Joining Report</span>
          </div>
        }
        open={deleteConfirmVisible}
        onCancel={() => setDeleteConfirmVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setDeleteConfirmVisible(false)} className="rounded-lg">
            Cancel
          </Button>,
          <Button key="delete" danger loading={uploading} onClick={handleDeleteJoiningLetter} className="rounded-lg">
            Delete
          </Button>,
        ]}
        width={400}
        className="rounded-xl"
      >
        <div className="py-2">
          <p className="text-sm mb-2" style={{ color: token.colorText }}>
            Are you sure you want to delete the joining report?
          </p>
          <p className="text-xs mb-0" style={{ color: token.colorError }}>
            This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
};

ApplicationDetailsView.displayName = 'ApplicationDetailsView';

export default memo(ApplicationDetailsView);
