import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  message,
  Tooltip,
  Badge,
  Checkbox,
  Segmented,
  Alert,
  Spin,
} from 'antd';
import {
  SendOutlined,
  SyncOutlined,
  SearchOutlined,
  UserOutlined,
  BellOutlined,
  CheckCircleOutlined,
  BookOutlined,
  NotificationOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import trainingCoordinatorService from '../../../services/training-coordinator.service';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';

const { Text } = Typography;
const { TextArea } = Input;

const ACTION_TYPE_TO_TAB = {
  enrollment: 'enrollment',
  pre_test: 'preTest',
  post_test: 'postTest',
  lesson_plan: 'lessonPlan',
  feedback: 'feedback',
};

const RemindersPage = () => {
  const [searchParams] = useSearchParams();
  const initialActionType = searchParams.get('actionType');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingActions, setPendingActions] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState([]);
  const [activeTab, setActiveTab] = useState(ACTION_TYPE_TO_TAB[initialActionType] || 'enrollment');

  // Send reminder modal state
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderType, setReminderType] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [form] = Form.useForm();

  const fetchPendingActions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await trainingCoordinatorService.getPendingActions();
      const data = response?.data || response;
      setPendingActions(data);
    } catch (err) {
      message.error('Failed to load pending actions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingActions();
  }, [fetchPendingActions]);

  const openReminderModal = (type, training = null) => {
    setReminderType(type);
    setSelectedTraining(training);
    setReminderOpen(true);
    form.setFieldsValue({
      sendInApp: true,
      customMessage: '',
    });
  };

  const handleSendReminder = async () => {
    try {
      setSendingReminder(true);
      const values = await form.validateFields();

      const payload = {
        ...(selectedTraining?.trainingId && { trainingId: selectedTraining.trainingId }),
        ...(selectedFaculty.length > 0 && { userIds: selectedFaculty }),
        sendInApp: true,
        sendEmail: false,
        ...(values.customMessage && { customMessage: values.customMessage }),
      };

      let response;
      switch (reminderType) {
        case 'enrollment':
          response = await trainingCoordinatorService.sendEnrollmentReminder(payload);
          break;
        case 'preTest':
          response = await trainingCoordinatorService.sendPreTestReminder(payload);
          break;
        case 'postTest':
          response = await trainingCoordinatorService.sendPostTestReminder(payload);
          break;
        case 'lessonPlan':
          response = await trainingCoordinatorService.sendLessonPlanReminder(payload);
          break;
        case 'feedback':
          response = await trainingCoordinatorService.sendFeedbackReminder(payload);
          break;
        default:
          throw new Error('Invalid reminder type');
      }

      message.success(`Reminder sent to ${response.sentCount || 'all'} faculty members`);
      setReminderOpen(false);
      setSelectedFaculty([]);
      fetchPendingActions(true);
    } catch (error) {
      message.error(error?.message || 'Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  const getReminderTypeLabel = (type) => {
    const labels = {
      enrollment: 'Enrollment',
      preTest: 'Pre-Test',
      postTest: 'Post-Test',
      lessonPlan: 'Lesson Plan',
      feedback: 'Feedback',
    };
    return labels[type] || type;
  };

  const faculty = pendingActions?.faculty || [];

  const filteredFaculty = faculty.filter((f) => {
    const searchLower = searchText.toLowerCase();
    return (
      f.user?.name?.toLowerCase().includes(searchLower) ||
      f.user?.email?.toLowerCase().includes(searchLower) ||
      f.user?.branchName?.toLowerCase().includes(searchLower)
    );
  });

  const reminderSummary = useMemo(() => {
    const summary = {
      enrollments: 0,
      preTests: 0,
      postTests: 0,
      lessonPlans: 0,
      feedbacks: 0,
    };

    faculty.forEach((item) => {
      summary.enrollments += item.pendingEnrollments?.length || 0;
      summary.preTests += item.pendingPreTests?.length || 0;
      summary.postTests += item.pendingPostTests?.length || 0;
      summary.lessonPlans += item.pendingLessonPlans?.length || 0;
      summary.feedbacks += item.pendingFeedbacks?.length || 0;
    });

    return summary;
  }, [faculty]);

  // Get unique trainings from pending actions
  const getTrainingsWithPending = (type) => {
    const trainingsMap = new Map();

    faculty.forEach((f) => {
      let items = [];
      switch (type) {
        case 'enrollment':
          items = f.pendingEnrollments || [];
          break;
        case 'preTest':
          items = f.pendingPreTests || [];
          break;
        case 'postTest':
          items = f.pendingPostTests || [];
          break;
        case 'lessonPlan':
          items = f.pendingLessonPlans || [];
          break;
        case 'feedback':
          items = f.pendingFeedbacks || [];
          break;
      }

      items.forEach((item) => {
        if (item.trainingId && item.trainingTitle) {
          if (!trainingsMap.has(item.trainingId)) {
            trainingsMap.set(item.trainingId, {
              trainingId: item.trainingId,
              trainingTitle: item.trainingTitle,
              trainingStartDate: item.startDate || null,
              trainingEndDate: item.endDate || null,
              pendingCount: 0,
              faculty: [],
            });
          }
          const training = trainingsMap.get(item.trainingId);
          training.pendingCount++;
          training.faculty.push(f.user);
          if (!training.trainingStartDate && item.startDate) {
            training.trainingStartDate = item.startDate;
          }
          if (!training.trainingEndDate && item.endDate) {
            training.trainingEndDate = item.endDate;
          }
        }
      });
    });

    return Array.from(trainingsMap.values());
  };

  const facultyColumns = [
    {
      title: (
        <Checkbox
          checked={selectedFaculty.length > 0 && selectedFaculty.length === filteredFaculty.length}
          indeterminate={selectedFaculty.length > 0 && selectedFaculty.length < filteredFaculty.length}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedFaculty(filteredFaculty.map((f) => f.user.id));
            } else {
              setSelectedFaculty([]);
            }
          }}
        />
      ),
      key: 'select',
      width: 40,
      render: (_, record) => (
        <Checkbox
          checked={selectedFaculty.includes(record.user.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedFaculty([...selectedFaculty, record.user.id]);
            } else {
              setSelectedFaculty(selectedFaculty.filter((id) => id !== record.user.id));
            }
          }}
        />
      ),
    },
    {
      title: 'Faculty',
      dataIndex: ['user', 'name'],
      key: 'user',
      render: (_, record) => (
        <div>
          <div className="font-medium text-sm text-slate-800">{record.user?.name}</div>
          <Text type="secondary" className="text-xs">
            {record.user?.branchName || record.user?.email}
          </Text>
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="Pending enrollment count. One count = one training where the faculty has not applied yet.">
          <span>Enroll</span>
        </Tooltip>
      ),
      key: 'enrollments',
      width: 70,
      render: (_, record) => (
        <Badge
          count={record.pendingEnrollments?.length || 0}
          showZero
          style={{
            backgroundColor: record.pendingEnrollments?.length > 0 ? '#faad14' : '#d9d9d9',
          }}
        />
      ),
    },
    {
      title: (
        <Tooltip title="Pending pre-test count. One count = one enrolled training with pre-test not submitted.">
          <span>Pre</span>
        </Tooltip>
      ),
      key: 'preTests',
      width: 60,
      render: (_, record) => (
        <Badge
          count={record.pendingPreTests?.length || 0}
          showZero
          style={{
            backgroundColor: record.pendingPreTests?.length > 0 ? '#722ed1' : '#d9d9d9',
          }}
        />
      ),
    },
    {
      title: (
        <Tooltip title="Pending post-test count. One count = one completed training with post-test not submitted.">
          <span>Post</span>
        </Tooltip>
      ),
      key: 'postTests',
      width: 60,
      render: (_, record) => (
        <Badge
          count={record.pendingPostTests?.length || 0}
          showZero
          style={{
            backgroundColor: record.pendingPostTests?.length > 0 ? '#52c41a' : '#d9d9d9',
          }}
        />
      ),
    },
    {
      title: (
        <Tooltip title="Pending lesson plan count. One count = one completed training with no lesson plan submission.">
          <span>Plans</span>
        </Tooltip>
      ),
      key: 'lessonPlans',
      width: 60,
      render: (_, record) => (
        <Badge
          count={record.pendingLessonPlans?.length || 0}
          showZero
          style={{
            backgroundColor: record.pendingLessonPlans?.length > 0 ? '#eb2f96' : '#d9d9d9',
          }}
        />
      ),
    },
    {
      title: (
        <Tooltip title="Pending feedback count. One count = one completed training with feedback not submitted.">
          <span>Feedback</span>
        </Tooltip>
      ),
      key: 'feedback',
      width: 80,
      render: (_, record) => (
        <Badge
          count={record.pendingFeedbacks?.length || 0}
          showZero
          style={{
            backgroundColor: record.pendingFeedbacks?.length > 0 ? '#fa8c16' : '#d9d9d9',
          }}
        />
      ),
    },
  ];

  const trainingColumns = [
    {
      title: 'Training',
      dataIndex: 'trainingTitle',
      key: 'title',
      render: (title) => (
        <div className="font-medium text-sm text-slate-800 whitespace-normal wrap-break-word leading-5">
          {title || '-'}
        </div>
      ),
    },
    {
      title: 'Training Date',
      key: 'trainingDate',
      width: 190,
      render: (_, record) => {
        const start = record.trainingStartDate ? new Date(record.trainingStartDate) : null;
        const end = record.trainingEndDate ? new Date(record.trainingEndDate) : null;

        if (!start && !end) {
          return <Text type="secondary" className="text-xs">-</Text>;
        }

        return (
          <Text className="text-xs text-slate-700">
            {start ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
            {' - '}
            {end ? end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
          </Text>
        );
      },
    },
    {
      title: 'Pending',
      dataIndex: 'pendingCount',
      key: 'pendingCount',
      width: 80,
      render: (count) => <Badge count={count} style={{ backgroundColor: '#faad14' }} />,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<SendOutlined />}
          onClick={() => openReminderModal(activeTab, record)}
        >
          Send
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Spin size="large" tip="Loading pending actions..." />
      </div>
    );
  }

  return (
    <div className="p-4 training-ui">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold mb-0">Send Reminders</h2>
          <Text type="secondary" className="text-xs">
            Send reminders to faculty for pending training activities
          </Text>
        </div>
        <Button
          icon={<SyncOutlined spin={refreshing} />}
          onClick={() => fetchPendingActions(true)}
          loading={refreshing}
          size="middle"
        >
          Refresh
        </Button>
      </div>

      {/* Summary Alert */}
      {pendingActions?.facultyWithPendingActions > 0 && (
        <Alert
          message={`${pendingActions.facultyWithPendingActions} faculty members have pending actions`}
          description={
            <div className="text-xs flex flex-wrap gap-x-4 gap-y-1 mt-1">
              <span>Enrollments: <strong>{reminderSummary.enrollments}</strong></span>
              <span>Pre-Tests: <strong>{reminderSummary.preTests}</strong></span>
              <span>Post-Tests: <strong>{reminderSummary.postTests}</strong></span>
              <span>Lesson Plans: <strong>{reminderSummary.lessonPlans}</strong></span>
              <span>Feedback: <strong>{reminderSummary.feedbacks}</strong></span>
            </div>
          }
          type="info"
          showIcon
          closable
          className="mb-4! rounded-lg"
        />
      )}

      <Alert
        className="mb-4! rounded-lg"
        showIcon
        type="warning"
        icon={<InfoCircleOutlined />}
        message="How reminder counts work"
        description={
          <div className="text-xs">
            Each number is a pending action item, not the number of reminders sent.
            1 means one training pending for that faculty in that category (Enroll, Pre-Test, Post-Test, Lesson Plan, Feedback).
          </div>
        }
      />

      {/* By Training Tab View */}
      <Card className="rounded-xl border-border shadow-none mb-4!" styles={{ body: { padding: '12px' } }}>
        <div className="mb-3">
          <Segmented
            size="small"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { label: <span><UserOutlined /> Enrollments</span>, value: 'enrollment' },
              { label: <span><BellOutlined /> Pre-Tests</span>, value: 'preTest' },
              { label: <span><CheckCircleOutlined /> Post-Tests</span>, value: 'postTest' },
              { label: <span><BookOutlined /> Lesson Plans</span>, value: 'lessonPlan' },
              { label: <span><NotificationOutlined /> Feedback</span>, value: 'feedback' },
            ]}
          />
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          <Table
            className="custom-table"
            dataSource={getTrainingsWithPending(activeTab)}
            columns={trainingColumns}
            rowKey="trainingId"
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <TrainingEmptyState
                  type="search"
                  message={`No pending ${getReminderTypeLabel(activeTab).toLowerCase()}s`}
                  description="All faculty are up to date."
                />
              ),
            }}
          />
        </div>
      </Card>

      {/* Faculty List */}
      <Card
        className="rounded-xl border-border shadow-none mb-4!"
        styles={{ body: { padding: '12px' } }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
          <Input
            placeholder="Search faculty..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="lg:flex-1"
            size="middle"
            allowClear
          />
          {selectedFaculty.length > 0 && (
            <Space size="small">
              <Text type="secondary" className="text-xs">{selectedFaculty.length} selected</Text>
              <Select
                placeholder="Send reminder..."
                className="w-36"
                size="small"
                onChange={(type) => openReminderModal(type)}
              >
                <Select.Option value="enrollment">Enrollment</Select.Option>
                <Select.Option value="preTest">Pre-Test</Select.Option>
                <Select.Option value="postTest">Post-Test</Select.Option>
                <Select.Option value="lessonPlan">Lesson Plan</Select.Option>
                <Select.Option value="feedback">Feedback</Select.Option>
              </Select>
            </Space>
          )}
        </div>

        {filteredFaculty.length > 0 && (
          <div className="mb-2 pb-2 border-b border-slate-200">
            <Text className="text-[10px] text-slate-600">
              Showing <Text strong>{filteredFaculty.length}</Text> faculty with pending actions
            </Text>
          </div>
        )}

        <div className="custom-scrollbar overflow-x-auto">
          <Table
            className="custom-table"
            dataSource={filteredFaculty}
            columns={facultyColumns}
            rowKey={(record) => record.user.id}
            size="small"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => (
                <Text className="text-[10px] text-slate-600">
                  {range[0]}-{range[1]} of {total}
                </Text>
              ),
              size: 'small',
            }}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <TrainingEmptyState
                  type="search"
                  message="No faculty found"
                  description={searchText ? "Try adjusting your search." : "No faculty with pending actions."}
                />
              ),
            }}
          />
        </div>
      </Card>

      {/* Send Reminder Modal */}
      <Modal
        title={`Send ${getReminderTypeLabel(reminderType)} Reminder`}
        open={reminderOpen}
        onCancel={() => setReminderOpen(false)}
        onOk={handleSendReminder}
        confirmLoading={sendingReminder}
        okText="Send Reminder"
        okButtonProps={{ icon: <SendOutlined /> }}
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          {selectedTraining && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm">
              <div className="mb-1">
                <Text className="text-xs text-slate-500">Training</Text>
                <div className="font-medium text-slate-800">{selectedTraining.trainingTitle}</div>
              </div>
              <div>
                <Text className="text-xs text-slate-500">Pending</Text>
                <div className="font-medium text-slate-800">{selectedTraining.pendingCount} faculty</div>
              </div>
            </div>
          )}

          {selectedFaculty.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
              <Text className="text-xs text-slate-500">Selected Faculty</Text>
              <div className="font-medium text-slate-800">{selectedFaculty.length} members</div>
            </div>
          )}

          <Form.Item label="Notification Channel" className="mb-3">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <NotificationOutlined className="text-blue-500" />
              <Text className="text-sm text-slate-700">In-App Notification (default)</Text>
            </div>
          </Form.Item>

          <Form.Item name="customMessage" label="Custom Message (Optional)">
            <TextArea
              rows={3}
              placeholder="Add a custom message to include in the reminder..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RemindersPage;
