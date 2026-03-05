import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
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

const normalizeFeedbackDetails = (response) => {
  const payload = response?.data || response || {};

  const responses = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.responses)
      ? payload.responses
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  const submittedCount =
    payload?.stats?.submittedCount
    ?? new Set(
      responses
        .map((item) => item?.userId || item?.user?.id)
        .filter(Boolean),
    ).size;

  const enrolledCount = payload?.stats?.enrolledCount ?? submittedCount;
  const pendingCount = payload?.stats?.pendingCount ?? Math.max(enrolledCount - submittedCount, 0);
  const completionRate =
    payload?.stats?.completionRate
    ?? (enrolledCount > 0 ? Math.round((submittedCount / enrolledCount) * 100) : 0);

  return {
    ...(Array.isArray(payload) ? {} : payload),
    responses,
    stats: {
      ...(payload?.stats || {}),
      enrolledCount,
      submittedCount,
      pendingCount,
      completionRate,
    },
  };
};

const renderFeedbackAnswer = (question, value) => {
  if (value === null || value === undefined || value === '') {
    return <Text type="secondary">-</Text>;
  }

  if (Array.isArray(value)) {
    if (!value.length) return <Text type="secondary">-</Text>;
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, index) => (
          <Tag key={`${question?.id || 'q'}-${index}`} className="m-0 text-xs">
            {String(item)}
          </Tag>
        ))}
      </div>
    );
  }

  if (question?.type === 'rating' && typeof value === 'number') {
    const max = question?.options?.max || 5;
    const labels = Array.isArray(question?.options?.labels) ? question.options.labels : [];
    const label = labels[value - 1];
    return (
      <Text className="text-sm text-slate-800 font-medium">
        {value} / {max}{label ? ` (${label})` : ''}
      </Text>
    );
  }

  if (typeof value === 'object') {
    return <Text className="text-sm text-slate-700">{JSON.stringify(value)}</Text>;
  }

  return <Text className="text-sm text-slate-800">{String(value)}</Text>;
};

const FeedbackResponsesPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const trainingIdFromQuery = searchParams.get('trainingId');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trainings, setTrainings] = useState([]);
  const [selectedTraining, setSelectedTraining] = useState(trainingIdFromQuery || null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [previewResponse, setPreviewResponse] = useState(null);

  const fetchTrainings = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await trainingAdminService.getTrainings({ limit: 1000 });
      setTrainings(normalizeTrainings(response));
    } catch (error) {
      message.error('Failed to load trainings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchTrainingDetails = useCallback(async (trainingId) => {
    if (!trainingId) {
      setDetails(null);
      return;
    }

    try {
      setDetailsLoading(true);
      const response = await trainingAdminService.getTrainingFeedbackResponses(trainingId);
      setDetails(normalizeFeedbackDetails(response));
    } catch (error) {
      message.error('Failed to load feedback responses');
      setDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrainings();
  }, [fetchTrainings]);

  useEffect(() => {
    if (!trainingIdFromQuery) return;
    setSelectedTraining(trainingIdFromQuery);
    fetchTrainingDetails(trainingIdFromQuery);
  }, [trainingIdFromQuery, fetchTrainingDetails]);

  const handleTrainingSelect = (trainingId) => {
    setSelectedTraining(trainingId || null);
    if (trainingId) {
      setSearchParams({ trainingId });
      fetchTrainingDetails(trainingId);
    } else {
      setSearchParams({});
      setDetails(null);
    }
  };

  const selectedTrainingTitle = useMemo(
    () => trainings.find((item) => String(item.id) === String(selectedTraining))?.title,
    [trainings, selectedTraining],
  );

  const previewQuestionRows = useMemo(() => {
    if (!previewResponse) return [];

    const questions = Array.isArray(previewResponse.feedbackForm?.questions)
      ? previewResponse.feedbackForm.questions
      : [];
    const answers = previewResponse.responses || {};

    if (!questions.length) {
      return Object.entries(answers).map(([key, value]) => ({
        id: key,
        label: key,
        answer: renderFeedbackAnswer({}, value),
      }));
    }

    const mappedRows = questions.map((question, index) => ({
      id: question.id || `q-${index}`,
      label: question.question || question.id || `Question ${index + 1}`,
      answer: renderFeedbackAnswer(question, answers[question.id]),
    }));

    const questionIds = new Set(questions.map((question) => question.id).filter(Boolean));
    const extraRows = Object.entries(answers)
      .filter(([key]) => !questionIds.has(key))
      .map(([key, value], index) => ({
        id: `extra-${key || index}`,
        label: key || `Additional ${index + 1}`,
        answer: renderFeedbackAnswer({}, value),
      }));

    return [...mappedRows, ...extraRows];
  }, [previewResponse]);

  const responseColumns = [
    {
      title: 'Faculty',
      dataIndex: ['user', 'name'],
      key: 'faculty',
      render: (_, record) => (
        <div>
          <div className="font-medium text-sm text-slate-800">{record.user?.name}</div>
          <Text type="secondary" className="text-xs">
            {record.user?.Institution?.shortName || record.user?.Institution?.name || record.user?.email}
            {record.user?.branchName ? ` • ${record.user.branchName}` : ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Submitted',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 140,
      render: (value) => (
        <Text className="text-xs">
          {value
            ? new Date(value).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
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

  return (
    <div className="p-4 training-ui">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold mb-0">Feedback Responses</h2>
          <Text type="secondary" className="text-xs">
            Check detailed feedback submissions by training.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/training/manage')}>
            Back
          </Button>
          <Button
            icon={<ReloadOutlined spin={refreshing} />}
            loading={refreshing}
            onClick={() => fetchTrainings(true)}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
          <Text className="text-xs text-slate-500 whitespace-nowrap">Training:</Text>
          <Select
            placeholder="Select training"
            value={selectedTraining}
            onChange={handleTrainingSelect}
            className="flex-1 lg:max-w-sm"
            allowClear
            size="middle"
          >
            {trainings.map((item) => (
              <Select.Option key={item.id} value={item.id}>
                {item.title}
              </Select.Option>
            ))}
          </Select>
        </div>

        {selectedTraining ? (
          <Spin spinning={detailsLoading}>
            {selectedTrainingTitle && (
              <div className="mb-3">
                <Text className="text-xs text-slate-500">Selected Training</Text>
                <div className="font-medium text-slate-800 text-sm">{selectedTrainingTitle}</div>
              </div>
            )}

            <Row gutter={[12, 12]} className="mb-4">
              <Col xs={12} sm={6}>
                <div className="bg-slate-50 rounded-lg p-3">
                  <Text className="text-xs text-slate-500">Enrolled</Text>
                  <div className="text-lg font-semibold text-slate-800">{details?.stats?.enrolledCount || 0}</div>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div className="bg-blue-50 rounded-lg p-3">
                  <Text className="text-xs text-slate-500">Submitted</Text>
                  <div className="text-lg font-semibold text-blue-600">{details?.stats?.submittedCount || 0}</div>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div className="bg-orange-50 rounded-lg p-3">
                  <Text className="text-xs text-slate-500">Pending</Text>
                  <div className="text-lg font-semibold text-orange-600">{details?.stats?.pendingCount || 0}</div>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div className="bg-green-50 rounded-lg p-3">
                  <Text className="text-xs text-slate-500">Completion</Text>
                  <div className="text-lg font-semibold text-green-600">{details?.stats?.completionRate || 0}%</div>
                </div>
              </Col>
            </Row>

            <Table
              className="custom-table"
              dataSource={details?.responses || []}
              columns={responseColumns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: true, size: 'small' }}
              scroll={{ x: 'max-content' }}
              locale={{
                emptyText: (
                  <TrainingEmptyState
                    type="search"
                    message="No responses for selected training"
                    description="No faculty feedback response is available for this training."
                  />
                ),
              }}
            />
          </Spin>
        ) : (
          <TrainingEmptyState
            type="search"
            message="Select a training"
            description="Choose a training to inspect individual feedback responses."
          />
        )}
      </Card>

      <Modal
        open={Boolean(previewResponse)}
        onCancel={() => setPreviewResponse(null)}
        footer={null}
        width={760}
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
                      {previewResponse.user?.name || '-'}
                    </h3>
                    <Text type="secondary" className="text-xs block truncate">
                      {previewResponse.user?.Institution?.shortName || previewResponse.user?.Institution?.name || '-'}
                      {previewResponse.user?.branchName ? ` • ${previewResponse.user.branchName}` : ''}
                    </Text>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <Text className="text-xs text-slate-500 block">Faculty</Text>
                  <div className="font-medium text-slate-800">{previewResponse.user?.name || '-'}</div>
                  <Text type="secondary" className="text-xs">
                    {previewResponse.user?.Institution?.shortName || previewResponse.user?.Institution?.name || '-'}
                    {previewResponse.user?.branchName ? ` • ${previewResponse.user.branchName}` : ''}
                  </Text>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <Text className="text-xs text-slate-500 block">Submitted At</Text>
                  <div className="font-medium text-slate-800">
                    {previewResponse.submittedAt
                      ? new Date(previewResponse.submittedAt).toLocaleString()
                      : '-'}
                  </div>
                  <Text type="secondary" className="text-xs">
                    {previewResponse.feedbackForm?.title || 'Feedback Form'}
                  </Text>
                </div>
              </div>

              <div className="space-y-2 pr-1">
                {previewQuestionRows.map((row, index) => (
                  <div key={row.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <Text className="text-xs text-slate-500 block mb-1">Q{index + 1}</Text>
                    <Text className="text-sm text-slate-800 block mb-1">{row.label}</Text>
                    <div>{row.answer}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default FeedbackResponsesPage;
