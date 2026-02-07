import React from 'react';
import { Card, Avatar, Tag, Button, Typography, Empty, Space, theme } from 'antd';
import {
  CalendarOutlined,
  PlusOutlined,
  RightOutlined,
  EnvironmentOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import ProfileAvatar from '../../../../components/common/ProfileAvatar';

const { Text } = Typography;

const getVisitTypeColor = (type) => {
  const colors = {
    PHYSICAL: 'green',
    VIRTUAL: 'blue',
    PHONE: 'orange',
  };
  return colors[type] || 'default';
};

const VisitLogsCard = ({ visitLogs = [], loading, onCreateNew, onViewAll }) => {
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const upcomingVisits = visitLogs.filter(v =>
    dayjs(v.visitDate).isAfter(dayjs())
  ).length;

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <CalendarOutlined style={{ color: token.colorSuccess }} />
          <span>Visit Logs</span>
          {upcomingVisits > 0 && (
            <Tag color="blue">{upcomingVisits} upcoming</Tag>
          )}
        </div>
      }
      extra={
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            onClick={onCreateNew || (() => navigate('/app/visit-logs'))}
          >
            New Visit
          </Button>
          <Button
            type="link"
            size="small"
            onClick={onViewAll || (() => navigate('/app/visit-logs'))}
          >
            <RightOutlined />
          </Button>
        </Space>
      }
      className="h-full !rounded-xl"
      style={{ borderColor: token.colorBorder }}
    >
      {visitLogs.length > 0 ? (
        <div className="flex flex-col !gap-3">
          {visitLogs.slice(0, 5).map((visit, index) => {
            const isPast = dayjs(visit.visitDate).isBefore(dayjs());

            return (
              <div 
                key={visit.id || index} 
                className="flex items-center justify-between w-full pb-3"
                style={{ borderBottom: index !== visitLogs.slice(0, 5).length - 1 ? `1px solid ${token.colorSplit}` : 'none' }}
              >
                <div className="flex items-center gap-3">
                  <ProfileAvatar
                    size="small"
                    profileImage={visit.application?.student?.profileImage || visit.student?.profileImage}
                    style={{
                      backgroundColor: isPast ? token.colorSuccessBg : token.colorPrimaryBg,
                      color: isPast ? token.colorSuccess : token.colorPrimary
                    }}
                  />
                  <div>
                    <Text className="text-sm font-medium block">
                      {visit.application?.student?.user?.name || visit.application?.student?.name || visit.studentName || 'Student'}
                    </Text>
                    <div className="flex items-center gap-2 text-xs" style={{ color: token.colorTextSecondary }}>
                      <EnvironmentOutlined />
                      <span>{visit.visitLocation || visit.application?.internship?.industry?.companyName || 'Location'}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Tag color={getVisitTypeColor(visit.visitType)} className="m-0">
                    {visit.visitType || 'PHYSICAL'}
                  </Tag>
                  <Text className="text-xs block mt-1" style={{ color: token.colorTextTertiary }}>
                    {dayjs(visit.visitDate).format('MMM DD, YYYY')}
                  </Text>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No visit logs"
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateNew || (() => navigate('/app/visit-logs'))}
          >
            Schedule Visit
          </Button>
        </Empty>
      )}
    </Card>
  );
};

export default VisitLogsCard;