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
import { BellOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import trainingCoordinatorService from '../../../services/training-coordinator.service';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';

const { Text, Paragraph } = Typography;

const normalizeApiResponse = (response) => response?.data || response || {};

const FeedbackResponsesPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const trainingIdFromQuery = searchParams.get('trainingId');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState(trainingIdFromQuery || null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [previewResponse, setPreviewResponse] = useState(null);

  const fetchSummary = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await trainingCoordinatorService.getFeedbackSummary();
      setSummary(normalizeApiResponse(response));
    } catch (error) {
      message.error('Failed to load feedback summary');
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
      const response = await trainingCoordinatorService.getTrainingFeedbackResponses(trainingId);
      setDetails(normalizeApiResponse(response));
    } catch (error) {
      message.error('Failed to load feedback responses');
      setDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (!trainingIdFromQuery) return;
    setSelectedTraining(trainingIdFromQuery);
    fetchTrainingDetails(trainingIdFromQuery);
  }, [trainingIdFromQuery, fetchTrainingDetails]);

  const trainings = useMemo(() => summary?.byTraining || [], [summary?.byTraining]);

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

  const summaryColumns = [
    {
      title: 'Training',
      dataIndex: 'trainingTitle',
      key: 'trainingTitle',
      render: (value) => <div className="font-medium text-sm text-slate-800">{value}</div>,
    },
    {
      title: 'Responses',
      dataIndex: 'count',
      key: 'count',
      width: 110,
      render: (value) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" onClick={() => handleTrainingSelect(record.trainingId)}>
            View
          </Button>
          <Button
            size="small"
            icon={<BellOutlined />}
            onClick={() =>
              navigate(`/app/coordinator/reminders?trainingId=${record.trainingId}&actionType=feedback`)
            }
          >
            Remind
          </Button>
        </Space>
      ),
    },
  ];

  const responseColumns = [
    {
      title: 'Faculty',
      dataIndex: ['user', 'name'],
      key: 'faculty',
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
            Check feedback submissions by training and send reminders for pending responses.
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined spin={refreshing} />}
          loading={refreshing}
          onClick={() => fetchSummary(true)}
        >
          Refresh
        </Button>
      </div>

      <Card className="rounded-xl border-border shadow-none mb-4" styles={{ body: { padding: '12px' } }}>
        <div className="mb-2 pb-2 border-b border-slate-200">
          <Text className="text-xs font-medium text-slate-700">Feedback Summary by Training</Text>
        </div>
        <Table
          className="custom-table"
          loading={loading}
          dataSource={trainings}
          columns={summaryColumns}
          rowKey="trainingId"
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: (
              <TrainingEmptyState
                type="search"
                message="No feedback responses found"
                description="No feedback has been submitted yet for your branch trainings."
              />
            ),
          }}
        />
      </Card>

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
              <Select.Option key={item.trainingId} value={item.trainingId}>
                {item.trainingTitle}
              </Select.Option>
            ))}
          </Select>
          {selectedTraining && (
            <Button
              icon={<BellOutlined />}
              onClick={() =>
                navigate(`/app/coordinator/reminders?trainingId=${selectedTraining}&actionType=feedback`)
              }
            >
              Send Reminder
            </Button>
          )}
        </div>

        {selectedTraining ? (
          <Spin spinning={detailsLoading}>
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
        title="Feedback Response"
        open={Boolean(previewResponse)}
        onCancel={() => setPreviewResponse(null)}
        footer={null}
        width={760}
      >
        {previewResponse && (
          <div className="space-y-3">
            <div>
              <Text className="text-xs text-slate-500">Faculty</Text>
              <div className="font-medium text-slate-800">{previewResponse.user?.name}</div>
            </div>
            <div>
              <Text className="text-xs text-slate-500">Submitted At</Text>
              <div className="font-medium text-slate-800">
                {previewResponse.submittedAt
                  ? new Date(previewResponse.submittedAt).toLocaleString()
                  : '-'}
              </div>
            </div>
            <div>
              <Text className="text-xs text-slate-500">Response Payload</Text>
              <Paragraph className="mt-1 mb-0">
                <pre className="text-xs bg-slate-50 p-3 rounded-lg overflow-x-auto">
                  {JSON.stringify(previewResponse.responses || {}, null, 2)}
                </pre>
              </Paragraph>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FeedbackResponsesPage;
