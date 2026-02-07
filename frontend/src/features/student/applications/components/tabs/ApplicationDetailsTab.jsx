import React from 'react';
import { Card, Typography, Avatar, Row, Col } from 'antd';
import {
  CalendarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { formatDisplayDate, formatCurrency } from '../../utils/applicationUtils';
import ProfileAvatar from '../../../../../components/common/ProfileAvatar';

const { Text } = Typography;

const ApplicationDetailsTab = ({ application, isSelfIdentified, internship, industry }) => {
  return (
  <div className="space-y-4 p-4">
    {/* Details Grid */}
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Card className="rounded-xl h-full" title="Duration & Schedule">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarOutlined className="text-blue-500" />
              <div>
                <Text type="secondary" className="block text-xs">Start Date</Text>
                <Text>
                  {formatDisplayDate(
                    isSelfIdentified
                      ? application.startDate
                      : internship?.startDate
                  )}
                </Text>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CalendarOutlined className="text-green-500" />
              <div>
                <Text type="secondary" className="block text-xs">End Date</Text>
                <Text>
                  {formatDisplayDate(
                    isSelfIdentified
                      ? application.endDate
                      : internship?.endDate
                  )}
                </Text>
              </div>
            </div>
            {!isSelfIdentified && internship?.stipend && (
              <div className="flex items-center gap-2">
                <StarOutlined className="text-yellow-500" />
                <div>
                  <Text type="secondary" className="block text-xs">Stipend</Text>
                  <Text>{formatCurrency(internship.stipend)}</Text>
                </div>
              </div>
            )}
          </div>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card className="rounded-xl h-full" title="Contact Information">
          <div className="space-y-3">
            {(industry?.address || application.companyAddress) && (
              <div className="flex items-center gap-2">
                <EnvironmentOutlined className="text-red-500" />
                <div>
                  <Text type="secondary" className="block text-xs">Location</Text>
                  <Text>{industry?.address || application.companyAddress}</Text>
                </div>
              </div>
            )}
            {industry?.phone && (
              <div className="flex items-center gap-2">
                <PhoneOutlined className="text-green-500" />
                <div>
                  <Text type="secondary" className="block text-xs">Phone</Text>
                  <Text>{industry.phone}</Text>
                </div>
              </div>
            )}
            {industry?.email && (
              <div className="flex items-center gap-2">
                <MailOutlined className="text-blue-500" />
                <div>
                  <Text type="secondary" className="block text-xs">Email</Text>
                  <Text>{industry.email}</Text>
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
