import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Card, Tag, Button, Space, Modal, Input, Empty, Badge, Tooltip, Avatar, theme } from 'antd';
import { toast } from 'react-hot-toast';
import {
  FileProtectOutlined,
  RightOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
  UserOutlined,
  BankOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { verifyJoiningLetter, rejectJoiningLetter, deleteJoiningLetter } from '../../store/facultySlice';
import { openFileWithPresignedUrl } from '../../../../utils/imageUtils';
import ProfileAvatar from '../../../../components/common/ProfileAvatar';

const { TextArea } = Input;

const getStatusConfig = (status) => {
  const configs = {
    PENDING: { color: 'orange', label: 'Pending', icon: <ClockCircleOutlined /> },
    VERIFIED: { color: 'green', label: 'Verified', icon: <CheckCircleOutlined /> },
    REJECTED: { color: 'red', label: 'Rejected', icon: <CloseCircleOutlined /> },
    UPLOADED: { color: 'blue', label: 'Uploaded', icon: <FileProtectOutlined /> },
  };
  return configs[status] || configs.PENDING;
};

const JoiningLettersCard = ({ letters = [], loading, onRefresh, onViewAll }) => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [actionModal, setActionModal] = useState({ visible: false, letter: null, action: null });
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Helper to extract student info from letter
  const getStudentInfo = (letter) => {
    return letter.student ||
           letter.application?.student ||
           letter.studentData ||
           null;
  };

  // Helper to extract company info from letter
  const getCompanyInfo = (letter) => {
    return letter.company ||
           letter.application?.internship?.industry ||
           { companyName: letter.companyName || letter.application?.companyName || 'N/A' };
  };

  const handleVerify = async () => {
    if (!actionModal.letter) return;
    setActionLoading(true);
    try {
      await dispatch(verifyJoiningLetter({ letterId: actionModal.letter.id, remarks })).unwrap();
      toast.success('Joining report verified successfully');
      setActionModal({ visible: false, letter: null, action: null });
      setRemarks('');
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to verify joining report';
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!actionModal.letter || !remarks.trim()) {
      toast.warning('Please provide a reason for rejection');
      return;
    }
    setActionLoading(true);
    try {
      await dispatch(rejectJoiningLetter({ letterId: actionModal.letter.id, reason: remarks })).unwrap();
      toast.success('Joining report rejected');
      setActionModal({ visible: false, letter: null, action: null });
      setRemarks('');
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to reject joining report';
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (letter) => {
    Modal.confirm({
      title: 'Delete Joining Report',
      content: 'Are you sure you want to delete this joining report? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(deleteJoiningLetter(letter.id)).unwrap();
          toast.success('Joining report deleted successfully');
          onRefresh?.();
        } catch (error) {
          const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to delete joining report';
          toast.error(errorMessage);
        }
      },
    });
  };

  const handleView = async (letter) => {
    if (letter.joiningLetterUrl) {
      await openFileWithPresignedUrl(letter.joiningLetterUrl);
    } else {
      toast.info('No document available');
    }
  };

  const pendingCount = letters.filter(l => l.status === 'PENDING' || l.status === 'UPLOADED').length;

  return (
    <>
      <Card
        title={
          <div className="flex items-center gap-2">
            <FileProtectOutlined style={{ color: token.colorPrimary }} />
            <span>Joining Reports</span>
            {pendingCount > 0 && (
              <Badge count={pendingCount} className="ml-2" />
            )}
          </div>
        }
        extra={
          <Button type="link" onClick={onViewAll || (() => navigate('/app/joining-letters'))}>
            View All <RightOutlined />
          </Button>
        }
        className="h-full !rounded-xl"
        style={{ borderColor: token.colorBorder }}
        styles={{ body: { padding: letters.length > 0 ? 0 : 24 } }}
      >
        {letters.length > 0 ? (
          <div className="flex flex-col">
            {letters.slice(0, 5).map((letter, index) => {
              const statusConfig = getStatusConfig(letter.status);
              const student = getStudentInfo(letter);
              const company = getCompanyInfo(letter);

              return (
                <div
                  key={letter.id || index}
                  className={`px-4 py-3 flex items-start gap-4`}
                  style={{ 
                    borderBottom: index !== letters.slice(0, 5).length - 1 ? `1px solid ${token.colorBorder}` : 'none',
                    ':hover': { backgroundColor: token.colorBgTextHover }
                  }}
                >
                  <ProfileAvatar profileImage={student?.profileImage} className="shrink-0" style={{ backgroundColor: token.colorPrimary }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium truncate mr-2">{student?.user?.name || student?.name || 'Unknown Student'}</span>
                      <Tag color={statusConfig.color} icon={statusConfig.icon} className="m-0">
                        {statusConfig.label}
                      </Tag>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs" style={{ color: token.colorTextSecondary }}>
                        <BankOutlined />
                        <span className="truncate">{company?.companyName || 'N/A'}</span>
                      </div>
                      {letter.uploadedAt && (
                        <div className="text-xs" style={{ color: token.colorTextTertiary }}>
                          Uploaded: {dayjs(letter.uploadedAt).format('DD/MM/YYYY')}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Space size="small">
                        {letter.joiningLetterUrl && (
                          <Tooltip title="View Document">
                            <Button
                              type="text"
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => handleView(letter)}
                            />
                          </Tooltip>
                        )}
                        {(letter.status === 'PENDING' || letter.status === 'UPLOADED') && (
                          <>
                            <Tooltip title="Verify">
                              <Button
                                type="text"
                                size="small"
                                icon={<CheckCircleOutlined style={{ color: token.colorSuccess }} />}
                                onClick={() => setActionModal({ visible: true, letter, action: 'verify' })}
                              />
                            </Tooltip>
                            <Tooltip title="Reject">
                              <Button
                                type="text"
                                size="small"
                                icon={<CloseCircleOutlined style={{ color: token.colorError }} />}
                                onClick={() => setActionModal({ visible: true, letter, action: 'reject' })}
                              />
                            </Tooltip>
                          </>
                        )}
                        <Tooltip title="Delete">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDelete(letter)}
                          />
                        </Tooltip>
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
            description="No joining reports to review"
          />
        )}
      </Card>

      {/* Action Modal */}
      <Modal
        title={actionModal.action === 'verify' ? 'Verify Joining Report' : 'Reject Joining Report'}
        open={actionModal.visible}
        onCancel={() => {
          setActionModal({ visible: false, letter: null, action: null });
          setRemarks('');
        }}
        footer={[
          <Button key="cancel" onClick={() => setActionModal({ visible: false, letter: null, action: null })}>
            Cancel
          </Button>,
          actionModal.action === 'verify' ? (
            <Button key="verify" type="primary" loading={actionLoading} onClick={handleVerify}>
              Verify
            </Button>
          ) : (
            <Button key="reject" type="primary" danger loading={actionLoading} onClick={handleReject}>
              Reject
            </Button>
          ),
        ]}
      >
        {actionModal.letter && (
          <div className="mb-4">
            <p><strong>Student:</strong> {getStudentInfo(actionModal.letter)?.user?.name || getStudentInfo(actionModal.letter)?.name || 'Unknown'}</p>
            <p><strong>Company:</strong> {getCompanyInfo(actionModal.letter)?.companyName || 'N/A'}</p>
          </div>
        )}
        <TextArea
          rows={4}
          placeholder={actionModal.action === 'verify' ? 'Add remarks (optional)' : 'Reason for rejection (required)'}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </Modal>
    </>
  );
};

export default JoiningLettersCard;