import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Select,
  Typography,
  message,
  Tag,
  Row,
  Col,
  Spin,
  Segmented,
  Modal,
} from 'antd';
import {
  SyncOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import trainingAdminService from '../../../services/training-admin.service';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';

const { Text } = Typography;

const normalizeTrainings = (response) => {
  const payload = response?.data || response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.list)) return payload.list;
  return [];
};

const TestResponsesPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const trainingIdFromQuery = searchParams.get('trainingId');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trainings, setTrainings] = useState([]);
  const [selectedTraining, setSelectedTraining] = useState(trainingIdFromQuery || null);
  const [preTestData, setPreTestData] = useState(null);
  const [postTestData, setPostTestData] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('preTest');
  const [previewResponse, setPreviewResponse] = useState(null);

  const fetchTrainings = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await trainingAdminService.getTrainings({ limit: 1000 });
      setTrainings(normalizeTrainings(response));
    } catch (error) {
      message.error('Failed to load trainings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrainings();
  }, []);

  const fetchTestResponses = async (trainingId) => {
    if (!trainingId) {
      setPreTestData(null);
      setPostTestData(null);
      return;
    }

    try {
      setTestLoading(true);
      const [preTestRes, postTestRes] = await Promise.all([
        trainingAdminService.getPreTestResponses(trainingId),
        trainingAdminService.getPostTestResponses(trainingId),
      ]);
      setPreTestData(preTestRes?.data || preTestRes);
      setPostTestData(postTestRes?.data || postTestRes);
    } catch (error) {
      message.error('Failed to load test responses');
    } finally {
      setTestLoading(false);
    }
  };

  useEffect(() => {
    if (!trainingIdFromQuery) return;
    setSelectedTraining(trainingIdFromQuery);
    fetchTestResponses(trainingIdFromQuery);
  }, [trainingIdFromQuery]);

  const handleTrainingSelect = (trainingId) => {
    setSelectedTraining(trainingId || null);
    if (trainingId) {
      setSearchParams({ trainingId });
      fetchTestResponses(trainingId);
    } else {
      setSearchParams({});
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
            {record.user?.branchName || record.user?.designation || record.user?.email}
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
      title: '',
      key: 'view',
      width: 90,
      render: (_, record) => (
        <Button size="small" type="link" onClick={() => setPreviewResponse(record)}>
          View
        </Button>
      ),
    },
  ];

  const currentTestData = activeTab === 'preTest' ? preTestData : postTestData;

  const selectedTrainingTitle = useMemo(
    () => trainings.find((item) => String(item.id) === String(selectedTraining))?.title,
    [trainings, selectedTraining],
  );

  const previewQuestionRows = useMemo(() => {
    if (!previewResponse) return [];

    const formQuestions =
      currentTestData?.testForm?.questions
      || currentTestData?.form?.questions
      || previewResponse?.testForm?.questions
      || previewResponse?.form?.questions
      || [];

    const questions = Array.isArray(formQuestions) ? formQuestions : [];
    const answers = previewResponse?.responses || {};

    if (!questions.length) {
      return Object.entries(answers).map(([key, value], index) => ({
        id: key || `q-${index}`,
        label: key || `Question ${index + 1}`,
        answer: value,
      }));
    }

    const baseRows = questions.map((question, index) => ({
      id: question.id || `q-${index}`,
      label: question.question || question.id || `Question ${index + 1}`,
      answer: answers[question.id],
      correctAnswer: question.correctAnswer,
    }));

    const questionIds = new Set(questions.map((q) => q.id).filter(Boolean));
    const extraRows = Object.entries(answers)
      .filter(([key]) => !questionIds.has(key))
      .map(([key, value], index) => ({
        id: `extra-${key || index}`,
        label: key || `Additional ${index + 1}`,
        answer: value,
      }));

    return [...baseRows, ...extraRows];
  }, [previewResponse, currentTestData]);

  const renderAnswerValue = (value) => {
    if (value === null || value === undefined || String(value).trim() === '') {
      return '-';
    }
    if (Array.isArray(value)) {
      return value.length ? value.join(', ') : '-';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const isAnswerCorrect = (answer, correctAnswer) => {
    if (correctAnswer === null || correctAnswer === undefined) return null;

    if (Array.isArray(correctAnswer)) {
      if (!Array.isArray(answer)) return false;
      const expected = [...correctAnswer].map(String).sort();
      const actual = [...answer].map(String).sort();
      return JSON.stringify(actual) === JSON.stringify(expected);
    }

    if (Array.isArray(answer)) return false;
    return String(answer) === String(correctAnswer);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Spin size="large" tip="Loading trainings..." />
      </div>
    );
  }

  return (
    <div className="p-4 training-ui">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold mb-0">Test Responses</h2>
          <Text type="secondary" className="text-xs">
            View detailed pre-test and post-test responses by training.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/training/manage')}>
            Back
          </Button>
          <Button
            icon={<SyncOutlined spin={refreshing} />}
            onClick={() => fetchTrainings(true)}
            loading={refreshing}
            size="middle"
          >
            Refresh
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
          <div className="flex items-center gap-2 flex-1">
            <Text className="text-xs text-slate-500 whitespace-nowrap">Training:</Text>
            <Select
              placeholder="Select training"
              value={selectedTraining}
              onChange={handleTrainingSelect}
              className="flex-1 lg:max-w-sm"
              size="middle"
              allowClear
            >
              {trainings.map((item) => (
                <Select.Option key={item.id} value={item.id}>
                  {item.title}
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
            {selectedTrainingTitle && (
              <div className="mb-3">
                <Text className="text-xs text-slate-500">Selected Training</Text>
                <div className="font-medium text-slate-800 text-sm">{selectedTrainingTitle}</div>
              </div>
            )}

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
                pagination={{ pageSize: 10, showSizeChanger: true, size: 'small' }}
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
              description="Choose a training to view detailed test responses."
            />
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(previewResponse)}
        onCancel={() => setPreviewResponse(null)}
        footer={null}
        width={700}
        centered
        closable={false}
        styles={{
          body: { padding: 0 },
          content: { borderRadius: 12 },
        }}
      >
        {previewResponse && (
          <>
            <div className="bg-white px-5 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg border-2 border-blue-600 flex items-center justify-center shrink-0">
                    <FileTextOutlined className="text-blue-600 text-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-800 mb-0.5 truncate">
                      {previewResponse.user?.name || 'Unknown'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>{previewResponse.user?.email || '-'}</span>
                      {previewResponse.score !== null && previewResponse.score !== undefined && (
                        <>
                          <span>•</span>
                          <Tag
                            color={previewResponse.passed ? 'green' : 'red'}
                            className="text-xs m-0"
                          >
                            Score: {previewResponse.score}%
                          </Tag>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<span className="text-xl text-slate-400 hover:text-slate-600">&times;</span>}
                  onClick={() => setPreviewResponse(null)}
                  className="hover:bg-slate-100 shrink-0"
                />
              </div>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg text-xs mb-4">
                <div>
                  <span className="text-slate-500">Institution:</span>
                  <div className="font-medium text-slate-800">
                    {previewResponse.user?.Institution?.name || 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Training:</span>
                  <div className="font-medium text-slate-800">
                    {selectedTrainingTitle || previewResponse.training?.title || 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Submitted:</span>
                  <div className="font-medium text-slate-800">
                    {previewResponse.submittedAt
                      ? new Date(previewResponse.submittedAt).toLocaleString()
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Type:</span>
                  <div className="font-medium text-slate-800">
                    {activeTab === 'preTest' ? 'Pre-Test' : 'Post-Test'}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Responses</h4>
                <div className="space-y-3">
                  {previewQuestionRows.map((row, index) => {
                    const correctness = isAnswerCorrect(row.answer, row.correctAnswer);

                    return (
                      <div
                        key={row.id || index}
                        className="p-3 bg-white border border-slate-200 rounded-lg"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            Q{index + 1}
                          </span>
                          <span className="text-sm text-slate-700 flex-1">{row.label}</span>
                        </div>
                        <div className="ml-6">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-500">Answer:</span>
                            <span className="text-sm font-medium text-slate-800">
                              {renderAnswerValue(row.answer)}
                            </span>
                            {correctness !== null && (
                              <Tag
                                color={correctness ? 'green' : 'red'}
                                className="text-[10px] m-0"
                              >
                                {correctness ? 'Correct' : 'Wrong'}
                              </Tag>
                            )}
                          </div>
                          {correctness === false && (
                            <div className="mt-1 text-xs text-slate-500">
                              Correct answer:{' '}
                              <span className="text-green-600 font-medium">
                                {renderAnswerValue(row.correctAnswer)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default TestResponsesPage;
