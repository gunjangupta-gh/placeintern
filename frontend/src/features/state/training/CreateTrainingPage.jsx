import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Form, message, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import TrainingForm from './components/training/TrainingForm';
import { createStateTraining, fetchStateFeedbackForms } from '../store/stateTrainingSlice';

const { Text } = Typography;

const STEP_LABELS = ['Basic Information', 'Schedule & Details', 'Capacity & Audience', 'Settings'];

const CreateTrainingPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const { feedbackForms } = useSelector((state) => state.stateTraining);

  useEffect(() => {
    dispatch(fetchStateFeedbackForms());
  }, [dispatch]);

  const handleSubmit = async (values) => {
    try {
      await dispatch(createStateTraining(values)).unwrap();
      message.success('Training created');
      navigate('/app/training/manage');
    } catch (error) {
      message.error(error || 'Failed to create training');
    }
  };

  return (
    <div className="p-6 training-ui">
      <PageHeader
        icon={PlusOutlined}
        title={<span className="training-heading">Create Training</span>}
        description="Set up a new training session."
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
          submitText="Create Training"
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onCancel={() => navigate('/app/training/manage')}
        />
      </Card>
    </div>
  );
};

export default CreateTrainingPage;
