import React, { useEffect } from 'react';
import {
  Alert,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Typography,
  message,
} from 'antd';
import { BookOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

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
      // Pre-fill form if editing
      form.setFieldsValue({
        title: lessonPlan.title,
        subject: lessonPlan.subject,
        topic: lessonPlan.topic,
        duration: lessonPlan.duration,
        objectives: lessonPlan.objectives,
        materials: lessonPlan.materials,
        activities: lessonPlan.activities,
        assessment: lessonPlan.assessment,
        reflection: lessonPlan.reflection,
        implementationDate: lessonPlan.implementationDate ? dayjs(lessonPlan.implementationDate) : null,
      });
    } else if (!open) {
      form.resetFields();
    }
  }, [open, lessonPlan, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const payload = {
        ...values,
        trainingId: training.id,
        implementationDate: values.implementationDate?.toISOString(),
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
            name="subject"
            label="Subject"
            rules={[{ required: true, message: 'Please enter the subject' }]}
          >
            <Input placeholder="e.g., Computer Science" />
          </Form.Item>

          <Form.Item
            name="topic"
            label="Topic/Unit"
            rules={[{ required: true, message: 'Please enter the topic' }]}
          >
            <Input placeholder="e.g., Python Basics" />
          </Form.Item>

          <Form.Item
            name="duration"
            label="Duration (minutes)"
            rules={[{ required: true, message: 'Please enter duration' }]}
          >
            <InputNumber min={15} max={300} className="w-full" placeholder="60" />
          </Form.Item>

          <Form.Item
            name="implementationDate"
            label="Implementation Date"
          >
            <DatePicker className="w-full" format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            name="objectives"
            label="Learning Objectives"
            rules={[{ required: true, message: 'Please enter learning objectives' }]}
          >
            <TextArea
              rows={3}
              placeholder="List the key learning objectives for this lesson..."
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <Form.Item
            name="materials"
            label="Materials & Resources"
          >
            <TextArea
              rows={2}
              placeholder="List materials, tools, and resources needed..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item
            name="activities"
            label="Teaching Activities"
            rules={[{ required: true, message: 'Please describe teaching activities' }]}
          >
            <TextArea
              rows={4}
              placeholder="Describe the teaching activities and methodology applied from the training..."
              showCount
              maxLength={2000}
            />
          </Form.Item>

          <Form.Item
            name="assessment"
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
            name="reflection"
            label="Reflection & Application"
          >
            <TextArea
              rows={3}
              placeholder="How did you apply concepts from the training? What worked well?"
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
