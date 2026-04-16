import React from 'react';
import { Card, Table, Tag, Button, Space, Avatar, Typography, Tooltip, Badge, Progress } from 'antd';
import {
  BankOutlined,
  EyeOutlined,
  RightOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  CalendarOutlined,
  FileTextOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  BookOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const InstitutionsTable = ({ institutions, loading, onViewAll, onViewDetails, month, year }) => {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'red';
      case 'pending':
        return 'orange';
      default:
        return 'blue';
    }
  };

  // Use the pre-calculated compliance score from backend (consistent with Institution Overview)
  const getComplianceScore = (stats) => {
    if (!stats) return 0;
    // Use backend-calculated complianceScore for consistency
    return stats.complianceScore ?? 0;
  };

  const columns = [
    {
      title: 'Institution',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 240,
      render: (name, record) => {
        const displayName = record.shortName || name;
        return (
          <div className="flex items-center gap-3">
            <Avatar
              icon={<BankOutlined />}
              className="bg-primary/10 text-primary rounded-lg"
              size="small"
            />
            <div className="min-w-0">
              <Text strong className="block text-text-primary text-sm truncate" title={displayName}>{displayName}</Text>
              <Text className="text-xs text-text-tertiary block truncate">
                {record.code || record.city}
              </Text>
            </div>
          </div>
        );
      },
    },
    {
      title: (
        <Tooltip title="Active students (used for all compliance calculations)">
          <Space size={4}>
            <TeamOutlined />
            <span>Students</span>
          </Space>
        </Tooltip>
      ),
      dataIndex: ['stats', 'activeStudents'],
      key: 'activeStudents',
      width: 100,
      align: 'center',
      render: (value, record) => {
        const active = value ?? record.stats?.activeStudents ?? 0;
        const total = record.stats?.totalStudents ?? active;
        return (
          <Tooltip title={`${active} active / ${total} total`}>
            <Text strong className="text-text-primary">{active}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: (
        <Tooltip title="Approved self-identified internship applications">
          <Space size={4}>
            <BookOutlined />
            <span>Internships</span>
          </Space>
        </Tooltip>
      ),
      dataIndex: ['stats', 'selfIdentifiedApproved'],
      key: 'selfIdentifiedApproved',
      width: 120,
      align: 'center',
      render: (value, record) => {
        // Use activeStudents as denominator (consistent with compliance calculations)
        const activeStudents = record.stats?.activeStudents ?? 0;
        const percent = activeStudents > 0 ? Math.round((value / activeStudents) * 100) : 0;
        return (
          <Tooltip title={`${percent}% of active students have internships`}>
            <div className="text-center w-full px-2">
              <Text strong className="text-blue-500">{value || 0}</Text>
              <Progress
                percent={percent}
                showInfo={false}
                size="small"
                strokeColor="rgb(var(--color-primary))"
                railColor="rgba(var(--color-border), 0.5)"
                className="!m-0"
              />
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: (
        <Tooltip title="Mentor Assignments - Assigned / Unassigned">
          <Space size={4}>
            <UserSwitchOutlined />
            <span>Mentors</span>
          </Space>
        </Tooltip>
      ),
      key: 'assignments',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const assigned = record.stats?.assigned || 0;
        const unassigned = record.stats?.unassigned || 0;
        const hasUnassigned = unassigned > 0;

        return (
          <Space size={4}>
            <Tag color="success" className="m-0 rounded-md border-0">
              <CheckCircleOutlined /> {assigned}
            </Tag>
            {hasUnassigned && (
              <Tooltip title={`${unassigned} students without mentors`}>
                <Tag color="warning" className="m-0 rounded-md border-0">
                  <WarningOutlined /> {unassigned}
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: (
        <Tooltip title="Faculty visits this month (Completed / Expected)">
          <Space size={4}>
            <CalendarOutlined />
            <span>Visits</span>
          </Space>
        </Tooltip>
      ),
      key: 'visits',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const completed = record.stats?.facultyVisits || 0;
        const expected = record.stats?.visitsExpected || 0;
        const percentage = expected > 0 ? Math.round((completed / expected) * 100) : 0;

        // Determine color based on completion percentage
        let textColor = 'text-green-600';
        if (expected > 0 && percentage < 50) textColor = 'text-red-500';
        else if (expected > 0 && percentage < 80) textColor = 'text-amber-500';

        return (
          <Tooltip title={`${completed} completed out of ${expected} expected (${percentage}%)`}>
            <div className="text-center">
              <Text strong className={textColor}>{completed}</Text>
              <Text className="text-text-tertiary">/{expected}</Text>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: (
        <Tooltip title="Monthly Reports (Submitted / Expected)">
          <Space size={4}>
            <FileTextOutlined />
            <span>Reports</span>
          </Space>
        </Tooltip>
      ),
      key: 'reports',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const submitted = record.stats?.reportsSubmitted || 0;
        const expected = record.stats?.reportsExpected || 0;
        const percentage = expected > 0 ? Math.round((submitted / expected) * 100) : 0;

        // Determine color based on submission percentage
        let textColor = 'text-green-600';
        if (expected > 0 && percentage < 50) textColor = 'text-red-500';
        else if (expected > 0 && percentage < 80) textColor = 'text-amber-500';

        return (
          <Tooltip title={`${submitted} submitted out of ${expected} expected (${percentage}%)`}>
            <div className="text-center">
              <Text strong className={textColor}>{submitted}</Text>
              <Text className="text-text-tertiary">/{expected}</Text>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: 'Score',
      key: 'score',
      width: 90,
      align: 'center',
      render: (_, record) => {
        const score = getComplianceScore(record.stats);
        let color = 'rgb(var(--color-success))';
        if (score < 50) color = 'rgb(var(--color-error))';
        else if (score < 75) color = 'rgb(var(--color-warning))';

        return (
          <Tooltip title="Compliance score = (Mentor Assignment Rate + Joining Report Rate) / 2">
            <Progress
              type="circle"
              percent={score}
              size={36}
              strokeColor={color}
              format={(percent) => <span className="text-[10px] font-bold text-text-primary">{percent}%</span>}
            />
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      width: 90,
      align: 'center',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'} className="m-0 rounded-md border-0 font-bold text-[10px] uppercase tracking-wider">
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            icon={<EyeOutlined className="text-text-tertiary hover:text-primary" />}
            size="small"
            onClick={() => onViewDetails?.(record) || navigate(`/app/institutions-overview?id=${record.id}`)}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-background-tertiary"
          />
        </Tooltip>
      ),
    },
  ];

  const monthName = month ? new Date(2024, month - 1, 1).toLocaleString('default', { month: 'long' }) : '';

  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BankOutlined className="text-primary text-lg" />
          </div>
          <span className="font-bold text-text-primary text-lg">Institution Performance</span>
          {month && year && (
            <Tag color="blue" className="ml-2 rounded-md border-0 font-medium">
              <FilterOutlined className="mr-1" />
              {monthName} {year}
            </Tag>
          )}
        </div>
      }
      extra={
        <Button
          type="link"
          onClick={onViewAll || (() => navigate('/app/institutions'))}
          className="flex items-center gap-1 font-bold text-sm px-0"
        >
          View All <RightOutlined className="text-xs" />
        </Button>
      }
      className="shadow-sm h-full border-border rounded-2xl bg-surface"
      styles={{ 
        header: { borderBottom: '1px solid var(--color-border)', padding: '20px 24px' }, 
        body: { padding: 0 } 
      }}
    >
      <Table
        columns={columns}
        dataSource={institutions}
        loading={loading}
        pagination={false}
        size="middle"
        rowKey="id"
        scroll={{ x: 'max-content' }}
        className="custom-table"
      />
    </Card>
  );
};

export default InstitutionsTable;
