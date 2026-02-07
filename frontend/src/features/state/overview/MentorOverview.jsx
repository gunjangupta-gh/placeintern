import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, Tooltip, Space, Spin, Alert, Progress, Statistic, Row, Col } from 'antd';
import {
  GlobalOutlined,
  TeamOutlined,
  UserOutlined,
  BankOutlined,
  SwapOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { stateService } from '../../../services/state.service';

const { Title, Text } = Typography;

/**
 * State-wide Mentor Overview
 * Shows cross-institutional mentor statistics for all institutions
 */
const MentorOverview = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await stateService.getInstitutionMentorOverview();
      setData(response?.data || []);
    } catch (err) {
      console.error('Error fetching mentor overview:', err);
      setError(err?.message || 'Failed to fetch mentor overview');
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals across all institutions
  const totals = React.useMemo(() => {
    if (!data || data.length === 0) return null;

    return data.reduce((acc, inst) => ({
      internal: {
        mentors: acc.internal.mentors + inst.internal.mentors,
        students: acc.internal.students + inst.internal.students,
        assignments: acc.internal.assignments + inst.internal.assignments,
      },
      incomingExternal: {
        mentors: acc.incomingExternal.mentors + inst.incomingExternal.mentors,
        students: acc.incomingExternal.students + inst.incomingExternal.students,
        assignments: acc.incomingExternal.assignments + inst.incomingExternal.assignments,
      },
      outgoingExternal: {
        mentors: acc.outgoingExternal.mentors + inst.outgoingExternal.mentors,
        students: acc.outgoingExternal.students + inst.outgoingExternal.students,
        assignments: acc.outgoingExternal.assignments + inst.outgoingExternal.assignments,
      },
    }), {
      internal: { mentors: 0, students: 0, assignments: 0 },
      incomingExternal: { mentors: 0, students: 0, assignments: 0 },
      outgoingExternal: { mentors: 0, students: 0, assignments: 0 },
    });
  }, [data]);

  const columns = [
    {
      title: 'Institution',
      dataIndex: 'institutionName',
      key: 'institution',
      fixed: 'left',
      width: 220,
      render: (name, record) => (
        <div className="flex items-center gap-2">
          <BankOutlined className="text-primary" />
          <div className="min-w-0">
            <Text strong className="block truncate" title={name}>{name}</Text>
            <Text className="text-xs text-gray-500">{record.institutionCode}</Text>
          </div>
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="Internal: Their faculty mentoring their students">
          <Space size={4}>
            <CheckCircleOutlined className="text-green-600" />
            <span>Internal</span>
          </Space>
        </Tooltip>
      ),
      key: 'internal',
      width: 150,
      align: 'center',
      children: [
        {
          title: 'Mentors',
          dataIndex: ['internal', 'mentors'],
          key: 'internalMentors',
          width: 75,
          align: 'center',
          render: (value) => <Text strong className="text-green-700">{value || 0}</Text>,
        },
        {
          title: 'Students',
          dataIndex: ['internal', 'students'],
          key: 'internalStudents',
          width: 75,
          align: 'center',
          render: (value) => <Text className="text-green-600">{value || 0}</Text>,
        },
      ],
    },
    {
      title: (
        <Tooltip title="Incoming: External faculty mentoring their students">
          <Space size={4}>
            <ArrowLeftOutlined className="text-blue-600" />
            <span>Incoming</span>
          </Space>
        </Tooltip>
      ),
      key: 'incoming',
      width: 180,
      align: 'center',
      children: [
        {
          title: 'Mentors',
          dataIndex: ['incomingExternal', 'mentors'],
          key: 'incomingMentors',
          width: 60,
          align: 'center',
          render: (value) => (
            value > 0 ? (
              <Tag color="blue" className="m-0">{value}</Tag>
            ) : <Text className="text-gray-400">0</Text>
          ),
        },
        {
          title: 'Students',
          dataIndex: ['incomingExternal', 'students'],
          key: 'incomingStudents',
          width: 60,
          align: 'center',
          render: (value) => (
            value > 0 ? (
              <Text className="text-blue-600">{value}</Text>
            ) : <Text className="text-gray-400">0</Text>
          ),
        },
        {
          title: 'From',
          dataIndex: ['incomingExternal', 'fromInstitutions'],
          key: 'fromInstitutions',
          width: 60,
          align: 'center',
          render: (value) => (
            value > 0 ? (
              <Tooltip title={`From ${value} institution(s)`}>
                <Tag color="purple" className="m-0 text-xs">{value}</Tag>
              </Tooltip>
            ) : <Text className="text-gray-400">-</Text>
          ),
        },
      ],
    },
    {
      title: (
        <Tooltip title="Outgoing: Their faculty mentoring external students">
          <Space size={4}>
            <ArrowRightOutlined className="text-orange-600" />
            <span>Outgoing</span>
          </Space>
        </Tooltip>
      ),
      key: 'outgoing',
      width: 180,
      align: 'center',
      children: [
        {
          title: 'Mentors',
          dataIndex: ['outgoingExternal', 'mentors'],
          key: 'outgoingMentors',
          width: 60,
          align: 'center',
          render: (value) => (
            value > 0 ? (
              <Tag color="orange" className="m-0">{value}</Tag>
            ) : <Text className="text-gray-400">0</Text>
          ),
        },
        {
          title: 'Students',
          dataIndex: ['outgoingExternal', 'students'],
          key: 'outgoingStudents',
          width: 60,
          align: 'center',
          render: (value) => (
            value > 0 ? (
              <Text className="text-orange-600">{value}</Text>
            ) : <Text className="text-gray-400">0</Text>
          ),
        },
        {
          title: 'To',
          dataIndex: ['outgoingExternal', 'toInstitutions'],
          key: 'toInstitutions',
          width: 60,
          align: 'center',
          render: (value) => (
            value > 0 ? (
              <Tooltip title={`To ${value} institution(s)`}>
                <Tag color="purple" className="m-0 text-xs">{value}</Tag>
              </Tooltip>
            ) : <Text className="text-gray-400">-</Text>
          ),
        },
      ],
    },
    {
      title: (
        <Tooltip title="Total unique mentors and students for this institution">
          <Space size={4}>
            <TeamOutlined />
            <span>Totals</span>
          </Space>
        </Tooltip>
      ),
      key: 'totals',
      width: 150,
      align: 'center',
      children: [
        {
          title: 'Mentors',
          dataIndex: ['totals', 'mentors'],
          key: 'totalMentors',
          width: 75,
          align: 'center',
          render: (value) => <Text strong>{value || 0}</Text>,
        },
        {
          title: 'Students',
          dataIndex: ['totals', 'students'],
          key: 'totalStudents',
          width: 75,
          align: 'center',
          render: (value) => <Text strong>{value || 0}</Text>,
        },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" tip="Loading mentor overview..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="Failed to load data"
        description={error}
        showIcon
        className="m-6"
      />
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header - Compact */}
      <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <GlobalOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <div>
            <Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
              Cross-Institutional Mentor Overview
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              View mentor assignments across all institutions
            </Text>
          </div>
        </div>
      </div>

      {/* Summary Cards - Compact */}
      {totals && (
        <Row gutter={12}>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small" className="border-l-4 border-green-500 rounded-lg" bodyStyle={{ padding: '12px' }}>
              <Statistic
                title={<span className="text-xs">Internal Mentoring</span>}
                value={totals.internal.students}
                prefix={<CheckCircleOutlined className="text-green-600" style={{ fontSize: 16 }} />}
                suffix={<Text className="text-xs text-gray-500">students</Text>}
                valueStyle={{ color: '#16a34a', fontSize: 20 }}
              />
              <Text className="text-[10px] text-gray-500 block mt-1">
                {totals.internal.mentors} mentors • {totals.internal.assignments} assignments
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small" className="border-l-4 border-blue-500 rounded-lg" bodyStyle={{ padding: '12px' }}>
              <Statistic
                title={<span className="text-xs">Incoming External</span>}
                value={totals.incomingExternal.students}
                prefix={<ArrowLeftOutlined className="text-blue-600" style={{ fontSize: 16 }} />}
                suffix={<Text className="text-xs text-gray-500">students</Text>}
                valueStyle={{ color: '#2563eb', fontSize: 20 }}
              />
              <Text className="text-[10px] text-gray-500 block mt-1">
                {totals.incomingExternal.mentors} external mentors helping
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small" className="border-l-4 border-orange-500 rounded-lg" bodyStyle={{ padding: '12px' }}>
              <Statistic
                title={<span className="text-xs">Outgoing External</span>}
                value={totals.outgoingExternal.students}
                prefix={<ArrowRightOutlined className="text-orange-600" style={{ fontSize: 16 }} />}
                suffix={<Text className="text-xs text-gray-500">students</Text>}
                valueStyle={{ color: '#ea580c', fontSize: 20 }}
              />
              <Text className="text-[10px] text-gray-500 block mt-1">
                {totals.outgoingExternal.mentors} mentors helping others
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small" className="border-l-4 border-purple-500 rounded-lg" bodyStyle={{ padding: '12px' }}>
              <Statistic
                title={<span className="text-xs">Cross-Institutional</span>}
                value={totals.incomingExternal.students + totals.outgoingExternal.students}
                prefix={<SwapOutlined className="text-purple-600" style={{ fontSize: 16 }} />}
                suffix={<Text className="text-xs text-gray-500">total</Text>}
                valueStyle={{ color: '#9333ea', fontSize: 20 }}
              />
              <Text className="text-[10px] text-gray-500 block mt-1">
                Collaborative mentoring
              </Text>
            </Card>
          </Col>
        </Row>
      )}

      {/* Info Alert - Compact */}
      <Alert
        type="info"
        message={<span className="text-xs font-semibold">Understanding the Data</span>}
        description={
          <ul className="list-disc list-inside space-y-0.5 mt-1 text-xs">
            <li><strong>Internal:</strong> Institution's faculty mentoring their own students</li>
            <li><strong>Incoming:</strong> External faculty helping mentor students</li>
            <li><strong>Outgoing:</strong> Faculty mentoring students from other institutions</li>
            <li><strong>Totals:</strong> Unique counts (mentor may appear in both categories)</li>
          </ul>
        }
        showIcon
        className="border-blue-200 bg-blue-50 rounded-lg"
      />

      {/* Table */}
      <Card className="shadow-sm">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="institutionId"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} institutions`,
          }}
          scroll={{ x: 1000 }}
          size="small"
          bordered
        />
      </Card>
    </div>
  );
};

export default MentorOverview;
