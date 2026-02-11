import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Form, message, Spin, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import TrainingForm from './components/training/TrainingForm';
import {
  fetchStateTrainingDetails,
  updateStateTraining,
  fetchStateFeedbackForms,
} from '../store/stateTrainingSlice';

const { Text } = Typography;

const STEP_LABELS = ['Basic Information', 'Schedule & Details', 'Capacity & Audience', 'Settings'];

const EditTrainingPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const { currentTraining, feedbackForms } = useSelector((state) => state.stateTraining);

  useEffect(() => {
    if (id) {
      dispatch(fetchStateTrainingDetails(id));
    }
    dispatch(fetchStateFeedbackForms());
  }, [dispatch, id]);

  useEffect(() => {
    if (currentTraining.data) {
      const training = currentTraining.data;
      form.setFieldsValue({
        ...training,
        startDate: training.startDate ? dayjs(training.startDate) : null,
        endDate: training.endDate ? dayjs(training.endDate) : null,
        startTime: training.startTime ? dayjs(training.startTime) : null,
        endTime: training.endTime ? dayjs(training.endTime) : null,
        applicationDeadline: training.applicationDeadline ? dayjs(training.applicationDeadline) : null,
      });
    }
  }, [currentTraining.data, form]);

  const handleSubmit = async (values) => {
    try {
      await dispatch(updateStateTraining({ id, data: values })).unwrap();
      message.success('Training updated');
      navigate('/app/training/manage');
    } catch (error) {
      message.error(error || 'Failed to update training');
    }
  };

  if (currentTraining.loading) {
    return (
      <div className="p-6 training-ui flex justify-center items-center min-h-96">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-6 training-ui">
      <PageHeader
        icon={EditOutlined}
        title={<span className="training-heading">Edit Training</span>}
        description="Update training details."
        extra={
          <Text type="secondary" className="text-sm">
            Step {currentStep + 1} of {STEP_LABELS.length}: {STEP_LABELS[currentStep]}
          </Text>
        }
      />
      <Card className="rounded-2xl border-border shadow-none bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <TrainingForm
          form={form}
          onSubmit={handleSubmit}
          feedbackForms={feedbackForms.list}
          submitText="Update Training"
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onCancel={() => navigate('/app/training/manage')}
        />
      </Card>
    </div>
  );
};

export default EditTrainingPage;
