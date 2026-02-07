import React from 'react';
import { Card, Timeline, Typography } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { formatDisplayDate } from '../../utils/applicationUtils';

const { Text } = Typography;

const getTimelineItems = (application) => {
  const items = [
    {
      color: 'blue',
      children: (
        <div>
          <Text strong>Application Submitted</Text>
          <br />
          <Text type="secondary" className="text-xs">
            {formatDisplayDate(application.applicationDate || application.createdAt, true)}
          </Text>
        </div>
      ),
    },
  ];

  if (application.reviewedAt) {
    items.push({
      color: application.status === 'REJECTED' ? 'red' : 'green',
      children: (
        <div>
          <Text strong>
            {application.status === 'REJECTED' ? 'Application Rejected' : 'Application Reviewed'}
          </Text>
          <br />
          <Text type="secondary" className="text-xs">
            {formatDisplayDate(application.reviewedAt, true)}
          </Text>
        </div>
      ),
    });
  }

  if (application.internshipPhase === "ACTIVE") {
    items.push({
      color: 'cyan',
      children: (
        <div>
          <Text strong>Internship Active</Text>
          <br />
          <Text type="secondary" className="text-xs">
            {formatDisplayDate(application.joiningDate, true)}
          </Text>
        </div>
      ),
    });
  }

  if (application.status === 'COMPLETED') {
    items.push({
      color: 'purple',
      dot: <TrophyOutlined />,
      children: (
        <div>
          <Text strong>Internship Completed</Text>
          <br />
          <Text type="secondary" className="text-xs">
            {formatDisplayDate(application.completedAt, true)}
          </Text>
        </div>
      ),
    });
  }

  return items;
};

const ApplicationTimelineTab = ({ application }) => (
  <Card className="rounded-xl">
    <Timeline items={getTimelineItems(application)} />
  </Card>
);

export default ApplicationTimelineTab;
