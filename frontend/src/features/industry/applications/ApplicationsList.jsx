import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Table, Button, Tag, Space, Modal, Input, Avatar, Drawer, Descriptions, Divider, Typography, Alert } from 'antd';
import { toast } from 'react-hot-toast';
import { CheckOutlined, CloseOutlined, UserOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import { fetchMyApplications, shortlistApplication, selectApplication, rejectApplication, optimisticallyUpdateApplicationStatus, rollbackApplicationOperation } from '../store/industrySlice';
import { generateTxnId, snapshotManager, optimisticToast } from '../../../store/optimisticMiddleware';
import ProfileAvatar from '../../../components/common/ProfileAvatar';

const { Text, Paragraph } = Typography;

const ApplicationsList = () => {
  const dispatch = useDispatch();
  const applications = useSelector((state) => state.industry.applications.list);
  const loading = useSelector((state) => state.industry.applications.loading);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    dispatch(fetchMyApplications());
  }, [dispatch]);

  const handleShortlist = async (applicationId) => {
    const txnId = generateTxnId();

    // Save snapshot of current state
    const currentApplicationsList = applications || [];
    snapshotManager.save(txnId, 'industry', { applications: { list: currentApplicationsList } });

    // Show loading toast
    optimisticToast.loading(txnId, 'Shortlisting application...');

    // Optimistically update the status
    dispatch(optimisticallyUpdateApplicationStatus({ id: applicationId, status: 'SHORTLISTED' }));

    try {
      await dispatch(shortlistApplication(applicationId)).unwrap();
      optimisticToast.success(txnId, 'Application shortlisted successfully');
      snapshotManager.delete(txnId);
    } catch (error) {
      optimisticToast.error(txnId, error?.message || 'Failed to shortlist application');

      // Rollback on error
      const snapshot = snapshotManager.get(txnId);
      if (snapshot) {
        dispatch(rollbackApplicationOperation(snapshot.state.applications));
        snapshotManager.delete(txnId);
      }
    }
  };

  const handleSelect = async (applicationId) => {
    Modal.confirm({
      title: 'Confirm Selection',
      content: 'Are you sure you want to select this candidate? This action cannot be undone.',
      okText: 'Yes, Select',
      okType: 'primary',
      onOk: async () => {
        const txnId = generateTxnId();

        // Save snapshot of current state
        const currentApplicationsList = applications || [];
        snapshotManager.save(txnId, 'industry', { applications: { list: currentApplicationsList } });

        // Show loading toast
        optimisticToast.loading(txnId, 'Selecting candidate...');

        // Optimistically update the status
        dispatch(optimisticallyUpdateApplicationStatus({ id: applicationId, status: 'SELECTED' }));

        try {
          await dispatch(selectApplication({ id: applicationId })).unwrap();
          optimisticToast.success(txnId, 'Candidate selected successfully');
          snapshotManager.delete(txnId);
        } catch (error) {
          optimisticToast.error(txnId, error?.message || 'Failed to select candidate');

          // Rollback on error
          const snapshot = snapshotManager.get(txnId);
          if (snapshot) {
            dispatch(rollbackApplicationOperation(snapshot.state.applications));
            snapshotManager.delete(txnId);
          }
        }
      },
    });
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    const txnId = generateTxnId();

    // Save snapshot of current state
    const currentApplicationsList = applications || [];
    snapshotManager.save(txnId, 'industry', { applications: { list: currentApplicationsList } });

    // Show loading toast
    optimisticToast.loading(txnId, 'Rejecting application...');

    // Optimistically update the status
    dispatch(optimisticallyUpdateApplicationStatus({ id: selectedApp.id, status: 'REJECTED' }));

    try {
      await dispatch(rejectApplication({
        id: selectedApp.id,
        reason: rejectReason,
      })).unwrap();
      optimisticToast.success(txnId, 'Application rejected successfully');
      snapshotManager.delete(txnId);
      setRejectModalVisible(false);
      setRejectReason('');
      setSelectedApp(null);
    } catch (error) {
      optimisticToast.error(txnId, error?.message || 'Failed to reject application');

      // Rollback on error
      const snapshot = snapshotManager.get(txnId);
      if (snapshot) {
        dispatch(rollbackApplicationOperation(snapshot.state.applications));
        snapshotManager.delete(txnId);
      }
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: 'gold',
      SHORTLISTED: 'blue',
      SELECTED: 'green',
      REJECTED: 'red',
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: 'Student',
      key: 'student',
      render: (_, record) => (
        <Space>
          <ProfileAvatar profileImage={record.student?.profileImage} />
          <div>
            <div className="font-medium">{record.student?.user?.name || record.student?.name}</div>
            <div className="text-gray-500 text-xs">{record.student?.user?.email || record.student?.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Internship',
      dataIndex: ['internship', 'title'],
      key: 'internship',
    },
    {
      title: 'Institution',
      dataIndex: ['student', 'institution', 'name'],
      key: 'institution',
      render: (text) => text || 'N/A',
    },
    {
      title: 'Department',
      dataIndex: ['student', 'department', 'name'],
      key: 'department',
      render: (text) => text || 'N/A',
    },
    {
      title: 'Applied On',
      dataIndex: 'createdAt',
      key: 'appliedOn',
      render: (date) => new Date(date).toLocaleDateString('en-IN'),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
      filters: [
        { text: 'Pending', value: 'PENDING' },
        { text: 'Shortlisted', value: 'SHORTLISTED' },
        { text: 'Selected', value: 'SELECTED' },
        { text: 'Rejected', value: 'REJECTED' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedApp(record);
              setDetailDrawer(true);
            }}
            size="small"
          >
            View
          </Button>
          {record.status === 'PENDING' && (
            <>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleShortlist(record.id)}
                size="small"
              >
                Shortlist
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  setSelectedApp(record);
                  setRejectModalVisible(true);
                }}
                size="small"
              >
                Reject
              </Button>
            </>
          )}
          {record.status === 'SHORTLISTED' && (
            <>
              <Button
                type="primary"
                className="bg-green-600 hover:bg-green-500 border-green-600 hover:border-green-500"
                icon={<CheckOutlined />}
                onClick={() => handleSelect(record.id)}
                size="small"
              >
                Select
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  setSelectedApp(record);
                  setRejectModalVisible(true);
                }}
                size="small"
              >
                Reject
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const filteredApplications = statusFilter === 'all'
    ? applications
    : applications?.filter(app => app.status === statusFilter);

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <Card
        title={<span className="text-text-primary font-semibold">Student Applications</span>}
        extra={
          <div className="bg-background-tertiary px-3 py-1 rounded-full border border-border/50">
            <span className="text-text-secondary text-xs uppercase font-bold">Total: {applications?.length || 0}</span>
          </div>
        }
        className="rounded-xl border-border shadow-sm"
      >
        <Table
          columns={columns}
          dataSource={applications}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} applications`,
          }}
          className="custom-table"
        />
      </Card>

      {/* Reject Modal */}
      <Modal
        title={<span className="text-error font-semibold">Reject Application</span>}
        open={rejectModalVisible}
        onOk={handleReject}
        onCancel={() => {
          setRejectModalVisible(false);
          setRejectReason('');
          setSelectedApp(null);
        }}
        okText="Reject"
        okButtonProps={{ danger: true, className: "rounded-lg" }}
        cancelButtonProps={{ className: "rounded-lg" }}
        className="rounded-xl overflow-hidden"
      >
        <div className="py-4">
          <Paragraph className="mb-4 text-text-primary">
            You are about to reject the application from <Text strong>{selectedApp?.student?.user?.name || selectedApp?.student?.name}</Text>.
          </Paragraph>
          <Text strong className="block mb-2 text-text-secondary uppercase text-[10px] tracking-wider">Reason for rejection:</Text>
          <Input.TextArea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter detailed reason for rejection..."
            maxLength={500}
            showCount
            className="rounded-lg"
          />
        </div>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={<span className="text-text-primary font-semibold">Application Details</span>}
        placement="right"
        size="default"
        onClose={() => {
          setDetailDrawer(false);
          setSelectedApp(null);
        }}
        open={detailDrawer}
        className="rounded-l-2xl overflow-hidden"
      >
        {selectedApp && (
          <div className="space-y-8">
            <div className="text-center bg-background-tertiary/30 p-6 rounded-2xl border border-border/50">
              <ProfileAvatar size={80} profileImage={selectedApp.student?.profileImage} className="shadow-md border-4 border-background" />
              <h2 className="text-2xl font-bold text-text-primary mt-4">{selectedApp.student?.user?.name || selectedApp.student?.name}</h2>
              <Tag color={getStatusColor(selectedApp.status)} className="mt-2 px-4 py-0.5 rounded-full font-medium">
                {selectedApp.status}
              </Tag>
            </div>

            <div>
              <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold">Personal Information</Divider>
              <Descriptions column={1} bordered size="small" className="rounded-xl overflow-hidden">
                <Descriptions.Item label="Email">{selectedApp.student?.user?.email || selectedApp.student?.email}</Descriptions.Item>
                <Descriptions.Item label="Phone">{selectedApp.student?.user?.phoneNo || selectedApp.student?.phone || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Roll Number">{selectedApp.student?.user?.rollNumber || selectedApp.student?.rollNumber || 'N/A'}</Descriptions.Item>
              </Descriptions>
            </div>

            <div>
              <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold">Academic Information</Divider>
              <Descriptions column={1} bordered size="small" className="rounded-xl overflow-hidden">
                <Descriptions.Item label="Institution">
                  {selectedApp.student?.institution?.name || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Department">
                  {selectedApp.student?.department?.name || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Batch">
                  {selectedApp.student?.batch?.name || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="CGPA">
                  {selectedApp.student?.cgpa || 'N/A'}
                </Descriptions.Item>
              </Descriptions>
            </div>

            <div>
              <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold">Application Details</Divider>
              <Descriptions column={1} bordered size="small" className="rounded-xl overflow-hidden">
                <Descriptions.Item label="Internship">
                  <Text strong className="text-primary">{selectedApp.internship?.title}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Applied On">
                  {new Date(selectedApp.createdAt).toLocaleString('en-IN')}
                </Descriptions.Item>
                <Descriptions.Item label="Cover Letter">
                  <div className="bg-background-tertiary p-3 rounded-lg border border-border/50 italic text-text-secondary">
                    "{selectedApp.coverLetter || 'No cover letter provided'}"
                  </div>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {selectedApp.student?.skills && (
              <div>
                <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold">Skills</Divider>
                <div className="flex flex-wrap gap-2 px-2">
                  {selectedApp.student.skills.split(',').map((skill, idx) => (
                    <Tag key={idx} color="blue" className="rounded-md m-0">{skill.trim()}</Tag>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold">Documents</Divider>
              <div className="px-2">
                {selectedApp.student?.resumeUrl ? (
                  <Button
                    icon={<FileTextOutlined />}
                    type="primary"
                    href={selectedApp.student.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg shadow-sm"
                  >
                    View Resume
                  </Button>
                ) : (
                  <Text className="text-text-tertiary italic">No resume uploaded</Text>
                )}
              </div>
            </div>

            {selectedApp.status === 'REJECTED' && selectedApp.rejectionReason && (
              <div>
                <Divider plain className="!text-error uppercase text-[10px] tracking-widest font-bold">Rejection Reason</Divider>
                <Alert message={selectedApp.rejectionReason} type="error" className="rounded-xl border-error/20" />
              </div>
            )}

            <Divider className="opacity-50" />

            <div className="flex justify-end gap-3 px-2 pb-4">
              {selectedApp.status === 'PENDING' && (
                <>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => {
                      setDetailDrawer(false);
                      handleShortlist(selectedApp.id);
                    }}
                    className="rounded-lg px-6"
                  >
                    Shortlist
                  </Button>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setDetailDrawer(false);
                      setRejectModalVisible(true);
                    }}
                    className="rounded-lg px-6"
                  >
                    Reject
                  </Button>
                </>
              )}
              {selectedApp.status === 'SHORTLISTED' && (
                <>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => {
                      setDetailDrawer(false);
                      handleSelect(selectedApp.id);
                    }}
                    className="bg-success hover:bg-success-600 border-0 rounded-lg px-8 shadow-md shadow-success/20"
                  >
                    Select Candidate
                  </Button>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setDetailDrawer(false);
                      setRejectModalVisible(true);
                    }}
                    className="rounded-lg px-6"
                  >
                    Reject
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ApplicationsList;