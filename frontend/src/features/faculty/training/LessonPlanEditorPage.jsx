import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Form, Input, Row, Select, Space, Timeline, Typography, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import {
  createLessonPlan,
  fetchLessonPlanById,
  updateLessonPlan,
  submitLessonPlan,
} from '../store/facultyTrainingSlice';
import { fetchMyTrainings } from '../store/facultyTrainingSlice';

const { Text, Title } = Typography;

const LessonPlanEditorPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id, trainingId } = useParams();
  const [form] = Form.useForm();

  const { lessonPlans, myTrainings } = useSelector((state) => state.facultyTraining);

  useEffect(() => {
    dispatch(fetchMyTrainings());
    if (id) {
      dispatch(fetchLessonPlanById(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (lessonPlans.current) {
      form.setFieldsValue(lessonPlans.current);
    } else if (trainingId) {
      form.setFieldsValue({ trainingId });
    }
  }, [lessonPlans.current, trainingId, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (id) {
        await dispatch(updateLessonPlan({ id, data: values })).unwrap();
        message.success('Lesson plan updated');
      } else {
        await dispatch(createLessonPlan(values)).unwrap();
        message.success('Lesson plan created');
      }
      navigate('/app/training/lesson-plans');
    } catch (error) {
      message.error(error || 'Failed to save lesson plan');
    }
  };

  const handleSubmit = async () => {
    if (!id) {
      message.warning('Save the lesson plan before submitting');
      return;
    }

    try {
      await dispatch(submitLessonPlan(id)).unwrap();
      message.success('Lesson plan submitted');
      navigate('/app/training/lesson-plans');
    } catch (error) {
      message.error(error || 'Failed to submit lesson plan');
    }
  };

  const trainingOptions = (myTrainings.list || []).map((training) => ({
    value: training.id,
    label: training.title,
  }));

  return (
    <div className="p-6 training-ui">
      <PageHeader
        title={<span className="training-heading">{id ? 'Edit Lesson Plan' : 'Create Lesson Plan'}</span>}
        description="Document how training insights translate into classroom practice."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card className="rounded-2xl border-border shadow-none">
            <Form layout="vertical" form={form}>
              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="trainingId"
                    label="Training"
                    rules={[{ required: true, message: 'Please select a training' }]}
                  >
                    <Select options={trainingOptions} placeholder="Select training" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="courseOrSemester" label="Course or Semester">
                    <Input placeholder="Course or semester" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="title"
                label="Lesson Plan Title"
                rules={[{ required: true, message: 'Please enter a title' }]}
              >
                <Input placeholder="Lesson plan title" />
              </Form.Item>

              <Form.Item name="connectionToTraining" label="Connection to Training">
                <Input.TextArea rows={3} placeholder="How does the training connect?" />
              </Form.Item>

              <Form.Item name="learningObjectives" label="Learning Objectives">
                <Select mode="tags" tokenSeparators={[',']} placeholder="Add objectives" />
              </Form.Item>

              <Form.Item name="newSkillsTechnologies" label="New Skills or Technologies">
                <Input.TextArea rows={3} placeholder="Describe new skills" />
              </Form.Item>

              <Form.Item name="deliveryMethods" label="Delivery Methods">
                <Input.TextArea rows={3} placeholder="Describe delivery methods" />
              </Form.Item>

              <Form.Item name="handsOnActivities" label="Hands-on Activities">
                <Input.TextArea rows={3} placeholder="Describe activities" />
              </Form.Item>

              <Form.Item name="assessmentMethods" label="Assessment Methods">
                <Input.TextArea rows={3} placeholder="Describe assessment methods" />
              </Form.Item>

              <Form.Item name="industryConnections" label="Industry Connections">
                <Input.TextArea rows={3} placeholder="Describe industry connections" />
              </Form.Item>

              <Form.Item name="resourceRequirements" label="Resource Requirements">
                <Input.TextArea rows={3} placeholder="Resources needed" />
              </Form.Item>

              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Form.Item name="implementationTimeline" label="Implementation Timeline">
                    <Input placeholder="Timeline" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="expectedOutcomes" label="Expected Outcomes">
                    <Input.TextArea rows={2} placeholder="Expected outcomes" />
                  </Form.Item>
                </Col>
              </Row>

              <Space>
                <Button type="primary" onClick={handleSave}>Save</Button>
                <Button onClick={handleSubmit} disabled={!id}>Submit for Review</Button>
                <Button onClick={() => navigate('/app/training/lesson-plans')}>Cancel</Button>
              </Space>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="rounded-2xl border-border shadow-none bg-gradient-to-br from-slate-50 via-white to-blue-50">
            <Title level={4} className="training-heading">Plan Guidance</Title>
            <Text type="secondary" className="text-sm">
              Build a concise lesson plan that shows how training insights change your classroom practice.
            </Text>
            <Timeline
              className="mt-4"
              items={[
                { children: 'Select the training you attended and set the course or semester.' },
                { children: 'Define learning objectives and hands-on activities.' },
                { children: 'Add assessment methods and expected outcomes.' },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default LessonPlanEditorPage;
