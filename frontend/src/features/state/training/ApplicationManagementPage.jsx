import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Form, Input, Modal, Segmented, Select, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useLocation, useParams } from 'react-router-dom';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import { fetchStateApplications, reviewStateApplication } from '../store/stateTrainingSlice';
import trainingCoordinatorService from '../../../services/training-coordinator.service';

const { Text } = Typography;

const STATUS_OPTIONS = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const normalizeStatus = (status) => String(status || '').trim().toUpperCase();
const isReviewableStatus = (status) => ['PENDING', 'SUBMITTED'].includes(normalizeStatus(status));

const ApplicationManagementPage = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const location = useLocation();
  const { applications } = useSelector((state) => state.stateTraining);
  const isCoordinatorRoute = location.pathname.startsWith('/app/coordinator/training/');

  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [coordinatorLoading, setCoordinatorLoading] = useState(false);
  const [coordinatorApplications, setCoordinatorApplications] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!id) return;
    if (!isCoordinatorRoute) {
      dispatch(fetchStateApplications({ trainingId: id }));
      return;
    }

    let mounted = true;
    const fetchCoordinatorApplications = async () => {
      try {
        setCoordinatorLoading(true);
        const response = await trainingCoordinatorService.getTrainingApplications(id, { page: 1, limit: 2000 });
        const list = response?.data || response?.applications || [];
        if (mounted) {
          setCoordinatorApplications(Array.isArray(list) ? list : []);
        }
      } catch (error) {
        if (mounted) {
          setCoordinatorApplications([]);
        }
      } finally {
        if (mounted) {
          setCoordinatorLoading(false);
        }
      }
    };

    fetchCoordinatorApplications();

    return () => {
      mounted = false;
    };
  }, [dispatch, id, isCoordinatorRoute]);

  const isLoading = isCoordinatorRoute
    ? coordinatorLoading && coordinatorApplications.length === 0
    : applications.loading && !applications.list;

  const openReview = (record, defaultStatus = 'APPROVED') => {
    setSelected(record);
    setReviewOpen(true);
    form.setFieldsValue({ status: defaultStatus, reviewComments: '' });
  };

  const handleReview = async () => {
    try {
      const values = await form.validateFields();
      if (isCoordinatorRoute) {
        await trainingCoordinatorService.reviewApplication(selected.id, values);
      } else {
        await dispatch(reviewStateApplication({ id: selected.id, data: values })).unwrap();
      }
      message.success('Application reviewed');
      setReviewOpen(false);
      if (isCoordinatorRoute) {
        setCoordinatorLoading(true);
        const response = await trainingCoordinatorService.getTrainingApplications(id, { page: 1, limit: 2000 });
        const list = response?.data || response?.applications || [];
        setCoordinatorApplications(Array.isArray(list) ? list : []);
        setCoordinatorLoading(false);
      } else {
        dispatch(fetchStateApplications({ trainingId: id, forceRefresh: true }));
      }
    } catch (error) {
      message.error(error || 'Failed to review application');
      if (isCoordinatorRoute) {
        setCoordinatorLoading(false);
      }
    }
  };

  const columns = [
    {
      title: 'Faculty',
      dataIndex: ['user', 'name'],
      key: 'user',
      render: (_, record) => (
        <div>
          <div className="font-medium text-sm text-slate-800">{record.user?.name || 'Faculty'}</div>
          <Text type="secondary" className="text-xs">{record.user?.email || '-'}</Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => {
        const normalizedStatus = normalizeStatus(status);
        const statusConfig = {
          APPROVED: { color: 'green', icon: <CheckCircleOutlined />, label: 'Approved' },
          REJECTED: { color: 'red', icon: <CloseCircleOutlined />, label: 'Rejected' },
          PENDING: { color: 'orange', icon: <ClockCircleOutlined />, label: 'Pending' },
          SUBMITTED: { color: 'blue', icon: <ClockCircleOutlined />, label: 'Submitted' },
        };
        const config = statusConfig[normalizedStatus] || { color: 'default', label: normalizedStatus || '-' };

        return (
          <Tag color={config.color} icon={config.icon} className="text-xs">
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: 'Applied On',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (value) => (
        <Text className="text-xs">
          {value
            ? new Date(value).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : '-'}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      render: (_, record) => {
        if (!isReviewableStatus(record.status)) return <Text type="secondary" className="text-xs">-</Text>;

        return (
          <Space size="small">
            <Tooltip title="Approve Application">
              <Button
                type="text"
                size="small"
                icon={<CheckCircleOutlined className="text-green-600" />}
                onClick={() => openReview(record, 'APPROVED')}
                aria-label={`Approve application from ${record.user?.name || 'faculty'}`}
              />
            </Tooltip>
            <Tooltip title="Reject Application">
              <Button
                type="text"
                size="small"
                icon={<CloseCircleOutlined className="text-red-600" />}
                onClick={() => openReview(record, 'REJECTED')}
                aria-label={`Reject application from ${record.user?.name || 'faculty'}`}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const filteredApplications = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    const sourceList = isCoordinatorRoute ? coordinatorApplications : (applications.list || []);

    return sourceList.filter((item) => {
      const normalizedStatus = normalizeStatus(item.status);
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'PENDING'
            ? ['PENDING', 'SUBMITTED'].includes(normalizedStatus)
            : normalizedStatus === statusFilter;

      if (!matchesStatus) return false;
      if (!search) return true;

      const name = item.user?.name || '';
      const email = item.user?.email || '';
      return name.toLowerCase().includes(search) || email.toLowerCase().includes(search);
    });
  }, [applications.list, coordinatorApplications, isCoordinatorRoute, searchText, statusFilter]);

  const searchResultCount = searchText ? filteredApplications.length : null;

  return (
    <div className="p-4 training-ui" role="main" aria-label="Application Management">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 mb-0.5">Training Applications</h1>
          <Text type="secondary" className="text-xs">
            Review training applications for this session.
          </Text>
        </div>
      </div>

      <Card className="rounded-xl border-border shadow-none mb-3!" styles={{ body: { padding: '12px' } }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search faculty..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="lg:w-80"
              size="middle"
              allowClear
              aria-label="Search faculty by name or email"
            />
            {searchResultCount !== null && (
              <Text type="secondary" className="text-xs" aria-live="polite">
                {searchResultCount} result{searchResultCount !== 1 ? 's' : ''}
              </Text>
            )}
          </div>
          <Segmented size="small" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        </div>
      </Card>

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
        {isLoading ? (
          <TableRowSkeleton rows={5} columns={4} />
        ) : filteredApplications.length > 0 ? (
          <div className="custom-scrollbar overflow-x-auto">
            <Table
              className="custom-table"
              rowKey="id"
              columns={columns}
              dataSource={filteredApplications}
              loading={isCoordinatorRoute ? coordinatorLoading : applications.loading}
              size="small"
              pagination={{ pageSize: 10, size: 'small', showSizeChanger: true }}
              aria-label="Applications table"
              scroll={{ x: 'max-content' }}
            />
          </div>
        ) : (
          <TrainingEmptyState
            type={searchText ? 'search' : 'applications'}
            message={searchText ? 'No applications found' : 'No applications yet'}
            description={searchText ? 'Try adjusting your search terms.' : 'Applications will appear here.'}
            actionText={searchText ? 'Clear Search' : null}
            onAction={searchText ? () => setSearchText('') : null}
          />
        )}
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-blue-700" />
            Review Application
          </div>
        }
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        onOk={handleReview}
        okText="Submit"
        aria-label="Review application modal"
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'APPROVED', label: 'Approve' },
                { value: 'REJECTED', label: 'Reject' },
              ]}
              aria-label="Select application status"
            />
          </Form.Item>
          <Form.Item name="reviewComments" label="Comments">
            <Input.TextArea rows={3} placeholder="Add notes" aria-label="Review comments" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApplicationManagementPage;
