import React from 'react';
import { Table, Tag, Button, Space, Avatar, Typography, Tooltip, theme } from 'antd';
import {
  EyeOutlined,
  BankOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { formatDisplayDate, getStatusColor } from '../utils/applicationUtils';
import { getImageUrl } from '../../../../utils/imageUtils';

const { Text } = Typography;

const getStatusIcon = (status) => {
  const icons = {
    APPLIED: <ClockCircleOutlined />,
    UNDER_REVIEW: <ClockCircleOutlined />,
    ACCEPTED: <CheckCircleOutlined />,
    REJECTED: <CloseCircleOutlined />,
    JOINED: <CheckCircleOutlined />,
    COMPLETED: <StarOutlined />,
  };
  return icons[status] || <ClockCircleOutlined />;
};

const ApplicationsTable = ({
  applications,
  loading,
  onViewDetails,
  isSelfIdentified = false,
}) => {
  const { token } = theme.useToken();

  const baseColumns = [
    {
      title: 'Company',
      key: 'company',
      width: 250,
      render: (_, record) => {
        const company = isSelfIdentified
          ? { companyName: record.companyName, logo: null }
          : record.internship?.industry;

        return (
          <div className="flex items-center gap-3">
            <Avatar
              src={company?.logo ? getImageUrl(company.logo) : null}
              icon={<BankOutlined />}
              size={40}
              className="flex-shrink-0"
              style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary }}
            />
            <div className="min-w-0">
              <Text strong className="block truncate">
                {company?.companyName || 'N/A'}
              </Text>
              {!isSelfIdentified && (
                <Text type="secondary" className="text-xs block truncate">
                  {record.internship?.title || 'Internship'}
                </Text>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: isSelfIdentified ? 'Role' : 'Position',
      key: 'position',
      width: 180,
      render: (_, record) => (
        <div>
          <Text className="block">
            {isSelfIdentified
              ? record.jobProfile || 'Not specified'
              : record.internship?.title || 'N/A'}
          </Text>
          {!isSelfIdentified && record.internship?.industry?.address && (
            <Text type="secondary" className="text-xs flex items-center gap-1">
              <EnvironmentOutlined />
              {record.internship.industry.address.split(',')[0]}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 150,
      render: (_, record) => {
        const startDate = isSelfIdentified
          ? record.startDate
          : record.internship?.startDate;
        const endDate = isSelfIdentified
          ? record.endDate
          : record.internship?.endDate;

        return (
          <div className="text-xs">
            <div className="flex items-center gap-1">
              <CalendarOutlined style={{ color: token.colorTextQuaternary }} />
              <span style={{ color: token.colorTextSecondary }}>{formatDisplayDate(startDate)}</span>
            </div>
            {endDate && (
              <div className="ml-4" style={{ color: token.colorTextTertiary }}>
                to {formatDisplayDate(endDate)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Applied On',
      key: 'appliedOn',
      width: 120,
      render: (_, record) => (
        <Text type="secondary" className="text-xs">
          {formatDisplayDate(record.applicationDate || record.createdAt)}
        </Text>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      render: (_, record) => (
        <Tag
          color={getStatusColor(record.status)}
          icon={getStatusIcon(record.status)}
          className="rounded-full px-3"
        >
          {record.status?.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onViewDetails(record)}
            >
              View
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={baseColumns}
      dataSource={applications}
      rowKey="id"
      loading={loading}
      scroll={{ x: 800 }}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (total, range) =>
          `${range[0]}-${range[1]} of ${total} applications`,
      }}
      className="custom-table"
    />
  );
};

export default ApplicationsTable;
