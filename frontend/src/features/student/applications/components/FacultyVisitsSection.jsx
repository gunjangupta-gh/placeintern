import React, { useState } from 'react';
import {
  Card,
  Tag,
  Empty,
  Spin,
  Typography,
  List,
  Modal,
  Tooltip,
  Descriptions,
  Button,
} from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { MONTH_NAMES } from '../utils/applicationUtils';

const { Text, Title } = Typography;

const FacultyVisitsSection = ({
  application,
  visits = [],
  loading,
  hasStarted,
}) => {
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);

  const openViewModal = (visit) => {
    setSelectedVisit(visit);
    setViewModalVisible(true);
  };

  // Filter only completed visits
  const completedVisits = visits.filter(visit => 
    visit.submissionStatus === 'COMPLETED' || visit.visitDate
  );

  if (!hasStarted) {
    return (
      <Card className="rounded-xl">
        <Empty
          image={<CalendarOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
          description={
            <Text className="text-gray-500">
              Faculty visits will be scheduled once your internship starts
            </Text>
          }
        />
      </Card>
    );
  }

  return (
    <Card 
      className="rounded-xl" 
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TeamOutlined className="text-purple-500" />
            <span>Faculty Visits</span>
          </div>
          <Tag color="purple">
            {completedVisits.length} {completedVisits.length === 1 ? 'Visit' : 'Visits'}
          </Tag>
        </div>
      }
    >
      {loading ? (
        <div className="text-center py-8">
          <Spin tip="Loading visits..." />
        </div>
      ) : completedVisits.length === 0 ? (
        <Empty 
          image={<TeamOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
          description="No visits recorded yet"
        />
      ) : (
        <List
          dataSource={completedVisits}
          renderItem={(visit) => (
            <List.Item
              actions={[
                <Tooltip title="View details" key="view">
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => openViewModal(visit)}
                  />
                </Tooltip>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-50">
                    <CheckCircleOutlined className="text-green-500 text-lg" />
                  </div>
                }
                title={
                  <div className="flex items-center gap-2">
                    <Text strong>
                      {MONTH_NAMES[(visit.visitMonth || 1) - 1]} {visit.visitYear}
                    </Text>
                    <Tag color="success" className="!m-0">Completed</Tag>
                  </div>
                }
                description={
                  <div className="space-y-1 text-xs">
                    {visit.faculty?.name && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <UserOutlined className="text-xs" />
                        <span>Faculty: {visit.faculty.name}</span>
                      </div>
                    )}
                    {visit.visitDate && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <CalendarOutlined className="text-xs" />
                        <span>Visit Date: {new Date(visit.visitDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {visit.visitLocation && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <EnvironmentOutlined className="text-xs" />
                        <span>{visit.visitLocation}</span>
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}


      {/* View Visit Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <CheckCircleOutlined className="text-green-500" />
            <span>
              {selectedVisit
                ? `${MONTH_NAMES[(selectedVisit.visitMonth || 1) - 1]} ${selectedVisit.visitYear} Visit`
                : 'Visit Details'}
            </span>
          </div>
        }
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setSelectedVisit(null);
        }}
        footer={null}
        width={600}
      >
        {selectedVisit && (
          <div className="space-y-4">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Status">
                <Tag color="success">Completed</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Faculty Member">
                {selectedVisit.faculty?.name || 'Not assigned'}
              </Descriptions.Item>
              {selectedVisit.visitDate && (
                <Descriptions.Item label="Visit Date">
                  {new Date(selectedVisit.visitDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Descriptions.Item>
              )}
              {selectedVisit.visitType && (
                <Descriptions.Item label="Visit Type">
                  {selectedVisit.visitType}
                </Descriptions.Item>
              )}
              {selectedVisit.visitLocation && (
                <Descriptions.Item label="Location">
                  <div className="flex items-center gap-1">
                    <EnvironmentOutlined />
                    {selectedVisit.visitLocation}
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedVisit.meetingMinutes && (
              <div className="mt-4">
                <Text strong className="block mb-2">Meeting Minutes</Text>
                <Card className="bg-gray-50" size="small">
                  <Text className="text-sm whitespace-pre-wrap">
                    {selectedVisit.meetingMinutes}
                  </Text>
                </Card>
              </div>
            )}
            {selectedVisit.responseFromOrganisation && (
              <div className="mt-4">
                <Text strong className="block mb-2">Response From Organisation</Text>
                <Card className="bg-gray-50" size="small">
                  <Text className="text-sm whitespace-pre-wrap">
                    {selectedVisit.responseFromOrganisation}
                  </Text>
                </Card>
              </div>
            )}

            {selectedVisit.feedbackSharedWithStudent && (
              <div className="mt-4">
                <Text strong className="block mb-2">Feedback Shared With Student</Text>
                <Card className="bg-gray-50" size="small">
                  <Text className="text-sm whitespace-pre-wrap">
                    {selectedVisit.feedbackSharedWithStudent}
                  </Text>
                </Card>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default FacultyVisitsSection;
