import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Input,
  Modal,
  Form,
  Select,
  Tabs,
  Avatar,
  Empty,
  Spin,
  Timeline,
  Tooltip,
  Descriptions,
  Alert,
  Steps,
} from 'antd';
import {
  AlertOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  ReloadOutlined,
  MessageOutlined,
  FileTextOutlined,
  SendOutlined,
  HistoryOutlined,
  TeamOutlined,
  BookOutlined,
  SafetyOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  RiseOutlined,
  BankOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { debounce } from 'lodash';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import grievanceService from '../../../services/grievance.service';
import API from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import ProfileAvatar from '../../../components/common/ProfileAvatar';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// Escalation level labels
const ESCALATION_LEVELS = {
  MENTOR: { label: "Faculty Mentor", level: 1, icon: <UserOutlined />, color: "blue" },
  PRINCIPAL: { label: "Principal", level: 2, icon: <BankOutlined />, color: "orange" },
  STATE_DIRECTORATE: { label: "State Directorate", level: 3, icon: <TeamOutlined />, color: "red" },
};

const Grievances = () => {
  // Get user data from Redux auth state
  const { user, isState, isPrincipal } = useAuth();
  const userRole = user?.role;
  const institutionId = user?.institutionId;

  const [loading, setLoading] = useState(true);
  const [grievances, setGrievances] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    escalated: 0,
    resolved: 0,
    rejected: 0,
    byEscalationLevel: {
      mentor: 0,
      principal: 0,
      stateDirectorate: 0,
      notSet: 0,
    },
  });
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [escalationChain, setEscalationChain] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [respondVisible, setRespondVisible] = useState(false);
  const [escalateVisible, setEscalateVisible] = useState(false);
  const [assignVisible, setAssignVisible] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    priority: 'all',
    escalationLevel: 'all',
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [form] = Form.useForm();
  const [escalateForm] = Form.useForm();
  const [assignForm] = Form.useForm();

  // Fetch grievances
  const fetchGrievances = useCallback(async () => {
    // STATE_DIRECTORATE users don't need institutionId
    // Other roles need institutionId
    if (!isState && !institutionId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let data;
      let statsData;

      // STATE_DIRECTORATE sees ALL grievances across all institutions
      if (isState) {
        data = await grievanceService.getAll();
        statsData = await grievanceService.getStatistics(); // No institutionId
      } else {
        // PRINCIPAL and other roles see their institution's grievances
        data = await grievanceService.getByInstitution(institutionId);
        statsData = await grievanceService.getStatistics(institutionId);
      }

      setGrievances(data || []);

      setStats({
        total: statsData.total || 0,
        pending: statsData.byStatus?.pending || 0,
        inProgress: statsData.byStatus?.inProgress || 0,
        escalated: statsData.byStatus?.escalated || 0,
        resolved: statsData.byStatus?.resolved || 0,
        rejected: statsData.byStatus?.rejected || 0,
        byEscalationLevel: {
          mentor: statsData.byEscalationLevel?.mentor || 0,
          principal: statsData.byEscalationLevel?.principal || 0,
          stateDirectorate: statsData.byEscalationLevel?.stateDirectorate || 0,
          notSet: statsData.byEscalationLevel?.notSet || 0,
        },
      });

      setPagination(prev => ({ ...prev, total: data?.length || 0 }));
    } catch (error) {
      console.error('Failed to fetch grievances:', error);
      toast.error('Failed to load grievances');
    } finally {
      setLoading(false);
    }
  }, [institutionId, isState]);

  const fetchAssignableUsers = useCallback(async () => {
    if (!institutionId) return;
    try {
      const users = await grievanceService.getAssignableUsers(institutionId);
      setAssignableUsers(users || []);
    } catch (error) {
      console.error('Failed to fetch assignable users:', error);
    }
  }, [institutionId]);

  const fetchEscalationChain = async (grievanceId) => {
    try {
      const chain = await grievanceService.getEscalationChain(grievanceId);
      setEscalationChain(chain);
    } catch (error) {
      console.error("Error fetching escalation chain:", error);
    }
  };

  useEffect(() => {
    // STATE_DIRECTORATE users can fetch without institutionId
    // Other roles need institutionId
    if (isState || institutionId) {
      fetchGrievances();
      if (institutionId) {
        fetchAssignableUsers();
      }
    } else if (userRole) {
      // User role is set but conditions not met - stop loading
      setLoading(false);
    }
  }, [institutionId, isState, userRole, fetchGrievances, fetchAssignableUsers]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearchText(value);
    }, 300),
    []
  );

  // Filter grievances
  const filteredGrievances = useMemo(() => {
    let filtered = [...grievances];

    // Tab filter
    if (activeTab !== 'all') {
      if (activeTab === 'pending') {
        filtered = filtered.filter(g => g.status === 'PENDING' || g.status === 'SUBMITTED');
      } else if (activeTab === 'escalated') {
        filtered = filtered.filter(g => g.status === 'ESCALATED');
      } else {
        filtered = filtered.filter(g => g.status === activeTab.toUpperCase());
      }
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(g => g.status === filters.status);
    }

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(g => g.category === filters.category);
    }

    // Priority filter
    if (filters.priority !== 'all') {
      filtered = filtered.filter(g => g.severity === filters.priority);
    }

    // Escalation level filter
    if (filters.escalationLevel !== 'all') {
      filtered = filtered.filter(g => g.escalationLevel === filters.escalationLevel);
    }

    // Search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        g =>
          g.title?.toLowerCase().includes(search) ||
          g.student?.user?.name?.toLowerCase().includes(search) ||
          g.id?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [grievances, activeTab, filters, searchText]);

  // Status helpers
  const getStatusConfig = (status) => {
    const configs = {
      SUBMITTED: { color: 'blue', icon: <ClockCircleOutlined />, text: 'Submitted' },
      PENDING: { color: 'warning', icon: <ClockCircleOutlined />, text: 'Pending' },
      UNDER_REVIEW: { color: 'processing', icon: <ClockCircleOutlined />, text: 'Under Review' },
      IN_PROGRESS: { color: 'processing', icon: <ExclamationCircleOutlined />, text: 'In Progress' },
      ESCALATED: { color: 'error', icon: <RiseOutlined />, text: 'Escalated' },
      RESOLVED: { color: 'success', icon: <CheckCircleOutlined />, text: 'Resolved' },
      CLOSED: { color: 'default', icon: <CheckCircleOutlined />, text: 'Closed' },
      REJECTED: { color: 'error', icon: <CloseCircleOutlined />, text: 'Rejected' },
    };
    return configs[status] || configs.PENDING;
  };

  const getPriorityConfig = (priority) => {
    const configs = {
      LOW: { color: 'default', text: 'Low' },
      MEDIUM: { color: 'warning', text: 'Medium' },
      HIGH: { color: 'error', text: 'High' },
      URGENT: { color: 'magenta', text: 'Urgent' },
    };
    return configs[priority] || configs.MEDIUM;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      INTERNSHIP_RELATED: <TeamOutlined className="text-success" />,
      MENTOR_RELATED: <UserOutlined className="text-warning" />,
      INDUSTRY_RELATED: <BankOutlined className="text-primary" />,
      PAYMENT_ISSUE: <InfoCircleOutlined className="text-error" />,
      WORKPLACE_HARASSMENT: <WarningOutlined className="text-error" />,
      HARASSMENT: <WarningOutlined className="text-error" />,
      SAFETY_CONCERN: <SafetyOutlined className="text-error" />,
      OTHER: <InfoCircleOutlined className="text-text-tertiary" />,
    };
    return icons[category] || icons.OTHER;
  };

  // Handle actions
  const handleViewDetails = async (grievance) => {
    setSelectedGrievance(grievance);
    setDetailsVisible(true);
    await fetchEscalationChain(grievance.id);
  };

  const handleRespond = (grievance) => {
    setSelectedGrievance(grievance);
    form.resetFields();
    setRespondVisible(true);
  };

  const handleEscalate = (grievance) => {
    setSelectedGrievance(grievance);
    escalateForm.resetFields();
    setEscalateVisible(true);
  };

  const handleAssign = (grievance) => {
    setSelectedGrievance(grievance);
    assignForm.resetFields();
    setAssignVisible(true);
  };

  const handleSubmitResponse = async (values) => {
    try {
      await grievanceService.respond(
        selectedGrievance.id,
        values.response,
        values.status || null
      );
      toast.success('Response submitted successfully');
      setRespondVisible(false);
      fetchGrievances();
    } catch (error) {
      console.error('Failed to submit response:', error);
      toast.error('Failed to submit response');
    }
  };

  const handleSubmitEscalation = async (values) => {
    try {
      await grievanceService.escalate(selectedGrievance.id, values.reason);
      toast.success('Grievance escalated successfully');
      setEscalateVisible(false);
      setDetailsVisible(false);
      fetchGrievances();
    } catch (error) {
      console.error('Failed to escalate grievance:', error);
      toast.error(error.response?.data?.message || 'Failed to escalate grievance');
    }
  };

  const handleSubmitAssignment = async (values) => {
    try {
      await grievanceService.assign(selectedGrievance.id, values.assigneeId, values.remarks);
      toast.success('Grievance assigned successfully');
      setAssignVisible(false);
      setDetailsVisible(false);
      fetchGrievances();
    } catch (error) {
      console.error('Failed to assign grievance:', error);
      toast.error('Failed to assign grievance');
    }
  };

  const handleUpdateStatus = async (grievanceId, newStatus, remarks = null) => {
    try {
      if (newStatus === 'REJECTED') {
        const reason = window.prompt('Please provide a reason for rejection:');
        if (!reason) return;
        await grievanceService.reject(grievanceId, reason);
      } else if (newStatus === 'CLOSED') {
        await grievanceService.close(grievanceId, remarks);
      } else {
        await grievanceService.updateStatus(grievanceId, newStatus, remarks);
      }
      toast.success(`Grievance marked as ${newStatus.toLowerCase().replace('_', ' ')}`);
      setDetailsVisible(false);
      fetchGrievances();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleRefresh = () => {
    fetchGrievances();
  };

  // Base table columns
  const baseColumns = [
    {
      title: 'ID',
      key: 'id',
      width: 100,
      render: (_, record) => (
        <div>
          <Text className="font-mono font-bold text-primary text-xs">
            {record.id?.slice(-8).toUpperCase()}
          </Text>
          <div className="text-[10px] text-text-tertiary">
            {dayjs(record.createdAt).format('DD MMM')}
          </div>
        </div>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text, record) => (
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-lg bg-background-tertiary flex items-center justify-center shrink-0">
            {getCategoryIcon(record.category)}
          </div>
          <div className="min-w-0">
            <Tooltip title={text}>
              <Text className="block font-medium text-text-primary truncate">{text || 'No Title'}</Text>
            </Tooltip>
            <Tag color="default" className="text-[10px] mt-1">
              {record.category?.replace(/_/g, ' ') || 'Uncategorized'}
            </Tag>
          </div>
        </div>
      ),
    },
    // Institution column - only for STATE_DIRECTORATE
    ...(isState ? [{
      title: 'Institution',
      key: 'institution',
      width: 150,
      render: (_, record) => (
        <div>
          <Text className="block text-xs font-medium text-text-primary truncate">
            {record.student?.Institution?.name || 'Unknown Institution'}
          </Text>
          <Text className="text-[10px] text-text-tertiary">
            {record.student?.Institution?.code || ''}
          </Text>
        </div>
      ),
    }] : []),
    {
      title: 'Submitted By',
      key: 'submittedBy',
      width: 160,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <ProfileAvatar size="small" profileImage={record.student?.profileImage || record.student?.user?.profileImage} className="bg-primary/10 text-primary" />
          <div>
            <Text className="block text-sm font-medium text-text-primary">
              {record.student?.user?.name || 'Unknown'}
            </Text>
            <Text className="text-[10px] text-text-tertiary uppercase">
              Student
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (severity) => {
        const config = getPriorityConfig(severity || 'MEDIUM');
        return <Tag color={config.color} className="rounded-full px-2">{config.text}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const config = getStatusConfig(status || 'PENDING');
        return (
          <Tag icon={config.icon} color={config.color} className="rounded-full px-2">
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: 'Escalation',
      dataIndex: 'escalationLevel',
      key: 'escalationLevel',
      width: 130,
      render: (level) => {
        if (!level) {
          return (
            <Tag color="default" className="rounded-full px-2">
              <ClockCircleOutlined /> Not Set
            </Tag>
          );
        }
        const levelInfo = ESCALATION_LEVELS[level] || {};
        return (
          <Tooltip title={`Level ${levelInfo.level || 1}`}>
            <Tag color={levelInfo.color || 'blue'} className="rounded-full px-2">
              {levelInfo.icon} {levelInfo.label || level}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Assigned To',
      key: 'assignedTo',
      width: 140,
      render: (_, record) => record.assignedTo ? (
        <div className="flex items-center gap-1">
          <ProfileAvatar size="small" profileImage={record.assignedTo.profileImage} />
          <Text className="text-xs">{record.assignedTo.name}</Text>
        </div>
      ) : (
        <Tag color="warning" className="text-xs">Unassigned</Tag>
      ),
    },
    {
      title: 'Age',
      key: 'age',
      width: 80,
      render: (_, record) => (
        <Tooltip title={dayjs(record.createdAt).format('DD MMM YYYY HH:mm')}>
          <Text className="text-xs text-text-secondary">
            {dayjs(record.createdAt).fromNow(true)}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          {!['RESOLVED', 'CLOSED', 'REJECTED'].includes(record.status) && (
            <>
              <Tooltip title="Respond">
                <Button
                  type="text"
                  size="small"
                  icon={<MessageOutlined />}
                  onClick={() => handleRespond(record)}
                />
              </Tooltip>
              <Tooltip title="Escalate">
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  onClick={() => handleEscalate(record)}
                  className="text-warning"
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  // Small Stat Card Component
  const StatCard = ({ title, value, icon, color, subtitle }) => (
    <Card
      className="h-full border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 rounded-xl"
      styles={{ body: { padding: '16px 12px' } }}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center mb-2"
          style={{ backgroundColor: `${color}15` }}
        >
          {React.cloneElement(icon, { style: { fontSize: '18px', color } })}
        </div>
        <Text className="text-xs font-medium text-gray-600 mb-1">{title}</Text>
        <span style={{ fontSize: '26px', fontWeight: 700, color, lineHeight: 1 }}>
          {value}
        </span>
        {subtitle && <Text className="text-[10px] text-gray-400 mt-1">{subtitle}</Text>}
      </div>
    </Card>
  );

  // Tab items
  const tabItems = [
    { key: 'all', label: <span className="flex items-center gap-2"><AlertOutlined />All ({stats.total})</span> },
    { key: 'pending', label: <span className="flex items-center gap-2"><ClockCircleOutlined />Pending ({stats.pending})</span> },
    { key: 'escalated', label: <span className="flex items-center gap-2"><RiseOutlined />Escalated ({stats.escalated})</span> },
    { key: 'in_progress', label: <span className="flex items-center gap-2"><ExclamationCircleOutlined />In Progress ({stats.inProgress})</span> },
    { key: 'resolved', label: <span className="flex items-center gap-2"><CheckCircleOutlined />Resolved ({stats.resolved})</span> },
  ];

  // Render escalation chain
  const renderEscalationChain = () => {
    if (!escalationChain) return null;

    const { escalationChain: chain, currentLevel, canEscalate, nextLevel } = escalationChain;

    return (
      <Card size="small" title={
        <Space>
          <RiseOutlined />
          <span>Escalation Progress</span>
        </Space>
      } className="mb-4">
        <Steps
          size="small"
          current={ESCALATION_LEVELS[currentLevel]?.level - 1 || 0}
          items={chain?.map((item) => ({
            title: ESCALATION_LEVELS[item.level]?.label || item.level,
            description: item.isCurrentLevel ? "Current" : item.isPastLevel ? "Done" : "Pending",
            status: item.isCurrentLevel ? "process" : item.isPastLevel ? "finish" : "wait",
          })) || []}
        />
        {canEscalate && (
          <Alert
            type="info"
            className="mt-3"
            showIcon
            title={`Can escalate to ${ESCALATION_LEVELS[nextLevel]?.label || nextLevel}`}
          />
        )}
      </Card>
    );
  };

  if (loading && grievances.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">Loading grievances...</Text>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen !space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            {isState ? 'State Grievance Dashboard' : 'Grievance Management'}
          </h1>
          <Text className="text-text-tertiary text-sm">
            {isState ? 'Monitor grievances across all institutions' : 'Track and resolve student grievances'}
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={loading}
          className="rounded-lg"
        >
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Total" value={stats.total} icon={<AlertOutlined />} color="#3b82f6" subtitle="All grievances" />
        <StatCard title="Pending" value={stats.pending} icon={<ClockCircleOutlined />} color="#f59e0b" subtitle="Awaiting action" />
        <StatCard title="Escalated" value={stats.escalated} icon={<RiseOutlined />} color="#ef4444" subtitle="Needs attention" />
        <StatCard title="In Progress" value={stats.inProgress} icon={<ExclamationCircleOutlined />} color="#8b5cf6" subtitle="Being handled" />
        <StatCard title="Resolved" value={stats.resolved} icon={<CheckCircleOutlined />} color="#22c55e" subtitle="Completed" />
        <StatCard title="Rejected" value={stats.rejected} icon={<CloseCircleOutlined />} color="#6b7280" subtitle="Closed" />
      </div>

      {/* Info alert for active students only */}
      <Alert
        type="info"
        message="Active Students Only"
        description="Grievance statistics shown include only grievances from currently active students. Grievances from inactive or withdrawn students are excluded."
        showIcon
        className="mb-4"
      />

      {/* Alert for escalated grievances */}
      {stats.escalated > 0 && (
        <Alert
          message={`${stats.escalated} escalated grievances need immediate attention`}
          type="error"
          showIcon
          icon={<RiseOutlined />}
          className="rounded-lg"
          closable
        />
      )}

      {/* Filters */}
      <Card className="rounded-xl border-border shadow-sm" styles={{ body: { padding: '12px 16px' } }}>
        <div className="flex flex-wrap gap-3 items-center">
          <Input
            placeholder="Search by title or student name..."
            prefix={<SearchOutlined className="text-text-tertiary" />}
            onChange={(e) => debouncedSearch(e.target.value)}
            className="w-full md:w-64 rounded-lg"
            allowClear
          />
          <Select
            value={filters.category}
            onChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
            className="w-full md:w-44"
            placeholder="Category"
          >
            <Select.Option value="all">All Categories</Select.Option>
            <Select.Option value="INTERNSHIP_RELATED">Internship</Select.Option>
            <Select.Option value="MENTOR_RELATED">Mentor</Select.Option>
            <Select.Option value="INDUSTRY_RELATED">Industry</Select.Option>
            <Select.Option value="PAYMENT_ISSUE">Payment</Select.Option>
            <Select.Option value="HARASSMENT">Harassment</Select.Option>
            <Select.Option value="SAFETY_CONCERN">Safety</Select.Option>
            <Select.Option value="OTHER">Other</Select.Option>
          </Select>
          <Select
            value={filters.priority}
            onChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}
            className="w-full md:w-36"
            placeholder="Severity"
          >
            <Select.Option value="all">All Severity</Select.Option>
            <Select.Option value="LOW">Low</Select.Option>
            <Select.Option value="MEDIUM">Medium</Select.Option>
            <Select.Option value="HIGH">High</Select.Option>
            <Select.Option value="URGENT">Urgent</Select.Option>
          </Select>
          <Select
            value={filters.escalationLevel}
            onChange={(value) => setFilters(prev => ({ ...prev, escalationLevel: value }))}
            className="w-full md:w-44"
            placeholder="Escalation Level"
          >
            <Select.Option value="all">All Levels</Select.Option>
            <Select.Option value="MENTOR">Mentor Level</Select.Option>
            <Select.Option value="PRINCIPAL">Principal Level</Select.Option>
            <Select.Option value="STATE_DIRECTORATE">State Level</Select.Option>
          </Select>
        </div>
      </Card>

      {/* Tabs & Table */}
      <Card className="rounded-xl border-border shadow-sm" styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="!px-4 pt-3"
        />
        <Table
          columns={baseColumns}
          dataSource={filteredGrievances}
          rowKey="id"
          loading={loading}
          scroll={{ x: isState ? 1400 : 1200 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: filteredGrievances.length,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} grievances`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
          locale={{
            emptyText: <Empty description="No grievances found" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
          className="custom-table"
        />
      </Card>

      {/* Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-text-primary">
            <FileTextOutlined className="text-primary" />
            <span>Grievance Details</span>
          </div>
        }
        open={detailsVisible}
        onCancel={() => {
          setDetailsVisible(false);
          setEscalationChain(null);
        }}
        width={900}
        footer={
          selectedGrievance && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(selectedGrievance.status) ? (
            <Space>
              <Button onClick={() => setDetailsVisible(false)}>Close</Button>
              <Button
                icon={<UserOutlined />}
                onClick={() => handleAssign(selectedGrievance)}
              >
                Assign
              </Button>
              <Button
                icon={<ArrowUpOutlined />}
                onClick={() => handleEscalate(selectedGrievance)}
                className="text-warning border-warning"
              >
                Escalate
              </Button>
              <Button
                danger
                onClick={() => handleUpdateStatus(selectedGrievance.id, 'REJECTED')}
              >
                Reject
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleUpdateStatus(selectedGrievance.id, 'RESOLVED')}
              >
                Resolve
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedGrievance && (
          <div className="!space-y-4">
            {/* Status Banner */}
            <Alert
              title={`Status: ${getStatusConfig(selectedGrievance.status).text}`}
              type={
                selectedGrievance.status === 'RESOLVED' || selectedGrievance.status === 'CLOSED' ? 'success' :
                selectedGrievance.status === 'ESCALATED' || selectedGrievance.status === 'REJECTED' ? 'error' : 'info'
              }
              showIcon
              icon={getStatusConfig(selectedGrievance.status).icon}
            />

            {/* Escalation Chain */}
            {renderEscalationChain()}

            {/* Details */}
            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
              <Descriptions.Item label="Title" span={2}>
                <Text strong>{selectedGrievance.title}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                <Tag color="blue">{selectedGrievance.category?.replace(/_/g, ' ')}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Severity">
                <Tag color={getPriorityConfig(selectedGrievance.severity).color}>
                  {selectedGrievance.severity}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Escalation Level">
                <Tag color={ESCALATION_LEVELS[selectedGrievance.escalationLevel]?.color}>
                  {ESCALATION_LEVELS[selectedGrievance.escalationLevel]?.label || selectedGrievance.escalationLevel}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Submitted">
                {dayjs(selectedGrievance.submittedDate || selectedGrievance.createdAt).format('DD MMM YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Student" span={2}>
                <Space>
                  <ProfileAvatar size="small" profileImage={selectedGrievance.student?.profileImage || selectedGrievance.student?.user?.profileImage} />
                  <span>{selectedGrievance.student?.user?.name || 'Unknown'}</span>
                  {selectedGrievance.student?.user?.email && (
                    <Text type="secondary">({selectedGrievance.student.user.email})</Text>
                  )}
                </Space>
              </Descriptions.Item>
              {selectedGrievance.assignedTo && (
                <Descriptions.Item label="Assigned To" span={2}>
                  <Space>
                    <ProfileAvatar size="small" profileImage={selectedGrievance.assignedTo.profileImage} />
                    <span>{selectedGrievance.assignedTo.name}</span>
                    <Tag>{selectedGrievance.assignedTo.role?.replace(/_/g, ' ')}</Tag>
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Description */}
            <Card size="small" title="Description">
              <Paragraph>{selectedGrievance.description}</Paragraph>
            </Card>

            {/* Resolution */}
            {selectedGrievance.resolution && (
              <Card
                size="small"
                title={selectedGrievance.status === 'REJECTED' ? 'Rejection Reason' : 'Resolution'}
                className={selectedGrievance.status === 'REJECTED' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}
              >
                <Paragraph>{selectedGrievance.resolution}</Paragraph>
              </Card>
            )}

            {/* Status History */}
            {selectedGrievance.statusHistory && selectedGrievance.statusHistory.length > 0 && (
              <Card size="small" title={<><HistoryOutlined /> Status History</>}>
                <Timeline
                  items={selectedGrievance.statusHistory.map((history) => ({
                    color: history.action === 'ESCALATED' ? 'red' :
                           history.action === 'RESOLVED' ? 'green' : 'blue',
                    children: (
                      <div>
                        <Text strong>
                          {history.action === 'SUBMITTED' && 'Submitted'}
                          {history.action === 'ASSIGNED' && `Assigned to ${history.changedBy?.name}`}
                          {history.action === 'ESCALATED' && `Escalated to ${ESCALATION_LEVELS[history.escalationLevel]?.label}`}
                          {history.action === 'RESPONDED' && 'Response Added'}
                          {history.action === 'STATUS_CHANGED' && `Status: ${history.toStatus?.replace(/_/g, ' ')}`}
                          {history.action === 'REJECTED' && 'Rejected'}
                        </Text>
                        <Text type="secondary" className="ml-2 text-xs">
                          {dayjs(history.createdAt).format('DD MMM YYYY HH:mm')}
                        </Text>
                        {history.remarks && (
                          <Paragraph type="secondary" className="mt-1 mb-0 text-sm">
                            {history.remarks}
                          </Paragraph>
                        )}
                      </div>
                    ),
                  }))}
                />
              </Card>
            )}
          </div>
        )}
      </Modal>

      {/* Respond Modal */}
      <Modal
        title={<><MessageOutlined className="text-success mr-2" />Respond to Grievance</>}
        open={respondVisible}
        onCancel={() => setRespondVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitResponse}>
          {selectedGrievance && (
            <Alert
              title={selectedGrievance.title}
              type="info"
              className="mb-4"
            />
          )}
          <Form.Item name="status" label="Update Status">
            <Select placeholder="Optionally update status">
              <Select.Option value="IN_PROGRESS">Mark In Progress</Select.Option>
              <Select.Option value="RESOLVED">Mark as Resolved</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="response"
            label="Response"
            rules={[{ required: true, message: 'Please enter your response' }]}
          >
            <TextArea rows={4} placeholder="Enter your response..." />
          </Form.Item>
          <Form.Item className="!mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setRespondVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
                Submit
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Escalate Modal */}
      <Modal
        title={<><ArrowUpOutlined className="text-warning mr-2" />Escalate Grievance</>}
        open={escalateVisible}
        onCancel={() => setEscalateVisible(false)}
        footer={null}
      >
        <Form form={escalateForm} layout="vertical" onFinish={handleSubmitEscalation}>
          {selectedGrievance && (
            <Alert
              title={`Escalating: ${selectedGrievance.title}`}
              description={`Current level: ${ESCALATION_LEVELS[selectedGrievance.escalationLevel]?.label || selectedGrievance.escalationLevel}`}
              type="warning"
              className="mb-4"
            />
          )}
          <Form.Item
            name="reason"
            label="Reason for Escalation"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <TextArea rows={4} placeholder="Why is this being escalated?" />
          </Form.Item>
          <Form.Item className="!mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setEscalateVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" icon={<ArrowUpOutlined />}>
                Escalate
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Assign Modal */}
      <Modal
        title={<><UserOutlined className="text-primary mr-2" />Assign Grievance</>}
        open={assignVisible}
        onCancel={() => setAssignVisible(false)}
        footer={null}
      >
        <Form form={assignForm} layout="vertical" onFinish={handleSubmitAssignment}>
          {selectedGrievance && (
            <Alert
              title={selectedGrievance.title}
              type="info"
              className="mb-4"
            />
          )}
          <Form.Item
            name="assigneeId"
            label="Assign To"
            rules={[{ required: true, message: 'Please select someone' }]}
          >
            <Select placeholder="Select person to assign" showSearch optionFilterProp="children">
              {assignableUsers.map(user => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name} - {user.role?.replace(/_/g, ' ')}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={2} placeholder="Optional remarks..." />
          </Form.Item>
          <Form.Item className="!mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setAssignVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Assign
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Grievances;
