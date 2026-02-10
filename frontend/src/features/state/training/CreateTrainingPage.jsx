import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Form, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import TrainingForm from './components/training/TrainingForm';
import { createStateTraining, fetchStateFeedbackForms } from '../store/stateTrainingSlice';

const CreateTrainingPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form] = Form.useForm();
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
        title={<span className="training-heading">Create Training</span>}
        description="Set up a new training session."
      />
      <Card className="rounded-2xl border-border shadow-none bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <TrainingForm
          form={form}
          onSubmit={handleSubmit}
          feedbackForms={feedbackForms.list}
          submitText="Create Training"
        />
      </Card>
    </div>
  );
};

export default CreateTrainingPage;
