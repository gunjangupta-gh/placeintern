import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Select,
  Typography,
  message,
  Tag,
  Statistic,
  Row,
  Col,
  Spin,
  Progress,
  Segmented,
} from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import trainingCoordinatorService from '../../../services/training-coordinator.service';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';

const { Text } = Typography;

const TestResponsesPage = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [preTestData, setPreTestData] = useState(null);
  const [postTestData, setPostTestData] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('preTest');

  const fetchSummary = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await trainingCoordinatorService.getTestSummary();
      const data = response?.data || response;
      setSummary(data);
    } catch (err) {
      message.error('Failed to load test summary');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const fetchTestResponses = async (trainingId) => {
    try {
      setTestLoading(true);
      const [preTestRes, postTestRes] = await Promise.all([
        trainingCoordinatorService.getPreTestResponses(trainingId),
        trainingCoordinatorService.getPostTestResponses(trainingId),
      ]);
      setPreTestData(preTestRes?.data || preTestRes);
      setPostTestData(postTestRes?.data || postTestRes);
    } catch (err) {
      message.error('Failed to load test responses');
    } finally {
      setTestLoading(false);
    }
  };

  const handleTrainingSelect = (trainingId) => {
    setSelectedTraining(trainingId);
    if (trainingId) {
      fetchTestResponses(trainingId);
    } else {
      setPreTestData(null);
      setPostTestData(null);
    }
  };

  const responseColumns = [
    {
      title: 'Faculty',
      dataIndex: ['user', 'name'],
      key: 'user',
      render: (_, record) => (
        <div>
          <div className="font-medium text-sm text-slate-800">{record.user?.name}</div>
          <Text type="secondary" className="text-xs">
            {record.user?.branchName || record.user?.designation}
          </Text>
        </div>
      ),
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (score) => (
        <span className="font-medium text-sm">{score !== null ? `${score.toFixed(1)}%` : 'N/A'}</span>
      ),
    },
    {
      title: 'Result',
      dataIndex: 'passed',
      key: 'passed',
      width: 100,
      render: (passed) =>
        passed === null ? (
          <Tag>Not Graded</Tag>
        ) : passed ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            Passed
          </Tag>
        ) : (
          <Tag color="red" icon={<CloseCircleOutlined />}>
            Failed
          </Tag>
        ),
    },
    {
      title: 'Submitted',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 100,
      render: (value) => (
        <Text className="text-xs">
          {value && new Date(value).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="Loading test summary..." />
      </div>
    );
  }

  const trainings = summary?.trainings || [];
  const currentTestData = activeTab === 'preTest' ? preTestData : postTestData;

  return (
    <div className="p-4 training-ui">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold mb-0">Test Responses</h2>
          <Text type="secondary" className="text-xs">
            View pre-test and post-test responses from institution faculty
          </Text>
        </div>
        <Button
          icon={<SyncOutlined spin={refreshing} />}
          onClick={() => fetchSummary(true)}
          loading={refreshing}
          size="middle"
        >
          Refresh
        </Button>
      </div>

      {/* Training Summary */}
      <Card className="rounded-xl border-border shadow-none mb-4" styles={{ body: { padding: '12px' } }}>
        <div className="mb-2 pb-2 border-b border-slate-200">
          <Text className="text-xs font-medium text-slate-700">Training Test Summary</Text>
        </div>
        {trainings.length === 0 ? (
          <div className="py-6">
            <TrainingEmptyState
              type="search"
              message="No trainings found"
              description="No trainings with test forms found."
            />
          </div>
        ) : (
          <div className="custom-scrollbar overflow-x-auto">
            <Table
              className="custom-table"
              dataSource={trainings}
              rowKey="trainingId"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: 'Training',
                  dataIndex: 'trainingTitle',
                  key: 'title',
                  render: (title) => (
                    <div className="font-medium text-sm text-slate-800 truncate" style={{ maxWidth: 180 }}>
                      {title}
                    </div>
                  ),
                },
                {
                  title: 'Enrolled',
                  dataIndex: 'enrolledCount',
                  key: 'enrolled',
                  width: 90,
                  render: (count) => <Tag color="blue">{count}</Tag>,
                },
                {
                  title: 'Pre-Test',
                  dataIndex: 'preTest',
                  key: 'preTest',
                  width: 130,
                  render: (preTest) =>
                    preTest ? (
                      <div className="flex items-center gap-2">
                        <Progress
                          percent={preTest.completionRate}
                          size="small"
                          style={{ width: 50 }}
                          showInfo={false}
                        />
                        <Text className="text-xs">
                          {preTest.submitted}/{preTest.submitted + preTest.pending}
                        </Text>
                      </div>
                    ) : (
                      <Tag>N/A</Tag>
                    ),
                },
                {
                  title: 'Post-Test',
                  dataIndex: 'postTest',
                  key: 'postTest',
                  width: 130,
                  render: (postTest) =>
                    postTest ? (
                      <div className="flex items-center gap-2">
                        <Progress
                          percent={postTest.completionRate}
                          size="small"
                          style={{ width: 50 }}
                          showInfo={false}
                        />
                        <Text className="text-xs">
                          {postTest.submitted}/{postTest.submitted + postTest.pending}
                        </Text>
                      </div>
                    ) : (
                      <Tag>N/A</Tag>
                    ),
                },
                {
                  title: '',
                  key: 'actions',
                  width: 80,
                  render: (_, record) => (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => handleTrainingSelect(record.trainingId)}
                    >
                      View
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Card>

      {/* Detailed Responses */}
      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
          <div className="flex items-center gap-2 flex-1">
            <Text className="text-xs text-slate-500 whitespace-nowrap">Training:</Text>
            <Select
              placeholder="Select training"
              value={selectedTraining}
              onChange={handleTrainingSelect}
              className="flex-1 lg:max-w-xs"
              size="middle"
              allowClear
            >
              {trainings.map((t) => (
                <Select.Option key={t.trainingId} value={t.trainingId}>
                  {t.trainingTitle}
                </Select.Option>
              ))}
            </Select>
          </div>
          {selectedTraining && (
            <Segmented
              size="small"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { label: `Pre-Test (${preTestData?.stats?.total || 0})`, value: 'preTest' },
                { label: `Post-Test (${postTestData?.stats?.total || 0})`, value: 'postTest' },
              ]}
            />
          )}
        </div>

        {selectedTraining ? (
          <Spin spinning={testLoading}>
            {currentTestData?.stats && (
              <Row gutter={[12, 12]} className="mb-4">
                <Col xs={12} sm={6}>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <Text className="text-xs text-slate-500">Total</Text>
                    <div className="text-lg font-semibold text-slate-800">{currentTestData.stats.total}</div>
                  </div>
                </Col>
                <Col xs={12} sm={6}>
                  <div className="bg-green-50 rounded-lg p-3">
                    <Text className="text-xs text-slate-500">Passed</Text>
                    <div className="text-lg font-semibold text-green-600">{currentTestData.stats.passed}</div>
                  </div>
                </Col>
                <Col xs={12} sm={6}>
                  <div className="bg-red-50 rounded-lg p-3">
                    <Text className="text-xs text-slate-500">Failed</Text>
                    <div className="text-lg font-semibold text-red-600">{currentTestData.stats.failed}</div>
                  </div>
                </Col>
                <Col xs={12} sm={6}>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <Text className="text-xs text-slate-500">Avg Score</Text>
                    <div className="text-lg font-semibold text-blue-600">{currentTestData.stats.averageScore?.toFixed(1) || 0}%</div>
                  </div>
                </Col>
              </Row>
            )}
            <div className="custom-scrollbar overflow-x-auto">
              <Table
                className="custom-table"
                dataSource={currentTestData?.responses || []}
                columns={responseColumns}
                rowKey="id"
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
                      message={`No ${activeTab === 'preTest' ? 'pre-test' : 'post-test'} responses`}
                      description="No responses found for this training."
                    />
                  ),
                }}
              />
            </div>
          </Spin>
        ) : (
          <div className="py-8">
            <TrainingEmptyState
              type="search"
              message="Select a training"
              description="Select a training above to view detailed test responses."
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default TestResponsesPage;
