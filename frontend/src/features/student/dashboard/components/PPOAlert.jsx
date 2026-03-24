import React, { useState, useEffect } from 'react';
import { Alert, Button, Modal, Radio, Input, Form, Space, Typography, Result } from 'antd';
import { GiftOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import studentService from '../../../../services/student.service';

const { Text, Title } = Typography;

const PPOAlert = () => {
  const [ppoStatus, setPpoStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form] = Form.useForm();
  const [receivedPPO, setReceivedPPO] = useState(null);

  useEffect(() => {
    fetchPPOStatus();
  }, []);

  const fetchPPOStatus = async () => {
    try {
      setLoading(true);
      const data = await studentService.getPPOStatus();
      setPpoStatus(data);
    } catch (error) {
      console.error('Failed to fetch PPO status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      const response = await studentService.submitPPOStatus({
        received: values.received,
        companyName: values.received ? values.companyName : undefined,
      });

      setPpoStatus(response.data);
      setSubmitted(true);
      toast.success(response.message);

      // Close modal after showing success for 2 seconds
      setTimeout(() => {
        setModalVisible(false);
        setSubmitted(false);
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit PPO status');
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = () => {
    form.resetFields();
    setReceivedPPO(ppoStatus?.received ?? null);
    if (ppoStatus?.hasMarked) {
      form.setFieldsValue({
        received: ppoStatus.received,
        companyName: ppoStatus.companyName || '',
      });
    }
    setSubmitted(false);
    setModalVisible(true);
  };

  // Don't show anything while loading
  if (loading) return null;

  // If already marked, show a subtle success/info message that can be updated
  if (ppoStatus?.hasMarked) {
    return (
      <Alert
        className="mb-4 rounded-xl"
        type={ppoStatus.received ? 'success' : 'info'}
        showIcon
        icon={ppoStatus.received ? <GiftOutlined /> : <CheckCircleOutlined />}
        message={
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span>
              {ppoStatus.received
                ? `Pre-Placement Offer received${ppoStatus.companyName ? ` from ${ppoStatus.companyName}` : ''}`
                : 'No Pre-Placement Offer received'
              }
            </span>
            <Button
              size="small"
              type="link"
              onClick={openModal}
            >
              Update
            </Button>
          </div>
        }
      />
    );
  }

  // Show prominent alert to mark PPO status
  return (
    <>
      <Alert
        className="mb-4 rounded-xl cursor-pointer hover:shadow-md transition-shadow"
        type="warning"
        showIcon
        icon={<GiftOutlined className="text-lg" />}
        message={
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <Text strong>Have you received a Pre-Placement Offer (PPO)?</Text>
              <Text type="secondary" className="block text-xs mt-0.5">
                Let us know if you've received an offer from your internship company
              </Text>
            </div>
            <Button
              type="primary"
              size="small"
              onClick={openModal}
              className="rounded-lg"
            >
              Mark Now
            </Button>
          </div>
        }
      />

      <Modal
        title={
          <div className="flex items-center gap-2">
            <GiftOutlined className="text-primary" />
            <span>Pre-Placement Offer Status</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={480}
        centered
        destroyOnClose
      >
        {submitted ? (
          <Result
            status="success"
            title={receivedPPO ? "Congratulations!" : "Status Recorded"}
            subTitle={
              receivedPPO
                ? "Your PPO status has been recorded. Best wishes for your career!"
                : "Thank you for updating your placement status."
            }
          />
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ received: null }}
          >
            <Form.Item
              name="received"
              label="Have you received a Pre-Placement Offer?"
              rules={[{ required: true, message: 'Please select an option' }]}
            >
              <Radio.Group
                onChange={(e) => setReceivedPPO(e.target.value)}
                className="w-full"
              >
                <Space direction="vertical" className="w-full">
                  <Radio.Button
                    value={true}
                    className="w-full h-auto py-3 px-4 rounded-lg text-left"
                    style={{ display: 'block' }}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircleOutlined className="text-green-500" />
                      <div>
                        <Text strong>Yes, I received a PPO</Text>
                        <Text type="secondary" className="block text-xs">
                          I have been offered a job by my internship company
                        </Text>
                      </div>
                    </div>
                  </Radio.Button>
                  <Radio.Button
                    value={false}
                    className="w-full h-auto py-3 px-4 rounded-lg text-left"
                    style={{ display: 'block' }}
                  >
                    <div className="flex items-center gap-2">
                      <CloseCircleOutlined className="text-gray-400" />
                      <div>
                        <Text strong>No, I did not receive a PPO</Text>
                        <Text type="secondary" className="block text-xs">
                          No job offer from the internship company
                        </Text>
                      </div>
                    </div>
                  </Radio.Button>
                </Space>
              </Radio.Group>
            </Form.Item>

            {receivedPPO === true && (
              <Form.Item
                name="companyName"
                label="Company Name"
                rules={[
                  { required: true, message: 'Please enter the company name' },
                  { max: 200, message: 'Company name is too long' },
                ]}
              >
                <Input
                  placeholder="Enter company name that offered you PPO"
                  className="rounded-lg"
                />
              </Form.Item>
            )}

            <Form.Item className="mb-0 mt-6">
              <Space className="w-full justify-end">
                <Button onClick={() => setModalVisible(false)}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  className="rounded-lg"
                >
                  Submit
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </>
  );
};

export default PPOAlert;
