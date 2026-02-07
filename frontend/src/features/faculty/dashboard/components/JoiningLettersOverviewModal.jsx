import React, { useState, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Modal, Table, Tag, Button, Space, Input, Typography, Tooltip } from 'antd';
import { toast } from 'react-hot-toast';
import {
  FileProtectOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
  BankOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { verifyJoiningLetter, rejectJoiningLetter, deleteJoiningLetter } from '../../store/facultySlice';
import { openFileWithPresignedUrl } from '../../../../utils/imageUtils';
import ProfileAvatar from '../../../../components/common/ProfileAvatar';

const { Title, Text } = Typography;
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

const JoiningLettersOverviewModal = ({ visible, onClose, letters = [], onRefresh }) => {
  const dispatch = useDispatch();
  const [actionModal, setActionModal] = useState({ visible: false, letter: null, action: null });
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const getStudentInfo = (letter) => {
    return letter.student || letter.application?.student || letter.studentData || null;
  };

  const getCompanyInfo = (letter) => {
    return letter.company || letter.application?.internship?.industry ||
      { companyName: letter.companyName || letter.application?.companyName || 'N/A' };
  };

  const handleVerify = async () => {
    if (!actionModal.letter) return;
    setActionLoading(true);
    try {
      await dispatch(verifyJoiningLetter({ letterId: actionModal.letter.id, remarks })).unwrap();
      toast.success('Joining report verified');
      setActionModal({ visible: false, letter: null, action: null });
      setRemarks('');
      onRefresh?.();
    } catch (error) {
      toast.error(error?.message || 'Failed to verify');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!actionModal.letter || !remarks.trim()) {
      toast.warning('Please provide a reason');
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
      toast.error(error?.message || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (letter) => {
    Modal.confirm({
      title: 'Delete Joining Report',
      content: 'Are you sure? This cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(deleteJoiningLetter(letter.id)).unwrap();
          toast.success('Deleted');
          onRefresh?.();
        } catch (error) {
          toast.error(error?.message || 'Failed to delete');
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

  const stats = useMemo(() => {
    const pending = letters.filter(l => l.status === 'PENDING' || l.status === 'UPLOADED').length;
    const verified = letters.filter(l => l.status === 'VERIFIED').length;
    const rejected = letters.filter(l => l.status === 'REJECTED').length;
    return { pending, verified, rejected, total: letters.length };
  }, [letters]);

  const columns = [
    {
      title: 'Student',
      key: 'student',
      width: 200,
      render: (_, record) => {
        const student = getStudentInfo(record);
        return (
          <div className="flex items-center gap-2">
            <ProfileAvatar profileImage={student?.profileImage} size={32} />
            <div>
              <div className="font-medium text-sm">{student?.user?.name || student?.name || 'Unknown'}</div>
              <div className="text-xs text-gray-500">{student?.user?.rollNumber || student?.rollNumber}</div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Company',
      key: 'company',
      width: 180,
      render: (_, record) => {
        const company = getCompanyInfo(record);
        return (
          <div className="flex items-center gap-1 text-sm">
            <BankOutlined className="text-gray-400" />
            <span className="truncate">{company?.companyName || 'N/A'}</span>
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => {
        const isPending = record.status === 'PENDING' || record.status === 'UPLOADED';
        return (
          <Space size="small">
            {record.joiningLetterUrl && (
              <Tooltip title="View">
                <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)} />
              </Tooltip>
            )}
            {isPending && (
              <>
                <Tooltip title="Verify">
                  <Button type="text" size="small" icon={<CheckCircleOutlined className="text-green-500" />}
                    onClick={() => setActionModal({ visible: true, letter: record, action: 'verify' })} />
                </Tooltip>
                <Tooltip title="Reject">
                  <Button type="text" size="small" icon={<CloseCircleOutlined className="text-red-500" />}
                    onClick={() => setActionModal({ visible: true, letter: record, action: 'reject' })} />
                </Tooltip>
              </>
            )}
            <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Joining Reports Overview</Title>}
        open={visible}
        onCancel={onClose}
        footer={null}
        width={900}
        centered
        styles={{ body: { padding: '16px 24px', maxHeight: '70vh', overflowY: 'auto' } }}
      >
        {/* Stats Summary */}
        {/* <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200">
            <ClockCircleOutlined className="text-orange-500" />
            <Text className="text-sm"><strong>{stats.pending}</strong> Pending</Text>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
            <CheckCircleOutlined className="text-green-500" />
            <Text className="text-sm"><strong>{stats.verified}</strong> Verified</Text>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
            <CloseCircleOutlined className="text-red-500" />
            <Text className="text-sm"><strong>{stats.rejected}</strong> Rejected</Text>
          </div>
        </div> */}

        <Table
          columns={columns}
          dataSource={letters}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          size="small"
          scroll={{ x: 700 }}
        />
      </Modal>

      {/* Action Modal */}
      <Modal
        title={actionModal.action === 'verify' ? 'Verify Joining Report' : 'Reject Joining Report'}
        open={actionModal.visible}
        onCancel={() => { setActionModal({ visible: false, letter: null, action: null }); setRemarks(''); }}
        footer={[
          <Button key="cancel" onClick={() => setActionModal({ visible: false, letter: null, action: null })}>Cancel</Button>,
          actionModal.action === 'verify' ? (
            <Button key="verify" type="primary" loading={actionLoading} onClick={handleVerify}>Verify</Button>
          ) : (
            <Button key="reject" type="primary" danger loading={actionLoading} onClick={handleReject}>Reject</Button>
          ),
        ]}
      >
        {actionModal.letter && (
          <div className="mb-3 text-sm">
            <p><strong>Student:</strong> {getStudentInfo(actionModal.letter)?.user?.name || getStudentInfo(actionModal.letter)?.name}</p>
            <p><strong>Company:</strong> {getCompanyInfo(actionModal.letter)?.companyName}</p>
          </div>
        )}
        <TextArea
          rows={3}
          placeholder={actionModal.action === 'verify' ? 'Remarks (optional)' : 'Reason (required)'}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </Modal>
    </>
  );
};

export default JoiningLettersOverviewModal;
