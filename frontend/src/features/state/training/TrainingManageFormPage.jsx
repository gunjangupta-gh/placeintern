import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Form, message, Spin, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import TrainingForm from './components/training/TrainingForm';
import {
  createStateTraining,
  updateStateTraining,
  fetchStateTrainingDetails,
  fetchStateFeedbackForms,
  fetchStatePreTestForms,
  fetchStatePostTestForms,
} from '../store/stateTrainingSlice';

const { Text } = Typography;

const STEP_LABELS = ['Basic Information', 'Schedule & Details', 'Capacity & Audience', 'Settings'];

const TrainingManageFormPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const { currentTraining, feedbackForms, preTestForms, postTestForms } = useSelector((state) => state.stateTraining);

  const isEdit = Boolean(id);

  useEffect(() => {
    if (isEdit) {
      dispatch(fetchStateTrainingDetails(id));
    }
    dispatch(fetchStateFeedbackForms());
    dispatch(fetchStatePreTestForms({ forceRefresh: true }));
    dispatch(fetchStatePostTestForms({ forceRefresh: true }));
  }, [dispatch, id, isEdit]);

  useEffect(() => {
    if (isEdit && currentTraining.data) {
      const training = currentTraining.data;

      // Extract branch IDs from targetBranches relation, or use empty with "All Branches" marker
      const targetBranchIds = Array.isArray(training.targetBranches) && training.targetBranches.length > 0
        ? training.targetBranches.map((branch) => branch.id)
        : ['__ALL_BRANCHES__'];

      // Handle targetDesignations - empty array means "All Designations"
      const targetDesignations = Array.isArray(training.targetDesignations) && training.targetDesignations.length > 0
        ? training.targetDesignations
        : ['__ALL_DESIGNATIONS__'];

      form.setFieldsValue({
        ...training,
        startDate: training.startDate ? dayjs(training.startDate) : null,
        endDate: training.endDate ? dayjs(training.endDate) : null,
        startTime: training.startTime ? dayjs(training.startTime) : null,
        endTime: training.endTime ? dayjs(training.endTime) : null,
        applicationDeadline: training.applicationDeadline ? dayjs(training.applicationDeadline) : null,
        preTestFormId: training.preTestFormId || training.preTestForm?.id || null,
        postTestFormId: training.postTestFormId || training.postTestForm?.id || null,
        learningOutcomes: Array.isArray(training.learningOutcomes)
          ? training.learningOutcomes.join('\n')
          : training.learningOutcomes,
        targetBranchIds,
        targetDesignations,
      });
    }
  }, [isEdit, currentTraining.data, form]);

  const handleSubmit = async (values) => {
    try {
      if (isEdit) {
        await dispatch(updateStateTraining({ id, data: values })).unwrap();
        message.success('Training updated');
      } else {
        await dispatch(createStateTraining(values)).unwrap();
        message.success('Training created');
      }
      navigate('/app/training/manage');
    } catch (error) {
      message.error(error || `Failed to ${isEdit ? 'update' : 'create'} training`);
    }
  };

  if (isEdit && currentTraining.loading) {
    return (
      <div className="p-4 training-ui flex justify-center items-center min-h-96">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-4 training-ui">
      <PageHeader
        icon={isEdit ? EditOutlined : PlusOutlined}
        title={<span className="training-heading text-lg">{isEdit ? 'Edit' : 'Create'} Training</span>}
        description={<span className="text-xs">{isEdit ? 'Update training details.' : 'Set up a new training session.'}</span>}
        extra={
          <Text type="secondary" className="text-[10px] uppercase font-semibold">
            Step {currentStep + 1} of {STEP_LABELS.length}: {STEP_LABELS[currentStep]}
          </Text>
        }
      />
      <Card className="rounded-xl border-border shadow-none bg-gradient-to-br from-slate-50 via-white to-blue-50" styles={{ body: { padding: '20px' } }}>
        <TrainingForm
          form={form}
          onSubmit={handleSubmit}
          feedbackForms={feedbackForms.list}
          preTestForms={preTestForms.list}
          postTestForms={postTestForms.list}
          submitText={isEdit ? 'Update Training' : 'Create Training'}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onCancel={() => navigate('/app/training/manage')}
        />
      </Card>
    </div>
  );
};

export default TrainingManageFormPage;
