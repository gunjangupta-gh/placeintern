import React, { useEffect } from 'react';
import {
  Alert,
  Form,
  Input,
  Modal,
  Select,
  Typography,
  message,
} from 'antd';
import { BookOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;

const LessonPlanModal = ({
  open,
  onCancel,
  onSubmit,
  loading,
  training,
  lessonPlan,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && lessonPlan) {
      // Pre-fill form if editing — map to DTO-compatible field names
      form.setFieldsValue({
        title: lessonPlan.title,
        courseOrSemester: lessonPlan.courseOrSemester,
        connectionToTraining: lessonPlan.connectionToTraining,
        learningObjectives: lessonPlan.learningObjectives || [],
        newSkillsTechnologies: lessonPlan.newSkillsTechnologies,
        deliveryMethods: lessonPlan.deliveryMethods,
        handsOnActivities: lessonPlan.handsOnActivities,
        assessmentMethods: lessonPlan.assessmentMethods,
        resourceRequirements: lessonPlan.resourceRequirements,
        implementationTimeline: lessonPlan.implementationTimeline,
        expectedOutcomes: lessonPlan.expectedOutcomes,
      });
    } else if (!open) {
      form.resetFields();
    }
  }, [open, lessonPlan, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const payload = {
        trainingId: training.id,
        title: values.title,
        courseOrSemester: values.courseOrSemester,
        connectionToTraining: values.connectionToTraining,
        learningObjectives: values.learningObjectives || [],
        newSkillsTechnologies: values.newSkillsTechnologies,
        deliveryMethods: values.deliveryMethods,
        handsOnActivities: values.handsOnActivities,
        assessmentMethods: values.assessmentMethods,
        resourceRequirements: values.resourceRequirements,
        implementationTimeline: values.implementationTimeline,
        expectedOutcomes: values.expectedOutcomes,
      };

      await onSubmit(payload);
      form.resetFields();
    } catch (error) {
      if (error?.errorFields) {
        message.error('Please fill in all required fields');
      }
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <BookOutlined className="text-blue-700" />
          {lessonPlan ? 'Edit Lesson Plan' : 'Submit Lesson Plan'}
        </div>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText={lessonPlan ? 'Update' : 'Submit'}
      confirmLoading={loading}
      width={700}
      destroyOnClose
    >
      <div className="py-2">
        {training && (
          <Alert
            message={`Lesson Plan for: ${training.title}`}
            description="Demonstrate how you've applied the training concepts in your teaching practice."
            type="info"
            className="mb-4"
          />
        )}

        <Form layout="vertical" form={form}>
          <Form.Item
            name="title"
            label="Lesson Plan Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input placeholder="e.g., Introduction to Programming Concepts" />
          </Form.Item>

          <Form.Item
            name="courseOrSemester"
            label="Course / Semester"
          >
            <Input placeholder="e.g., Computer Science - Semester 3" />
          </Form.Item>

          <Form.Item
            name="connectionToTraining"
            label="Connection to Training"
            rules={[{ required: true, message: 'Please describe the connection to training' }]}
          >
            <TextArea
              rows={3}
              placeholder="How does the training connect to this lesson? What concepts are you applying?"
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <Form.Item
            name="learningObjectives"
            label="Learning Objectives"
            rules={[{ required: true, message: 'Please enter learning objectives' }]}
          >
            <Select
              mode="tags"
              tokenSeparators={[',']}
              placeholder="Add objectives (press Enter or comma to add)"
            />
          </Form.Item>

          <Form.Item
            name="newSkillsTechnologies"
            label="New Skills / Technologies"
          >
            <TextArea
              rows={2}
              placeholder="Describe new skills or technologies introduced..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item
            name="deliveryMethods"
            label="Delivery Methods"
          >
            <TextArea
              rows={2}
              placeholder="Describe the delivery methods used..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item
            name="handsOnActivities"
            label="Hands-on Activities"
            rules={[{ required: true, message: 'Please describe hands-on activities' }]}
          >
            <TextArea
              rows={3}
              placeholder="Describe the hands-on activities and methodology applied from the training..."
              showCount
              maxLength={2000}
            />
          </Form.Item>

          <Form.Item
            name="assessmentMethods"
            label="Assessment Methods"
          >
            <TextArea
              rows={2}
              placeholder="How will you assess student learning?"
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item
            name="resourceRequirements"
            label="Resource Requirements"
          >
            <TextArea
              rows={2}
              placeholder="List materials, tools, and resources needed..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item
            name="implementationTimeline"
            label="Implementation Timeline"
          >
            <Input placeholder="e.g., 2 weeks starting from August 2026" />
          </Form.Item>

          <Form.Item
            name="expectedOutcomes"
            label="Expected Outcomes & Reflection"
          >
            <TextArea
              rows={3}
              placeholder="What are the expected outcomes? How did you apply concepts from the training?"
              showCount
              maxLength={1000}
            />
          </Form.Item>
        </Form>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <Text className="text-xs text-blue-700">
            <strong>Note:</strong> Your lesson plan demonstrates the practical
            application of training concepts in your teaching practice.
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default LessonPlanModal;
