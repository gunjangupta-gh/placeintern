import React from 'react';
import { Card, Tag, Typography, Avatar, Button } from 'antd';
import {
  EnvironmentOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  BankOutlined,
  EyeOutlined,
  BookOutlined,
  CalendarOutlined,
  TeamOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { theme } from 'antd';

const { Title, Text, Paragraph } = Typography;
const { useToken } = theme;

const getStatusColor = (deadline) => {
  const daysLeft = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 3) return 'red';
  if (daysLeft <= 7) return 'orange';
  return 'green';
};

const getDaysLeft = (deadline) => {
  const daysLeft = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
  return daysLeft > 0 ? daysLeft : 0;
};

const InternshipCard = ({ internship, isApplied, onViewDetails }) => {
  const { token } = useToken();

  return (
    <Card
      className={`h-full rounded-2xl border-border shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-background/90 backdrop-blur-sm overflow-hidden ${
        isApplied ? 'ring-2 ring-success-200' : ''
      }`}
      styles={{ body: { padding: 0 } }}
    >
      {/* Card Header */}
      <div
        className="p-6 text-white relative overflow-hidden"
        style={{
          background: isApplied
            ? `linear-gradient(135deg, ${token.colorSuccess} 0%, ${token.colorSuccessBg} 100%)`
            : `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryBg} 100%)`
        }}
      >
        <div className="absolute top-0 right-0 w-20 h-20 bg-surface/10 rounded-full -translate-y-10 translate-x-10"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <Avatar
              size={50}
              icon={<BankOutlined />}
              className="bg-surface/20 border-2 border-white/30"
            />
            <div className="flex flex-col items-end gap-2">
              {isApplied ? (
                <Tag className="border-white/30 text-success-800 px-3 py-1 rounded-full font-medium bg-surface/90">
                  <CheckCircleOutlined className="mr-1" />
                  Applied
                </Tag>
              ) : (
                <Tag
                  color={getStatusColor(internship.applicationDeadline)}
                  className="px-3 py-1 rounded-full font-medium"
                >
                  {getDaysLeft(internship.applicationDeadline)} days left
                </Tag>
              )}
            </div>
          </div>
          <Title level={5} className="text-white mb-1 line-clamp-2">
            {internship.title}
          </Title>
          <Text className="font-medium text-white/90">
            {internship.industry?.companyName}
          </Text>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6 space-y-4">
        {/* Field and Location */}
        <div className="flex flex-wrap gap-2">
          <Tag color="blue" className="rounded-full">
            <BookOutlined className="mr-1" />
            {internship.fieldOfWork}
          </Tag>
          <Tag color="green" className="rounded-full">
            <EnvironmentOutlined className="mr-1" />
            {internship.workLocation?.replace('_', ' ')}
          </Tag>
        </div>

        {/* Description */}
        <Paragraph
          className="text-text-secondary text-sm line-clamp-3 mb-4"
          ellipsis={{ rows: 3 }}
        >
          {internship.description}
        </Paragraph>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center text-text-tertiary">
            <ClockCircleOutlined className="mr-2 text-warning" />
            <span>{internship.duration}</span>
          </div>
          <div className="flex items-center text-text-tertiary">
            <TeamOutlined className="mr-2 text-primary" />
            <span>{internship.numberOfPositions} positions</span>
          </div>
          <div className="flex items-center text-text-tertiary">
            <CalendarOutlined className="mr-2 text-blue-500" />
            <span>Start: {new Date(internship.startDate).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center text-text-tertiary">
            <DollarOutlined className="mr-2 text-success" />
            <span>
              {internship.isStipendProvided
                ? `₹${internship.stipendAmount?.toLocaleString()}`
                : 'Unpaid'
              }
            </span>
          </div>
        </div>

        {/* Action Button */}
        <Button
          type="primary"
          block
          icon={isApplied ? <CheckCircleOutlined /> : <EyeOutlined />}
          onClick={() => onViewDetails(internship)}
          className="mt-6 h-12 rounded-xl border-0 font-semibold text-base hover:scale-105 transition-all duration-200"
          style={{
            background: isApplied ? token.colorSuccess : token.colorPrimary
          }}
        >
          {isApplied ? 'View Application' : 'View Details & Apply'}
        </Button>
      </div>
    </Card>
  );
};

export default InternshipCard;
