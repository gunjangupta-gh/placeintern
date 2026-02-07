import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Typography,
  Row,
  Col,
  Table,
  Tag,
  Badge,
  Drawer,
  Timeline,
  Empty,
  Divider,
  Spin,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  SendOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  TeamOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import {
  fetchGrievances,
  fetchMentor,
  createGrievance,
} from '../store/studentSlice';
import {
  selectGrievancesList,
  selectGrievancesLoading,
  selectMentorWithFallback,
} from '../store/studentSelectors';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const ESCALATION_LEVELS = {
  MENTOR: { label: 'Faculty Mentor', color: 'blue', icon: <UserOutlined /> },
  PRINCIPAL: { label: 'Principal', color: 'orange', icon: <TeamOutlined /> },
  STATE_DIRECTORATE: { label: 'State Directorate', color: 'red', icon: <GlobalOutlined /> },
};

const CATEGORIES = [
  { value: 'INTERNSHIP_RELATED', label: 'Internship Related' },
  { value: 'MENTOR_RELATED', label: 'Mentor Related' },
  { value: 'INDUSTRY_RELATED', label: 'Industry Related' },
  { value: 'PAYMENT_ISSUE', label: 'Payment Issue' },
  { value: 'WORKPLACE_HARASSMENT', label: 'Workplace Harassment' },
  { value: 'WORK_CONDITION', label: 'Work Condition' },
  { value: 'SAFETY_CONCERN', label: 'Safety Concern' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low', color: 'green' },
  { value: 'MEDIUM', label: 'Medium', color: 'orange' },
  { value: 'HIGH', label: 'High', color: 'red' },
  { value: 'URGENT', label: 'Urgent', color: 'magenta' },
];

const SubmitGrievance = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  // Redux state
  const grievances = useSelector(selectGrievancesList);
  const loading = useSelector(selectGrievancesLoading);
  const assignedMentor = useSelector(selectMentorWithFallback);

  // Local state
  const [submitting, setSubmitting] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    dispatch(fetchGrievances({}));
    dispatch(fetchMentor({}));
  }, [dispatch]);

  const handleSubmit = async (values) => {
    // Validate mentor is assigned before submitting
    if (!assignedMentor?.id) {
      toast.error('No mentor assigned. Please contact your institution.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        category: values.category,
        title: values.subject,
        description: values.description,
        severity: values.priority,
        assignedToId: assignedMentor.id,
      };
      await dispatch(createGrievance(payload)).unwrap();
      toast.success('Grievance submitted successfully');
      setModalVisible(false);
      form.resetFields();
      dispatch(fetchGrievances({ forceRefresh: true }));
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to submit grievance';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenModal = () => {
    if (!assignedMentor) {
      toast.error('No mentor assigned. Please contact your institution.');
      return;
    }
    setModalVisible(true);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return <CheckCircleOutlined className="text-green-500" />;
      case 'ESCALATED':
      case 'REJECTED':
        return <CloseCircleOutlined className="text-red-500" />;
      case 'IN_PROGRESS':
      case 'IN_REVIEW':
        return <ClockCircleOutlined className="text-orange-500" />;
      default:
        return <ExclamationCircleOutlined className="text-blue-500" />;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      SUBMITTED: 'processing',
      IN_REVIEW: 'warning',
      ESCALATED: 'error',
      RESOLVED: 'success',
      CLOSED: 'default',
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: 'Subject',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(record.status)}
          <Text className="text-sm font-medium">{text}</Text>
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category) => {
        const config = CATEGORIES.find(c => c.value === category);
        return <Tag className="rounded-md text-[10px] m-0">{config?.label || category}</Tag>;
      },
    },
    {
      title: 'Priority',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity) => {
        const config = PRIORITIES.find(p => p.value === severity);
        return <Tag color={config?.color} className="rounded-md text-[10px] m-0">{config?.label || severity}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Badge status={getStatusColor(status)} text={<span className="text-xs">{status?.replace(/_/g, ' ')}</span>} />,
    },
    {
      title: 'Date',
      dataIndex: 'submittedDate',
      key: 'submittedDate',
      render: (date, record) => {
        const d = date || record.createdAt;
        return <Text className="text-xs text-text-secondary">{d ? dayjs(d).format('MMM D, YYYY') : 'N/A'}</Text>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, record) => (
        <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedGrievance(record); setDrawerVisible(true); }} />
      ),
    },
  ];

  const grievanceList = Array.isArray(grievances) ? grievances : [];

  return (
    <div className="p-4 md:p-5 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <Title level={4} className="!mb-0 !text-lg">My Grievances</Title>
          <Text className="text-xs text-text-tertiary">Submit and track your concerns</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenModal} className="rounded-lg text-xs h-8">
          New Grievance
        </Button>
      </div>

      {/* Grievances Table */}
      <Card className="rounded-xl border" styles={{ body: { padding: 0 } }}>
        {loading ? (
          <div className="flex justify-center py-16"><Spin size="small" /></div>
        ) : (
          <Table
            dataSource={grievanceList}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: false, size: 'small' }}
            locale={{
              emptyText: (
                <Empty description="No grievances submitted" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                  <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleOpenModal}>
                    Submit First Grievance
                  </Button>
                </Empty>
              ),
            }}
            className="[&_.ant-table-thead_th]:bg-gray-50 [&_.ant-table-thead_th]:text-[10px] [&_.ant-table-thead_th]:font-semibold [&_.ant-table-thead_th]:uppercase [&_.ant-table-thead_th]:text-text-tertiary"
          />
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        title={<span className="text-sm font-semibold">Submit Grievance</span>}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        footer={null}
        width={500}
        className="[&_.ant-modal-content]:rounded-xl"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="category" label={<span className="text-xs font-medium">Category</span>} rules={[{ required: true }]}>
                <Select placeholder="Select" className="h-9 text-xs">
                  {CATEGORIES.map(c => <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label={<span className="text-xs font-medium">Priority</span>} rules={[{ required: true }]} initialValue="MEDIUM">
                <Select placeholder="Select" className="h-9 text-xs">
                  {PRIORITIES.map(p => <Select.Option key={p.value} value={p.value}><Tag color={p.color} className="m-0 text-[10px]">{p.label}</Tag></Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="subject" label={<span className="text-xs font-medium">Subject</span>} rules={[{ required: true }, { min: 10, message: 'Min 10 characters' }]}>
            <Input placeholder="Brief summary of your concern" className="rounded-lg h-9 text-xs" />
          </Form.Item>

          <Form.Item name="description" label={<span className="text-xs font-medium">Description</span>} rules={[{ required: true }, { min: 50, message: 'Min 50 characters' }]}>
            <TextArea rows={4} placeholder="Provide detailed information about your concern..." className="rounded-lg text-xs" />
          </Form.Item>

          <Divider className="my-3" />

          <div className="flex justify-end gap-2">
            <Button onClick={() => { setModalVisible(false); form.resetFields(); }} className="rounded-lg h-8 text-xs">Cancel</Button>
            <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting} className="rounded-lg h-8 text-xs">Submit</Button>
          </div>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={<span className="text-sm font-semibold">Grievance Details</span>}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setSelectedGrievance(null); }}
        styles={{ wrapper: { width: 400 } }}
        className="[&_.ant-drawer-body]:p-4"
      >
        {selectedGrievance && (
          <div className="space-y-4">
            {/* Status */}
            <div className="p-3 rounded-xl bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedGrievance.status)}
                <Text className="text-sm font-semibold">{selectedGrievance.status?.replace(/_/g, ' ')}</Text>
              </div>
              <Tag color={PRIORITIES.find(p => p.value === selectedGrievance.severity)?.color} className="m-0 rounded-md text-[10px]">
                {selectedGrievance.severity}
              </Tag>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-gray-50">
                <Text className="text-[10px] text-text-tertiary uppercase block">Category</Text>
                <Text className="text-xs font-medium">{CATEGORIES.find(c => c.value === selectedGrievance.category)?.label}</Text>
              </div>
              <div className="p-3 rounded-lg bg-gray-50">
                <Text className="text-[10px] text-text-tertiary uppercase block">Escalation</Text>
                <Text className="text-xs font-medium">{ESCALATION_LEVELS[selectedGrievance.escalationLevel]?.label || 'Pending'}</Text>
              </div>
              <div className="p-3 rounded-lg bg-gray-50">
                <Text className="text-[10px] text-text-tertiary uppercase block">Submitted</Text>
                <Text className="text-xs font-medium">{dayjs(selectedGrievance.submittedDate || selectedGrievance.createdAt).format('MMM D, YYYY')}</Text>
              </div>
              {selectedGrievance.assignedTo && (
                <div className="p-3 rounded-lg bg-gray-50">
                  <Text className="text-[10px] text-text-tertiary uppercase block">Assigned To</Text>
                  <Text className="text-xs font-medium">{selectedGrievance.assignedTo.name}</Text>
                </div>
              )}
            </div>

            {/* Content */}
            <div>
              <Text className="text-[10px] text-text-tertiary uppercase font-semibold block mb-1">Subject</Text>
              <Text className="text-sm font-semibold">{selectedGrievance.title}</Text>
            </div>

            <div>
              <Text className="text-[10px] text-text-tertiary uppercase font-semibold block mb-1">Description</Text>
              <Paragraph className="text-xs text-text-secondary mb-0 whitespace-pre-wrap">{selectedGrievance.description}</Paragraph>
            </div>

            {/* Resolution */}
            {selectedGrievance.resolution && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                <Text className="text-[10px] text-text-tertiary uppercase font-semibold block mb-1">Resolution</Text>
                <Paragraph className="text-xs mb-0">{selectedGrievance.resolution}</Paragraph>
              </div>
            )}

            {/* History */}
            {selectedGrievance.statusHistory?.length > 0 && (
              <div>
                <Text className="text-[10px] text-text-tertiary uppercase font-semibold block mb-3">History</Text>
                <Timeline
                  items={selectedGrievance.statusHistory.map((h, i) => ({
                    color: h.toStatus === 'RESOLVED' ? 'green' : h.toStatus === 'ESCALATED' ? 'red' : 'blue',
                    children: (
                      <div key={i}>
                        <Text className="text-xs font-medium block">{h.action}</Text>
                        <Text className="text-[10px] text-text-tertiary">{dayjs(h.createdAt).format('MMM D, YYYY h:mm A')}</Text>
                        {h.remarks && <Text className="text-[10px] text-text-secondary block italic">"{h.remarks}"</Text>}
                      </div>
                    ),
                  }))}
                />
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default SubmitGrievance;
