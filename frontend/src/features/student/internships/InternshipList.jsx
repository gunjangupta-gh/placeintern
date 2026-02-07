import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Card, Input, Select, Typography, Avatar, Tooltip, theme } from 'antd';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchInternships, applyForInternship } from '../store/studentSlice';
import {
  EyeOutlined,
  SearchOutlined,
  SendOutlined,
  ShopOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  BankOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;

const InternshipList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [filters, setFilters] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  const { internships, applications, loading } = useSelector(state => state.student);

  useEffect(() => {
    loadInternships();
  }, [dispatch, pagination.current, pagination.pageSize, filters]);

  const loadInternships = () => {
    dispatch(fetchInternships({
      page: pagination.current,
      limit: pagination.pageSize,
      ...filters
    }));
  };

  const handleApply = async (internshipId) => {
    try {
      await dispatch(applyForInternship(internshipId)).unwrap();
      toast.success('Application submitted successfully');
      loadInternships();
    } catch (error) {
      toast.error(error?.message || 'Failed to submit application');
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleSearch = (value) => {
    setFilters({ ...filters, search: value });
    setPagination({ ...pagination, current: 1 });
  };

  const isApplied = (internshipId) => {
    return applications?.list?.some(app => app.internshipId === internshipId);
  };

  const getApplicationStatus = (internshipId) => {
    const application = applications?.list?.find(app => app.internshipId === internshipId);
    return application?.status;
  };

  const columns = [
    {
      title: 'Position & Company',
      dataIndex: 'position',
      key: 'position',
      width: 250,
      render: (text, record) => (
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ 
              backgroundColor: token.colorPrimaryBg, 
              border: `1px solid ${token.colorPrimaryBorder}`,
              color: token.colorPrimary 
            }}
          >
            {record.company?.logo ? (
              <img src={record.company.logo} alt={record.company.name} className="w-full h-full object-contain p-1" />
            ) : (
              <BankOutlined />
            )}
          </div>
          <div>
            <div className="font-bold leading-tight" style={{ color: token.colorText }}>{record.title || text}</div>
            <div className="text-xs font-medium" style={{ color: token.colorTextSecondary }}>{record.company?.name || record.industry?.companyName}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Details',
      key: 'details',
      width: 200,
      render: (_, record) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-xs" style={{ color: token.colorTextSecondary }}>
            <EnvironmentOutlined style={{ color: token.colorTextTertiary }} />
            {record.location || record.workLocation}
          </div>
          <div className="flex items-center gap-1 text-xs" style={{ color: token.colorTextSecondary }}>
            <ClockCircleOutlined style={{ color: token.colorTextTertiary }} />
            {record.duration} months
          </div>
        </div>
      ),
    },
    {
      title: 'Stipend',
      dataIndex: 'stipend',
      key: 'stipend',
      width: 120,
      render: (stipend, record) => (
        <div className="font-medium text-sm" style={{ color: token.colorText }}>
          {record.stipendAmount || stipend ? `₹${(record.stipendAmount || stipend).toLocaleString()}` : <span style={{ color: token.colorTextTertiary }}>Unpaid</span>}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type, record) => {
        const workType = type || (record.isRemoteAllowed ? 'Remote' : 'On-site');
        const color = workType === 'Remote' ? 'blue' : workType === 'Hybrid' ? 'purple' : 'cyan';
        return (
          <Tag color={color} className="rounded-md font-medium border-0 px-2 py-0.5">
            {workType}
          </Tag>
        );
      },
    },
    {
      title: 'Deadline',
      dataIndex: 'applicationDeadline',
      key: 'applicationDeadline',
      width: 120,
      render: (date) => (
        <Tooltip title={dayjs(date).format('dddd, MMMM D, YYYY')}>
          <span className="text-sm" style={{ color: token.colorTextSecondary }}>{dayjs(date).format('MMM D, YYYY')}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => {
        if (isApplied(record.id)) {
          const status = getApplicationStatus(record.id);
          const config = {
            APPLIED: { color: 'blue', label: 'Applied' },
            SHORTLISTED: { color: 'orange', label: 'Shortlisted' },
            SELECTED: { color: 'green', label: 'Selected' },
            REJECTED: { color: 'red', label: 'Rejected' },
          }[status] || { color: 'default', label: status };
          
          return <Tag color={config.color} className="rounded-md font-bold uppercase text-[10px] tracking-wider">{config.label}</Tag>;
        }
        return <Tag className="rounded-md" style={{ color: token.colorTextTertiary, borderColor: token.colorBorder }}>Not Applied</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="default"
            size="small"
            className="rounded-lg"
            style={{ borderColor: token.colorBorder, color: token.colorTextSecondary }}
            onClick={() => navigate(`/internships/${record.id}`)}
          >
            Details
          </Button>
          {!isApplied(record.id) && (
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleApply(record.id)}
              className="rounded-lg shadow-sm"
              style={{ backgroundColor: token.colorPrimary }}
            >
              Apply
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const stats = {
    total: internships?.total || 0,
    applied: applications?.list?.length || 0,
    selected: applications?.list?.filter(app => app.status === 'SELECTED')?.length || 0,
  };

  return (
    <div className="p-4 md:p-8 min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 flex items-center justify-center rounded-2xl shadow-sm"
              style={{ 
                backgroundColor: token.colorBgContainer, 
                border: `1px solid ${token.colorBorder}`,
                color: token.colorPrimary 
              }}
            >
              <ShopOutlined className="text-2xl" />
            </div>
            <div>
              <Title level={2} className="!mb-1 !text-2xl lg:!text-3xl tracking-tight" style={{ color: token.colorText }}>
                Internship Opportunities
              </Title>
              <Paragraph className="!text-sm lg:!text-base !mb-0 font-medium" style={{ color: token.colorTextSecondary }}>
                Explore and apply for internships matching your profile
              </Paragraph>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <Card 
            variant="borderless" 
            className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
            style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorder}` }}
          >
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary }}
              >
                <ShopOutlined className="text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none mb-1" style={{ color: token.colorText }}>{stats.total}</div>
                <div className="text-xs uppercase font-bold tracking-wider" style={{ color: token.colorTextTertiary }}>Available Positions</div>
              </div>
            </div>
          </Card>

          <Card 
            variant="borderless" 
            className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
            style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorder}` }}
          >
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#f3e8ff', color: '#9333ea' }} // Purple tokens
              >
                <SendOutlined className="text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none mb-1" style={{ color: token.colorText }}>{stats.applied}</div>
                <div className="text-xs uppercase font-bold tracking-wider" style={{ color: token.colorTextTertiary }}>Applications Sent</div>
              </div>
            </div>
          </Card>

          <Card 
            variant="borderless" 
            className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
            style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorder}` }}
          >
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: token.colorSuccessBg, color: token.colorSuccess }}
              >
                <CheckCircleOutlined className="text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none mb-1" style={{ color: token.colorText }}>{stats.selected}</div>
                <div className="text-xs uppercase font-bold tracking-wider" style={{ color: token.colorTextTertiary }}>Selected</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card 
          variant="borderless" 
          className="rounded-2xl shadow-sm"
          style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorder}` }}
          styles={{ body: { padding: '16px' } }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search by position or company"
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              className="max-w-md rounded-xl h-11"
              style={{ 
                backgroundColor: token.colorBgLayout, 
                borderColor: token.colorBorder 
              }}
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
            <Select
              placeholder="Location"
              className="w-40 h-11"
              onChange={(value) => {
                setFilters({ ...filters, location: value });
                setPagination({ ...pagination, current: 1 });
              }}
              allowClear
              dropdownStyle={{ borderRadius: '12px', padding: '8px' }}
            >
              <Select.Option value="Remote">Remote</Select.Option>
              <Select.Option value="Bangalore">Bangalore</Select.Option>
              <Select.Option value="Mumbai">Mumbai</Select.Option>
              <Select.Option value="Delhi">Delhi</Select.Option>
            </Select>
            <Select
              placeholder="Duration"
              className="w-40 h-11"
              onChange={(value) => {
                setFilters({ ...filters, duration: value });
                setPagination({ ...pagination, current: 1 });
              }}
              allowClear
              dropdownStyle={{ borderRadius: '12px', padding: '8px' }}
            >
              <Select.Option value="3">3 months</Select.Option>
              <Select.Option value="6">6 months</Select.Option>
              <Select.Option value="12">12 months</Select.Option>
            </Select>
          </div>
        </Card>

        {/* Table Container */}
        <Card 
          variant="borderless" 
          className="rounded-2xl shadow-sm overflow-hidden"
          style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorder}` }}
          styles={{ body: { padding: 0 } }}
        >
          <Table
            columns={columns}
            dataSource={internships.list}
            rowKey="id"
            loading={loading}
            scroll={{ x: 800 }}
            pagination={{
              ...pagination,
              total: internships.total,
              showTotal: (total) => <span style={{ color: token.colorTextSecondary }}>Total {total} opportunities</span>,
              showSizeChanger: true,
              className: "px-6 py-6",
            }}
            onChange={handleTableChange}
            className="custom-table"
            onRow={(record) => ({
              className: "transition-colors",
              style: { cursor: 'pointer' },
              onMouseEnter: (e) => e.currentTarget.style.backgroundColor = token.colorBgLayout,
              onMouseLeave: (e) => e.currentTarget.style.backgroundColor = '',
              onClick: () => navigate(`/internships/${record.id}`)
            })}
          />
        </Card>
      </div>
    </div>
  );
};

export default InternshipList;