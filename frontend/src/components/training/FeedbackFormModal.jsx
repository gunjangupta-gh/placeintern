import React, { useEffect } from 'react';
import {
  Alert,
  Checkbox,
  Form,
  Input,
  Modal,
  Radio,
  Rate,
  Space,
  Typography,
  message,
} from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

const { Text } = Typography;

const FeedbackFormModal = ({
  open,
  onCancel,
  onSubmit,
  loading,
  training,
  feedbackForm,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // Format responses for backend
      const responses = {};
      feedbackForm?.questions?.forEach((question) => {
        if (values[question.id] !== undefined) {
          responses[question.id] = values[question.id];
        }
      });

      const payload = {
        feedbackFormId: feedbackForm.id,
        trainingId: training.id,
        responses,
      };

      await onSubmit(payload);
      form.resetFields();
    } catch (error) {
      if (error?.errorFields) {
        message.error('Please fill in all required fields');
      }
    }
  };

  const renderFormField = (question) => {
    switch (question.type) {
      case 'rating':
        return <Rate count={question.options?.max || 5} />;
      
      case 'text':
        return (
          <Input.TextArea
            rows={question.options?.rows || 4}
            placeholder={question.options?.placeholder || 'Enter your response...'}
            maxLength={question.options?.maxLength || 500}
            showCount
          />
        );
      
      case 'multiChoice':
        return (
          <Radio.Group>
            <Space direction="vertical">
              {question.options?.choices?.map((choice, idx) => (
                <Radio key={idx} value={choice}>
                  {choice}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        );
      
      case 'checkbox':
        return (
          <Checkbox.Group>
            <Space direction="vertical">
              {question.options?.choices?.map((choice, idx) => (
                <Checkbox key={idx} value={choice}>
                  {choice}
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        );
      
      case 'yesNo':
        return (
          <Radio.Group>
            <Radio value={true}>Yes</Radio>
            <Radio value={false}>No</Radio>
          </Radio.Group>
        );
      
      default:
        return <Input placeholder="Enter your response..." />;
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-blue-700" />
          {feedbackForm?.title || "Submit Training Feedback"}
        </div>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText="Submit Feedback"
      confirmLoading={loading}
      width={600}
      destroyOnClose
    >
      <div className="py-2">
        {training && (
          <Alert
            message={training.title}
            description={feedbackForm?.description || "Share your experience to help us improve future training programs."}
            type="info"
            className="mb-4"
          />
        )}

        {!feedbackForm ? (
          <Alert
            message="No feedback form available"
            description="This training does not have a feedback form configured."
            type="warning"
          />
        ) : (
          <Form layout="vertical" form={form}>
            {feedbackForm.questions?.map((question) => (
              <Form.Item
                key={question.id}
                name={question.id}
                label={question.question}
                rules={[
                  {
                    required: question.required,
                    message: `Please provide an answer for: ${question.question}`,
                  },
                ]}
              >
                {renderFormField(question)}
              </Form.Item>
            ))}
          </Form>
        )}

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <Text className="text-xs text-blue-700">
            <strong>Note:</strong> Your honest feedback helps us improve the
            quality of our training programs.
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default FeedbackFormModal;
