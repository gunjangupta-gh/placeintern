import React, { useState, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Card, Tag, Button, Space, Modal, Input, Empty, Badge, Tooltip, Avatar, theme, Popconfirm } from 'antd';
import { toast } from 'react-hot-toast';
import {
  FileTextOutlined,
  RightOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  UserOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { approveMonthlyReport, rejectMonthlyReport, downloadMonthlyReport, viewMonthlyReport, deleteMonthlyReport } from '../../store/facultySlice';
import ProfileAvatar from '../../../../components/common/ProfileAvatar';

const { TextArea } = Input;

const getStatusConfig = (status) => {
  const configs = {
    DRAFT: { color: 'default', label: 'Draft', icon: <FileTextOutlined /> },
    APPROVED: { color: 'green', label: 'Approved', icon: <CheckCircleOutlined /> },
  };
  return configs[status] || configs.DRAFT;
};

const MonthlyReportsCard = ({ reports = [], loading, onRefresh, onViewAll }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  const [reviewModal, setReviewModal] = useState({ visible: false, report: null, action: null });
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleApprove = async () => {
    if (!reviewModal.report) return;
    setActionLoading(true);
    try {
      await dispatch(approveMonthlyReport({ reportId: reviewModal.report.id, remarks })).unwrap();
      toast.success('Report approved successfully');
      setReviewModal({ visible: false, report: null, action: null });
      setRemarks('');
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to approve report';
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!reviewModal.report || !remarks.trim()) {
      toast.warning('Please provide a reason for rejection');
      return;
    }
    setActionLoading(true);
    try {
      await dispatch(rejectMonthlyReport({ reportId: reviewModal.report.id, reason: remarks })).unwrap();
      toast.success('Report rejected');
      setReviewModal({ visible: false, report: null, action: null });
      setRemarks('');
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to reject report';
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async (report) => {
    try {
      const blob = await dispatch(downloadMonthlyReport(report.id)).unwrap();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `monthly_report_${report.student?.user?.name || report.student?.name || 'report'}_${report.reportMonth}_${report.reportYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to download report';
      toast.error(errorMessage);
    }
  };

  // Handle view report with presigned URL
  const handleViewReport = async (report) => {
    try {
      const result = await dispatch(viewMonthlyReport(report.id)).unwrap();
      if (result?.url) {
        window.open(result.url, '_blank');
      } else {
        toast.error('No file available for this report');
      }
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to view report';
      toast.error(errorMessage);
    }
  };

  // Handle delete report
  const handleDeleteReport = async (reportId) => {
    try {
      await dispatch(deleteMonthlyReport(reportId)).unwrap();
      toast.success('Report deleted successfully');
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to delete report';
      toast.error(errorMessage);
    }
  };

  // With auto-approval, only DRAFT reports are considered pending
  // Use ONLY counter fields from API - no fallback to date-based filtering logic
  const pendingCount = useMemo(() => {
    // Simply count DRAFT reports - counter fields are used by the API to determine report status
    return reports.filter(r => r.status === 'DRAFT').length;
  }, [reports]);

  return (
    <>
      <Card
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined style={{ color: token.colorPrimary }} />
            <span>Monthly Reports</span>
            {pendingCount > 0 && (
              <Badge count={pendingCount} className="ml-2" />
            )}
          </div>
        }
        extra={
          <Button type="link" onClick={onViewAll || (() => navigate('/app/monthly-reports'))}>
            View All <RightOutlined />
          </Button>
        }
        className="h-full !rounded-xl"
        style={{ borderColor: token.colorBorder }}
        styles={{ body: { padding: reports.length > 0 ? 0 : 24 } }}
      >
        {reports.length > 0 ? (
          <div className="flex flex-col">
            {reports.slice(0, 5).map((report, index) => {
              // Use ONLY counter fields from API - no date-based filtering logic
              const statusConfig = getStatusConfig(report.status);
              const monthName = dayjs().month(report.reportMonth - 1).format('MMMM');

              return (
                <div
                  key={report.id || index}
                  className="px-4 py-3 flex items-start gap-4"
                  style={{
                    borderBottom: index !== reports.slice(0, 5).length - 1 ? `1px solid ${token.colorSplit}` : 'none',
                    transition: 'background-color 0.3s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = token.colorFillQuaternary)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <ProfileAvatar
                    profileImage={report.application?.student?.profileImage || report.student?.profileImage}
                    className="shrink-0"
                    style={{ backgroundColor: token.colorPrimary, color: '#fff' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium truncate mr-2">{report.application?.student?.user?.name || report.application?.student?.name || report.student?.user?.name || report.student?.name || 'Unknown Student'}</span>
                      <Tag color={statusConfig.color} icon={statusConfig.icon} className="m-0">
                        {statusConfig.label}
                      </Tag>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs" style={{ color: token.colorTextSecondary }}>
                        {monthName} {report.reportYear}
                      </div>
                      {report.submittedAt && (
                        <div className="text-xs" style={{ color: token.colorTextTertiary }}>
                          Submitted: {dayjs(report.submittedAt).format('DD/MM/YYYY')}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Space size="small">
                        {report.reportFileUrl && (
                          <>
                            <Tooltip title="View Report">
                              <Button
                                type="text"
                                size="small"
                                icon={<EyeOutlined />}
                                onClick={() => handleViewReport(report)}
                              />
                            </Tooltip>
                            <Tooltip title="Download">
                              <Button
                                type="text"
                                size="small"
                                icon={<DownloadOutlined />}
                                onClick={() => handleDownload(report)}
                              />
                            </Tooltip>
                          </>
                        )}
                        <Popconfirm
                          title="Delete Report"
                          description="Are you sure you want to delete this report?"
                          onConfirm={() => handleDeleteReport(report.id)}
                          okText="Delete"
                          okButtonProps={{ danger: true }}
                          cancelText="Cancel"
                        >
                          <Tooltip title="Delete">
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                            />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No monthly reports to review"
          />
        )}
      </Card>

      {/* Review Modal */}
      <Modal
        title={reviewModal.action === 'approve' ? 'Approve Report' : 'Reject Report'}
        open={reviewModal.visible}
        onCancel={() => {
          setReviewModal({ visible: false, report: null, action: null });
          setRemarks('');
        }}
        footer={[
          <Button key="cancel" onClick={() => setReviewModal({ visible: false, report: null, action: null })}>
            Cancel
          </Button>,
          reviewModal.action === 'approve' ? (
            <Button key="approve" type="primary" loading={actionLoading} onClick={handleApprove}>
              Approve
            </Button>
          ) : (
            <Button key="reject" type="primary" danger loading={actionLoading} onClick={handleReject}>
              Reject
            </Button>
          ),
        ]}
      >
        {reviewModal.report && (
          <div className="mb-4">
            <p><strong>Student:</strong> {reviewModal.report.student?.user?.name || reviewModal.report.student?.name}</p>
            <p><strong>Period:</strong> {dayjs().month(reviewModal.report.reportMonth - 1).format('MMMM')} {reviewModal.report.reportYear}</p>
          </div>
        )}
        <TextArea
          rows={4}
          placeholder={reviewModal.action === 'approve' ? 'Add remarks (optional)' : 'Reason for rejection (required)'}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </Modal>
    </>
  );
};

export default MonthlyReportsCard;
