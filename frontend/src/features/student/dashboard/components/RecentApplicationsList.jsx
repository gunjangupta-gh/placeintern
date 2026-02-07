import React from 'react';
import { Card, Avatar, Tag, Button, Typography, Empty } from 'antd';
import {
  BankOutlined,
  RightOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Text } = Typography;

const getStatusConfig = (status) => {
  const configs = {
    APPLIED: { color: 'blue', icon: <ClockCircleOutlined /> },
    SHORTLISTED: { color: 'orange', icon: <ClockCircleOutlined /> },
    SELECTED: { color: 'green', icon: <CheckCircleOutlined /> },
    REJECTED: { color: 'red', icon: <CloseCircleOutlined /> },
    WITHDRAWN: { color: 'default', icon: <CloseCircleOutlined /> },
  };
  return configs[status] || { color: 'default', icon: <ClockCircleOutlined /> };
};

const RecentApplicationsList = ({ applications = [], loading, onViewAll }) => {
  const navigate = useNavigate();

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <BankOutlined className="text-primary" />
          <span>Recent Applications</span>
        </div>
      }
      extra={
        <Button type="link" onClick={onViewAll || (() => navigate('/app/internships'))}>
          View All <RightOutlined />
        </Button>
      }
      className="h-full"
      styles={{ body: { padding: applications.length > 0 ? 0 : 24 } }}
    >
      {applications.length > 0 ? (
        <div className="flex flex-col">
          {applications.slice(0, 5).map((app, index) => {
            const statusConfig = getStatusConfig(app.status);
            const company = app.internship?.industry || {};

            return (
              <div
                key={app.id || index}
                className={`
                  px-4 py-3 cursor-pointer transition-colors duration-200 hover:bg-surface-hover
                  flex items-start gap-4
                  ${index !== applications.slice(0, 5).length - 1 ? 'border-b border-border/50' : ''}
                `}
                onClick={() => navigate(`/app/internships/${app.internshipId}`)}
              >
                <Avatar
                  icon={<BankOutlined />}
                  src={company.logo}
                  className="bg-info-bg shrink-0"
                  size={40}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <Text strong className="text-sm truncate mr-2">
                      {company.companyName || 'Company'}
                    </Text>
                    <Tag color={statusConfig.color} icon={statusConfig.icon} className="m-0">
                      {app.status}
                    </Tag>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text className="text-xs text-text-secondary truncate mr-2">
                      {app.internship?.title || app.jobProfile || 'Position'}
                    </Text>
                    <Text className="text-xs text-text-tertiary shrink-0">
                      {dayjs(app.createdAt).format('MMM DD, YYYY')}
                    </Text>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No applications yet"
        >
          <Button type="primary" onClick={() => navigate('/app/internships')}>
            Browse Internships
          </Button>
        </Empty>
      )}
    </Card>
  );
};

export default RecentApplicationsList;