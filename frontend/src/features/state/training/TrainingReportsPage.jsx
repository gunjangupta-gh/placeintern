import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Form, Input, Button, Typography } from 'antd';
import PageHeader from '../../../components/PageHeader';
import { fetchStateAttendanceReport } from '../store/stateTrainingSlice';

const { Paragraph } = Typography;

const TrainingReportsPage = () => {
  const dispatch = useDispatch();
  const { reports } = useSelector((state) => state.stateTraining);
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStateAttendanceReport());
  }, [dispatch]);

  const handleSearch = async () => {
    const values = await form.validateFields();
    dispatch(fetchStateAttendanceReport(values));
  };

  return (
    <div className="p-6 training-ui">
      <PageHeader
        title={<span className="training-heading">Training Reports</span>}
        description="Generate statewide training reports."
      />

      <Card className="rounded-2xl border-border shadow-none mb-6" title="Attendance Report Filters">
        <Form layout="inline" form={form}>
          <Form.Item name="trainingId" label="Training ID">
            <Input placeholder="Training ID" />
          </Form.Item>
          <Form.Item name="institutionId" label="Institution ID">
            <Input placeholder="Institution ID" />
          </Form.Item>
          <Button type="primary" onClick={handleSearch}>Generate</Button>
        </Form>
      </Card>

      <Card className="rounded-2xl border-border shadow-none" title="Attendance Report">
        <Paragraph>
          {reports.attendance ? (
            <pre className="text-xs bg-slate-50 rounded-lg p-4 overflow-auto">
              {JSON.stringify(reports.attendance, null, 2)}
            </pre>
          ) : (
            'No report data yet.'
          )}
        </Paragraph>
      </Card>
    </div>
  );
};

export default TrainingReportsPage;
