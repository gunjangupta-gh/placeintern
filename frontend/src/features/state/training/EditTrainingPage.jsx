import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Form, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import TrainingForm from './components/training/TrainingForm';
import {
  fetchStateTrainingDetails,
  updateStateTraining,
  fetchStateFeedbackForms,
} from '../store/stateTrainingSlice';

const EditTrainingPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
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

  return (
    <div className="p-6 training-ui">
      <PageHeader
        title={<span className="training-heading">Edit Training</span>}
        description="Update training details."
      />
      <Card className="rounded-2xl border-border shadow-none bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <TrainingForm
          form={form}
          onSubmit={handleSubmit}
          feedbackForms={feedbackForms.list}
          submitText="Update Training"
        />
      </Card>
    </div>
  );
};

export default EditTrainingPage;
