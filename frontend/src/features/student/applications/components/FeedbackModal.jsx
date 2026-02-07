import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Alert,
  Row,
  Col,
} from 'antd';
import { TrophyOutlined, SendOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

const FeedbackModal = ({
  visible,
  onCancel,
  onSubmit,
  loading,
  form,
  existingFeedback,
}) => {
  const handleFinish = (values) => {
    onSubmit(values);
  };

  return (
    <Modal
      title={
        <div className="flex items-center text-green-700">
          <TrophyOutlined className="mr-2" />
          Submit Your Feedback
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={700}
      className="rounded-2xl"
    >
      <div className="mt-6">
        <Alert
          title="Share Your Experience"
          description="Your feedback helps us improve the internship program and assists future students in making informed decisions."
          type="info"
          showIcon
          className="mb-6"
        />

        {existingFeedback?.studentFeedback ? (
          <div className="bg-green-50 p-4 rounded-lg mb-6">
            <p className="text-green-700 font-medium mb-2">
              You have already submitted your feedback
            </p>
            <div className="space-y-2">
              <p>
                <strong>Rating:</strong> {existingFeedback.studentRating}/5
              </p>
              <p>
                <strong>Feedback:</strong> {existingFeedback.studentFeedback}
              </p>
              {existingFeedback.skillsLearned && (
                <p>
                  <strong>Skills Learned:</strong> {existingFeedback.skillsLearned}
                </p>
              )}
            </div>
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="studentRating"
                  label="Overall Rating"
                  rules={[{ required: true, message: 'Please provide a rating' }]}
                >
                  <Select placeholder="Select rating (1-5)">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Option key={value} value={value}>
                        <div className="flex items-center justify-between">
                          <span>
                            {value === 5
                              ? 'Outstanding'
                              : value === 4
                              ? 'Good'
                              : value === 3
                              ? 'Satisfactory'
                              : value === 2
                              ? 'Needs Improvement'
                              : 'Unsatisfactory'}
                          </span>
                          <div className="flex">
                            {Array.from({ length: 5 }, (_, i) => (
                              <span
                                key={i}
                                className={`text-sm ${
                                  i < value ? 'text-yellow-400' : 'text-gray-300'
                                }`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="wouldRecommend"
                  label="Would you recommend?"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="Yes" unCheckedChildren="No" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="studentFeedback"
              label="Your Feedback"
              rules={[{ required: true, message: 'Please provide your feedback' }]}
            >
              <TextArea
                rows={4}
                placeholder="Share your overall experience, what you liked, challenges faced, and suggestions..."
                maxLength={1000}
                showCount
              />
            </Form.Item>

            <Form.Item name="skillsLearned" label="Skills Learned">
              <TextArea
                rows={3}
                placeholder="What new skills did you acquire during this internship?"
                maxLength={500}
                showCount
              />
            </Form.Item>

            <Form.Item name="careerImpact" label="Career Impact">
              <TextArea
                rows={3}
                placeholder="How has this internship impacted your career goals?"
                maxLength={500}
                showCount
              />
            </Form.Item>

            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Button onClick={onCancel}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SendOutlined />}
                className="bg-green-600 border-0"
              >
                Submit Feedback
              </Button>
            </div>
          </Form>
        )}
      </div>
    </Modal>
  );
};

export default FeedbackModal;
