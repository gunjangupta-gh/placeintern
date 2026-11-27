import React from 'react';
import { Card, Typography, Descriptions, Row, Col } from 'antd';
import {
  CalendarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { formatDisplayDate } from '../../utils/applicationUtils';
import { formatStipend } from '../../../../opportunities/tableUtils';
import ProfileAvatar from '../../../../../components/common/ProfileAvatar';
import InternshipCompensationTag from '../../../../../components/common/InternshipCompensationTag';

const { Text } = Typography;

const ApplicationDetailsTab = ({ application, isSelfIdentified, info = {} }) => {
  return (
  <div className="space-y-4 p-4">
    {/* State opportunity: position details and description */}
    {!isSelfIdentified && (
      <Card className="rounded-xl" title="Internship Details">
        <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Company">{info.companyName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Position">{info.title || '-'}</Descriptions.Item>
          <Descriptions.Item label="District">{info.district || '-'}</Descriptions.Item>
          <Descriptions.Item label="Duration">
            {info.durationMonths ? `${info.durationMonths} ${info.durationMonths > 1 ? 'Months' : 'Month'}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Stipend">{info.stipend ? formatStipend(info.stipend) : 'Not specified'}</Descriptions.Item>
          <Descriptions.Item label="Apply by">{formatDisplayDate(info.applicationDeadline)}</Descriptions.Item>
        </Descriptions>
        <Text strong className="block mt-3">Description</Text>
        <div style={{ maxHeight: 220, overflowY: 'auto', whiteSpace: 'pre-wrap', marginTop: 4 }}>
          {info.description || <Text type="secondary">No description provided.</Text>}
        </div>
      </Card>
    )}

    {/* Details Grid */}
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Card className="rounded-xl h-full" title="Duration & Schedule">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarOutlined className="text-blue-500" />
              <div>
                <Text type="secondary" className="block text-xs">Start Date</Text>
                <Text>{formatDisplayDate(info.startDate)}</Text>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CalendarOutlined className="text-green-500" />
              <div>
                <Text type="secondary" className="block text-xs">End Date</Text>
                <Text>{formatDisplayDate(info.endDate)}</Text>
              </div>
            </div>
            {isSelfIdentified && (
              <div className="flex items-center gap-2">
                <StarOutlined className="text-yellow-500" />
                <div>
                  <Text type="secondary" className="block text-xs">Internship Type</Text>
                  <InternshipCompensationTag application={application} />
                </div>
              </div>
            )}
          </div>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card className="rounded-xl h-full" title="Contact Information">
          <div className="space-y-3">
            {(info.address || info.district) && (
              <div className="flex items-center gap-2">
                <EnvironmentOutlined className="text-red-500" />
                <div>
                  <Text type="secondary" className="block text-xs">Location</Text>
                  <Text>{[info.address, !isSelfIdentified && info.district].filter(Boolean).join(', ')}</Text>
                </div>
              </div>
            )}
          </div>
        </Card>
      </Col>
    </Row>

    {/* Mentor Info */}
    {application.mentor && (
      <Card className="rounded-xl" title="Assigned Mentor">
        <div className="flex items-center gap-4">
          <ProfileAvatar
            profileImage={application.mentor.profileImage}
            size={48}
            className="bg-purple-100 text-purple-600"
          />
          <div>
            <Text strong>{application.mentor.name}</Text>
            <br />
            <Text type="secondary" className="text-sm">
              {application.mentor.designation || 'Faculty Mentor'}
            </Text>
            {application.mentor.email && (
              <div className="text-xs text-gray-500">{application.mentor.email}</div>
            )}
          </div>
        </div>
      </Card>
    )}

    {/* Self-Identified: HR Contact Info */}
    {isSelfIdentified && (application.hrName || application.hrContact || application.hrEmail) && (
      <Card className="rounded-xl" title="HR / Contact Person">
        <div className="space-y-3">
          {application.hrName && (
            <div className="flex items-center gap-2">
              <UserOutlined className="text-purple-500" />
              <div>
                <Text type="secondary" className="block text-xs">Name</Text>
                <Text>{application.hrName}</Text>
              </div>
            </div>
          )}
          {application.hrContact && (
            <div className="flex items-center gap-2">
              <PhoneOutlined className="text-green-500" />
              <div>
                <Text type="secondary" className="block text-xs">Phone</Text>
                <Text>{application.hrContact}</Text>
              </div>
            </div>
          )}
          {application.hrEmail && (
            <div className="flex items-center gap-2">
              <MailOutlined className="text-blue-500" />
              <div>
                <Text type="secondary" className="block text-xs">Email</Text>
                <Text>{application.hrEmail}</Text>
              </div>
            </div>
          )}
        </div>
      </Card>
    )}
  </div>
  );
};

export default ApplicationDetailsTab;
