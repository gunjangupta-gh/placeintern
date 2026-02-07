import React from 'react';
import { Card, Tag, Button, Typography, Empty, Avatar, Badge, Tooltip } from 'antd';
import {
  ExclamationCircleOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
  UserOutlined,
  TeamOutlined,
  GlobalOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Text } = Typography;

const getStatusConfig = (status) => {
  const configs = {
    SUBMITTED: { color: 'blue', icon: <ClockCircleOutlined />, label: 'Submitted' },
    IN_REVIEW: { color: 'orange', icon: <ClockCircleOutlined />, label: 'In Review' },
    IN_PROGRESS: { color: 'orange', icon: <ClockCircleOutlined />, label: 'In Progress' },
    ESCALATED: { color: 'red', icon: <RiseOutlined />, label: 'Escalated' },
    RESOLVED: { color: 'green', icon: <CheckCircleOutlined />, label: 'Resolved' },
    CLOSED: { color: 'default', icon: <CheckCircleOutlined />, label: 'Closed' },
  };
  return configs[status] || { color: 'default', icon: <ClockCircleOutlined />, label: status };
};

const getPriorityColor = (priority) => {
  const colors = {
    HIGH: 'red',
    URGENT: 'red',
    MEDIUM: 'orange',
    LOW: 'blue',
  };
  return colors[priority] || 'default';
};

const ESCALATION_LEVELS = {
  MENTOR: { label: 'Mentor', color: 'blue', icon: <UserOutlined /> },
  PRINCIPAL: { label: 'Principal', color: 'orange', icon: <TeamOutlined /> },
  STATE_DIRECTORATE: { label: 'State', color: 'red', icon: <GlobalOutlined /> },
};

const GrievancesCard = ({ grievances = [], loading, onCreateNew, onViewAll }) => {
  const navigate = useNavigate();

  // Handle both array and API response object format
  const grievancesList = Array.isArray(grievances) ? grievances : (grievances?.grievances || []);

  const pendingCount = grievancesList.filter(
    g => g.status !== 'RESOLVED' && g.status !== 'CLOSED'
  ).length;

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <ExclamationCircleOutlined className="text-warning-500" />
          <span>Grievances</span>
          {pendingCount > 0 && (
            <Badge count={pendingCount} className="ml-2" />
          )}
        </div>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="small"
          onClick={onCreateNew || (() => navigate('/app/submit-grievance'))}
        >
          New
        </Button>
      }
      className="h-full border border-border rounded-xl"
    >
      {grievancesList.length > 0 ? (
        <>
          <div className="flex flex-col gap-3">
            {grievancesList.slice(0, 3).map((grievance, index) => {
              const statusConfig = getStatusConfig(grievance.status);
              const escalationConfig = ESCALATION_LEVELS[grievance.escalationLevel];

              return (
                <div key={grievance.id || index} className={`flex items-start justify-between w-full gap-3 pb-3 ${index !== grievancesList.slice(0, 3).length - 1 ? 'border-b border-border/50' : ''}`}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar
                      size="small"
                      icon={<ExclamationCircleOutlined />}
                      className="bg-warning-100 text-warning-600 mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <Text className="text-sm font-medium block truncate">
                        {grievance.title || grievance.subject}
                      </Text>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Tag color={getPriorityColor(grievance.severity || grievance.priority)} className="text-[10px] py-0 px-1 m-0">
                          {grievance.severity || grievance.priority || 'MEDIUM'}
                        </Tag>
                        {escalationConfig && (
                          <Tooltip title={`At ${escalationConfig.label} level`}>
                            <Tag color={escalationConfig.color} className="text-[10px] py-0 px-1 m-0" icon={escalationConfig.icon}>
                              {escalationConfig.label}
                            </Tag>
                          </Tooltip>
                        )}
                        {grievance.assignedTo && (
                          <Tooltip title={`Assigned to ${grievance.assignedTo.name}`}>
                            <Text className="text-[10px] text-text-tertiary">
                              <UserOutlined className="mr-1" />
                              {grievance.assignedTo.name.split(' ')[0]}
                            </Text>
                          </Tooltip>
                        )}
                        <Text className="text-[10px] text-text-tertiary">
                          {dayjs(grievance.createdAt).format('MMM DD')}
                        </Text>
                      </div>
                    </div>
                  </div>
                  <Tag color={statusConfig.color} className="flex-shrink-0 m-0">
                    {statusConfig.label}
                  </Tag>
                </div>
              );
            })}
          </div>
          {grievancesList.length > 3 && (
            <Button
              type="link"
              block
              onClick={onViewAll || (() => navigate('/app/grievances'))}
              className="mt-2"
            >
              View All ({grievancesList.length}) <RightOutlined />
            </Button>
          )}
        </>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No grievances"
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateNew || (() => navigate('/app/submit-grievance'))}
          >
            Report Issue
          </Button>
        </Empty>
      )}
    </Card>
  );
};

export default GrievancesCard;