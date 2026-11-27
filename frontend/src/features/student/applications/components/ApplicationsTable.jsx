import React, { useState } from 'react';
import { Tag,   Typography,  theme } from 'antd';
import { AppTable } from '../../../../components/ui';
import {
  EyeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { formatDisplayDate, getStatusColor, getApplicationInfo } from '../utils/applicationUtils';
import { formatStipend, stipendSorter } from '../../../opportunities/tableUtils';
import InternshipCompensationTag from '../../../../components/common/InternshipCompensationTag';
import { compensationAmount } from '../../../../utils/internshipCompensation';

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const baseColumns = [
    {
      title: 'S.No',
      key: 'sno',
      width: 64,
      render: (_v, _r, index) => (page - 1) * pageSize + index + 1,
    },
    {
      title: 'Company',
      key: 'company',
      width: 250,
      render: (_, record) => {
        const info = getApplicationInfo(record);

        return (
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <Text strong className="block truncate">
                {info.companyName || 'N/A'}
              </Text>
              {record.opportunity && (
                <Text type="secondary" className="text-xs block truncate">
                  {info.title || 'Internship'}
                </Text>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Internship Type',
      key: 'stipend',
      width: 190,
      sortDirections: ['descend', 'ascend'], sorter: stipendSorter((r) => compensationAmount(r) ?? r.stipend),
      render: (_, record) =>
        record.internshipType ? (
          <InternshipCompensationTag application={record} />
        ) : (record.stipend || record.opportunity?.stipend) ? (
          formatStipend(record.stipend || record.opportunity.stipend)
        ) : (
          'Not specified'
        ),
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 150,
      render: (_, record) => {
        const { startDate, endDate } = getApplicationInfo(record);

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
  ];

  const rowActions = [
    { key: 'view', label: 'View Details', icon: <EyeOutlined />, type: 'primary', onClick: (r) => onViewDetails(r) },
  ];

  return (
    <AppTable
      columns={baseColumns}
      actions={rowActions}
      dataSource={applications}
      rowKey="id"
      loading={loading}
      scroll={{ x:  'max-content' }}
      pagination={{
        current: page,
        pageSize,
        onChange: (p, ps) => { setPage(ps !== pageSize ? 1 : p); setPageSize(ps); },
        showSizeChanger: true,
        showTotal: (total, range) =>
          `${range[0]}-${range[1]} of ${total} applications`,
      }}
      className="custom-table"
    />
  );
};

export default ApplicationsTable;
