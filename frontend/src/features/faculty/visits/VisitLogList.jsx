import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Table, Button, Tag, Space, Modal, Input, DatePicker, Typography, Segmented, theme, Row, Col, Empty } from 'antd';
import { toast } from 'react-hot-toast';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CalendarOutlined, ReloadOutlined, FileTextOutlined, EnvironmentOutlined, FileImageOutlined, UserOutlined, ProjectOutlined, MessageOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { fetchVisitLogs, deleteVisitLog, optimisticallyDeleteVisitLog, rollbackVisitLogOperation, fetchAssignedStudents } from '../store/facultySlice';
import UnifiedVisitLogModal from './UnifiedVisitLogModal';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { openFileWithPresignedUrl } from '../../../utils/imageUtils';

dayjs.extend(relativeTime);

const { RangePicker } = DatePicker;
const { Title, Text, Paragraph } = Typography;

const STATUS_FILTERS = [
  { value: 'all', label: 'All Visits' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'SCHEDULED', label: 'Scheduled' },
];

const VisitLogList = React.memo(() => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  const { visitLogs, lastFetched, students } = useSelector((state) => state.faculty);
  const { list: visitLogsList = [], loading } = visitLogs || {};
  const assignedStudents = students?.list || [];
  const visitLogsLastFetched = lastFetched?.visitLogs;
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVisitLogId, setEditingVisitLogId] = useState(null);
  const [editingVisitData, setEditingVisitData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleOpenModal = (visitLogId = null, visitData = null) => {
    setEditingVisitLogId(visitLogId);
    setEditingVisitData(visitData);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingVisitLogId(null);
    setEditingVisitData(null);
  };

  const handleModalSuccess = () => {
    dispatch(fetchVisitLogs({ forceRefresh: true }));
    handleCloseModal();
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await dispatch(fetchVisitLogs({ forceRefresh: true })).unwrap();
      toast.success('Data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchVisitLogs());
    dispatch(fetchAssignedStudents());
  }, [dispatch]);

  const handleDelete = useCallback((id) => {
    Modal.confirm({
      title: 'Delete Visit Log',
      content: 'Are you sure you want to delete this visit log? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        const previousList = [...visitLogsList];
        const previousTotal = visitLogs?.total || 0;
        dispatch(optimisticallyDeleteVisitLog(id));
        toast.success('Visit log deleted successfully');
        try {
          await dispatch(deleteVisitLog(id)).unwrap();
        } catch (error) {
          dispatch(rollbackVisitLogOperation({ list: previousList, total: previousTotal }));
          toast.error(error?.message || 'Failed to delete visit log');
        }
      },
    });
  }, [dispatch, visitLogsList, visitLogs?.total]);

  const filteredLogs = useMemo(() => {
    return visitLogsList?.filter(log => {
      const studentName = log.application?.student?.user?.name || log.application?.student?.name || '';
      const companyName = log.application?.internship?.industry?.companyName || '';
      const matchesSearch = !searchText ||
        studentName.toLowerCase().includes(searchText.toLowerCase()) ||
        companyName.toLowerCase().includes(searchText.toLowerCase()) ||
        log.visitLocation?.toLowerCase().includes(searchText.toLowerCase()) ||
        log.titleOfProjectWork?.toLowerCase().includes(searchText.toLowerCase());
      const matchesDate = !dateRange || (
        dayjs(log.visitDate).isAfter(dateRange[0]) &&
        dayjs(log.visitDate).isBefore(dateRange[1])
      );
      const matchesStatus = statusFilter === 'all' || log.status?.toUpperCase() === statusFilter;
      return matchesSearch && matchesDate && matchesStatus;
    }) || [];
  }, [visitLogsList, searchText, dateRange, statusFilter]);

  const draftCount = useMemo(() => {
    return visitLogsList?.filter(log => log.status?.toUpperCase() === 'DRAFT').length || 0;
  }, [visitLogsList]);

  const columns = useMemo(() => [
    {
      title: 'Visit Date',
      dataIndex: 'visitDate',
      key: 'visitDate',
      width: 120,
      render: (date) => dayjs(date).format('DD MMM YYYY'),
      sorter: (a, b) => dayjs(a.visitDate).unix() - dayjs(b.visitDate).unix(),
    },
    {
      title: 'Student',
      key: 'student',
      width: 180,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.application?.student?.user?.name || record.application?.student?.name || '-'}</div>
          <div className="text-xs text-gray-500">{record.application?.student?.user?.rollNumber || record.application?.student?.rollNumber}</div>
        </div>
      ),
    },
    {
      title: 'Company',
      key: 'company',
      width: 180,
      ellipsis: true,
      render: (_, record) => record.application?.internship?.industry?.companyName || '-',
    },
    {
      title: 'Visit Type',
      dataIndex: 'visitType',
      key: 'visitType',
      width: 120,
      render: (type) => {
        const colors = { PHYSICAL: 'green', VIRTUAL: 'blue', TELEPHONIC: 'orange' };
        return <Tag color={colors[type] || 'default'}>{type}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status, record) => {
        const colors = { DRAFT: 'orange', SCHEDULED: 'blue', IN_PROGRESS: 'processing', COMPLETED: 'green', CANCELLED: 'red' };
        return (
          <Space>
            <Tag color={colors[status?.toUpperCase()] || 'default'}>{status}</Tag>
            {record.visitPhotos?.length > 0 && <Tag color="purple">{record.visitPhotos.length} Photos</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      fixed: 'right',
      render: (_, record) => {
        const isDraft = record.status?.toUpperCase() === 'DRAFT';
        return (
          <Space>
            <Button icon={<EyeOutlined />} onClick={() => { setSelectedLog(record); setDetailModalVisible(true); }}>
              View
            </Button>
            <Button type={isDraft ? 'primary' : 'default'} icon={<EditOutlined />} onClick={() => handleOpenModal(record.id, record)}>
              {isDraft ? 'Complete' : 'Edit'}
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
              Delete
            </Button>
          </Space>
        );
      },
    },
  ], [handleDelete]);

  // Info row component for Modal
  const InfoRow = ({ label, value, fullWidth }) => (
    <Col span={fullWidth ? 24 : 12} className="mb-2">
      <Text className="text-[10px] block text-gray-400 mb-0.5">{label}</Text>
      <Text className="text-sm">{value || <span className="text-gray-300">-</span>}</Text>
    </Col>
  );

  return (
    <div className="p-6 min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
      <div className="max-w-7xl mx-auto !space-y-4">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <Title level={3} className="!mb-1">Visit Logs</Title>
            <Text type="secondary">Track and manage industrial visits for assigned students</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined spin={isRefreshing} />} onClick={handleRefresh} loading={isRefreshing}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              Add Visit Log
            </Button>
          </Space>
        </div>

        {/* Status Tabs */}
        <Segmented
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS.map(f => ({
            value: f.value,
            label: <span>{f.label} {f.value === 'DRAFT' && draftCount > 0 && <Tag color="orange">{draftCount}</Tag>}</span>,
          }))}
        />

        {/* Filters */}
        <Card className="rounded-xl shadow-sm">
          <Space wrap size="middle">
            <Input
              placeholder="Search by student, company, location..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 300 }}
            />
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD/MM/YYYY"
            />
          </Space>
        </Card>

        {/* Table */}
        <Card className="rounded-xl shadow-sm" bodyStyle={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={filteredLogs}
            loading={loading}
            rowKey="id"
            scroll={{ x: 1100 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} visit logs`,
            }}
          />
        </Card>
      </div>

      {/* Detail Modal */}
      <Modal
        title={null}
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setSelectedLog(null); }}
        width={640}
        styles={{ body: { padding: 0 } }}
        footer={
          <div className="flex justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: token.colorBorderSecondary }}>
            <Button size="small" onClick={() => setDetailModalVisible(false)}>Close</Button>
            <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => { setDetailModalVisible(false); handleOpenModal(selectedLog?.id, selectedLog); }}>
              {selectedLog?.status?.toUpperCase() === 'DRAFT' ? 'Complete' : 'Edit'}
            </Button>
          </div>
        }
      >
        {selectedLog ? (
          <div className="max-h-[70vh] overflow-y-auto">
            {/* Header Banner */}
            <div className="px-5 py-4 border-b" style={{ backgroundColor: token.colorPrimaryBg, borderColor: token.colorPrimaryBorder }}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <Text className="text-xs uppercase tracking-wider" style={{ color: token.colorPrimary }}>Visit Log</Text>
                  <Title level={5} className="!mb-0 !mt-1">{selectedLog.application?.student?.user?.name || selectedLog.application?.student?.name || 'Unknown Student'}</Title>
                  <Text type="secondary" className="text-xs">{selectedLog.application?.student?.user?.rollNumber || selectedLog.application?.student?.rollNumber}</Text>
                </div>
                <Space direction="vertical" align="end" size={4}>
                  <Tag color={selectedLog.status?.toUpperCase() === 'COMPLETED' ? 'success' : selectedLog.status?.toUpperCase() === 'DRAFT' ? 'orange' : 'blue'}>
                    {selectedLog.status}
                  </Tag>
                  <Tag color={selectedLog.visitType === 'PHYSICAL' ? 'green' : selectedLog.visitType === 'VIRTUAL' ? 'blue' : 'orange'}>
                    {selectedLog.visitType}
                  </Tag>
                </Space>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs">
                <Space size={4}><CalendarOutlined /><Text>{dayjs(selectedLog.visitDate).format('ddd, DD MMM YYYY • h:mm A')}</Text></Space>
                {selectedLog.application?.internship?.industry?.companyName && (
                  <Space size={4}><EnvironmentOutlined /><Text>{selectedLog.application.internship.industry.companyName}</Text></Space>
                )}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Follow-up Alert */}
              {(selectedLog.nextVisitDate || selectedLog.followUpRequired) && (
                <div className="rounded-lg p-3 flex items-center justify-between" style={{ backgroundColor: selectedLog.followUpRequired ? token.colorWarningBg : token.colorInfoBg, border: `1px solid ${selectedLog.followUpRequired ? token.colorWarningBorder : token.colorInfoBorder}` }}>
                  <Space>
                    <ClockCircleOutlined style={{ color: selectedLog.followUpRequired ? token.colorWarning : token.colorInfo }} />
                    <div>
                      <Text strong className="text-xs block">{selectedLog.followUpRequired ? 'Follow-up Required' : 'Next Visit Scheduled'}</Text>
                      {selectedLog.nextVisitDate && (
                        <Text className="text-xs">{dayjs(selectedLog.nextVisitDate).format('DD MMM YYYY')} ({dayjs(selectedLog.nextVisitDate).fromNow()})</Text>
                      )}
                    </div>
                  </Space>
                  {selectedLog.followUpRequired && <Tag color="warning" className="!m-0">Action Needed</Tag>}
                </div>
              )}

              {/* Visit Location & GPS */}
              {(selectedLog.visitLocation || selectedLog.latitude) && (
                <Card size="small" className="!mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <EnvironmentOutlined style={{ color: token.colorPrimary }} />
                    <Text strong className="text-xs uppercase">Location</Text>
                  </div>
                  <Row gutter={12}>
                    {selectedLog.visitLocation && <InfoRow label="Visit Location" value={selectedLog.visitLocation} />}
                    {selectedLog.latitude && <InfoRow label="GPS Coordinates" value={<Text code className="text-xs">{selectedLog.latitude?.toFixed(5)}, {selectedLog.longitude?.toFixed(5)}</Text>} />}
                  </Row>
                </Card>
              )}

              {/* Project Info */}
              {(selectedLog.titleOfProjectWork || selectedLog.assistanceRequiredFromInstitute || selectedLog.responseFromOrganisation || selectedLog.remarksOfOrganisationSupervisor || selectedLog.significantChangeInPlan) && (
                <Card size="small" className="!mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <ProjectOutlined style={{ color: token.colorPrimary }} />
                    <Text strong className="text-xs uppercase">Project Details</Text>
                  </div>
                  <Row gutter={[12, 8]}>
                    {selectedLog.titleOfProjectWork && <InfoRow label="Project Title" value={selectedLog.titleOfProjectWork} fullWidth />}
                    {selectedLog.assistanceRequiredFromInstitute && <InfoRow label="Assistance Required" value={selectedLog.assistanceRequiredFromInstitute} fullWidth />}
                    {selectedLog.responseFromOrganisation && <InfoRow label="Org Response" value={selectedLog.responseFromOrganisation} fullWidth />}
                    {selectedLog.remarksOfOrganisationSupervisor && <InfoRow label="Supervisor Remarks" value={selectedLog.remarksOfOrganisationSupervisor} fullWidth />}
                    {selectedLog.significantChangeInPlan && <InfoRow label="Changes in Plan" value={selectedLog.significantChangeInPlan} fullWidth />}
                  </Row>
                </Card>
              )}

              {/* Observations & Feedback */}
              {(selectedLog.observationsAboutStudent || selectedLog.feedbackSharedWithStudent) && (
                <Card size="small" className="!mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageOutlined style={{ color: token.colorPrimary }} />
                    <Text strong className="text-xs uppercase">Observations & Feedback</Text>
                  </div>
                  <div className="space-y-2">
                    {selectedLog.observationsAboutStudent && (
                      <div>
                        <Text className="text-[10px] block text-gray-400 mb-1">Observations</Text>
                        <Paragraph className="!mb-0 text-sm" style={{ backgroundColor: token.colorBgLayout, padding: '8px', borderRadius: '4px' }}>
                          {selectedLog.observationsAboutStudent}
                        </Paragraph>
                      </div>
                    )}
                    {selectedLog.feedbackSharedWithStudent && (
                      <div>
                        <Text className="text-[10px] block text-gray-400 mb-1">Feedback to Student</Text>
                        <Paragraph className="!mb-0 text-sm" style={{ backgroundColor: token.colorBgLayout, padding: '8px', borderRadius: '4px' }}>
                          {selectedLog.feedbackSharedWithStudent}
                        </Paragraph>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Attachments */}
              {(selectedLog.signedDocumentUrl || selectedLog.visitPhotos?.length > 0) && (
                <Card size="small" className="!mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <FileImageOutlined style={{ color: token.colorPrimary }} />
                    <Text strong className="text-xs uppercase">Attachments</Text>
                  </div>
                  <div className="space-y-2">
                    {selectedLog.signedDocumentUrl && (
                      <Button size="small" icon={<FileTextOutlined />} onClick={() => openFileWithPresignedUrl(selectedLog.signedDocumentUrl)}>
                        View Signed Document
                      </Button>
                    )}
                    {selectedLog.visitPhotos?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedLog.visitPhotos.map((url, idx) => (
                          <img key={idx} src={url} alt={`Photo ${idx + 1}`} className="w-14 h-14 object-cover rounded cursor-pointer border hover:opacity-80 transition-opacity" onClick={() => openFileWithPresignedUrl(url)} />
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <Empty description="No visit log selected" />
        )}
      </Modal>

      <UnifiedVisitLogModal visible={modalOpen} onClose={handleCloseModal} onSuccess={handleModalSuccess} students={assignedStudents} visitLogId={editingVisitLogId} existingData={editingVisitData} />
    </div>
  );
});

VisitLogList.displayName = 'VisitLogList';

export default VisitLogList;
