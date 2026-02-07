import React from 'react';
import { Card, Typography, Button, Space } from 'antd';
import {
  InfoCircleOutlined,
  ArrowRightOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

const ComingSoon = ({ feature = 'This feature' }) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-2xl w-full border-0 shadow-lg rounded-2xl">
        {/* Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 mb-4">
            <InfoCircleOutlined className="text-5xl text-primary" />
          </div>
        </div>

        {/* Title */}
        <Title level={2} className="!mb-4 text-center !text-text-primary">
          Feature Currently Unavailable
        </Title>

        {/* Description */}
        <div className="mb-8 text-center">
          <Paragraph className="text-text-secondary text-base mb-4">
            <strong>{feature}</strong> is currently unavailable in the system.
          </Paragraph>

          <Card className="bg-blue-50 border-blue-200 mb-4">
            <Space direction="vertical" size="small" className="w-full">
              <Text className="text-text-primary">
                <strong>Important Notice:</strong>
              </Text>
              <Text className="text-text-secondary">
                At this time, only <strong>self-identified internships</strong> are supported.
                Students can add and manage their own internship details through the self-identified internship system.
              </Text>
            </Space>
          </Card>

          <Paragraph className="text-text-tertiary text-sm">
            We are continuously working to expand our platform's capabilities.
            Additional features will be made available in future updates.
          </Paragraph>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            onClick={() => navigate('/student/self-identified-internship')}
            className="rounded-lg w-full sm:w-auto"
          >
            Go to Self-Identified Internships
          </Button>
          <Button
            size="large"
            icon={<HomeOutlined />}
            onClick={() => navigate('/dashboard')}
            className="rounded-lg w-full sm:w-auto"
          >
            Back to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ComingSoon;
