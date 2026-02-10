import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Form, Input, Button, Typography } from 'antd';
import PageHeader from '../../../components/PageHeader';
import { fetchStateFeedbackStats } from '../store/stateTrainingSlice';

const { Paragraph, Text } = Typography;

const FeedbackAnalyticsPage = () => {
  const dispatch = useDispatch();
  const { feedbackStats } = useSelector((state) => state.stateTraining);
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStateFeedbackStats());
  }, [dispatch]);

  const handleSearch = async () => {
    const values = await form.validateFields();
    dispatch(fetchStateFeedbackStats({ trainingId: values.trainingId || undefined }));
  };

  return (
    <div className="p-6 training-ui">
      <PageHeader
        title={<span className="training-heading">Feedback Analytics</span>}
        description="Analyze training feedback responses."
      />

      <Card className="rounded-2xl border-border shadow-none mb-6" title="Filters">
        <Form layout="inline" form={form}>
          <Form.Item name="trainingId" label="Training ID">
            <Input placeholder="Training ID" />
          </Form.Item>
          <Button type="primary" onClick={handleSearch}>Apply</Button>
        </Form>
      </Card>

      <Card className="rounded-2xl border-border shadow-none" title="Summary">
        {feedbackStats.loading ? (
          <Text type="secondary">Loading...</Text>
        ) : (
          <Paragraph>
            {feedbackStats.data ? (
              <pre className="text-xs bg-slate-50 rounded-lg p-4 overflow-auto">
                {JSON.stringify(feedbackStats.data, null, 2)}
              </pre>
            ) : (
              'No data yet.'
            )}
          </Paragraph>
        )}
      </Card>
    </div>
  );
};

export default FeedbackAnalyticsPage;
