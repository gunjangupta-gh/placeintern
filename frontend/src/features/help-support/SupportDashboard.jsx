import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Typography,
  Drawer,
  Timeline,
  Divider,
  Statistic,
  Spin,
  Avatar,
  Tooltip,
  Badge,
  DatePicker,
  Popconfirm,
  Tabs,
  Checkbox,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  SearchOutlined,
  SendOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  UserOutlined,
  MessageOutlined,
  ReloadOutlined,
  TeamOutlined,
  FolderOpenOutlined,
  SolutionOutlined,
  AlertOutlined,
  InboxOutlined,
  CheckSquareOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { helpSupportService, SUPPORT_CATEGORIES, TICKET_STATUS, TICKET_PRIORITY } from '../../services/helpSupport.service';
import { useAuth } from '../../hooks/useAuth';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const SupportDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [assignableUsers, setAssignableUsers] = useState([]);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [priorityFilter, setPriorityFilter] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  // Ticket detail drawer
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(false);

  // Forms
  const [replyForm] = Form.useForm();
  const [submittingReply, setSubmittingReply] = useState(false);

  // Modals
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [assignForm] = Form.useForm();
  const [resolveForm] = Form.useForm();
  const [submittingAction, setSubmittingAction] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (statusFilter) filters.status = statusFilter;
      if (categoryFilter) filters.category = categoryFilter;
      if (priorityFilter) filters.priority = priorityFilter;
      if (dateRange && dateRange[0]) filters.fromDate = dateRange[0].toISOString();
      if (dateRange && dateRange[1]) filters.toDate = dateRange[1].toISOString();

      const [ticketsData, statsData, usersData] = await Promise.all([
        helpSupportService.getAllTickets(filters),
        helpSupportService.getTicketStatistics(),
        helpSupportService.getAssignableUsers(),
      ]);

      setTickets(ticketsData);
      setStatistics(statsData);
      setAssignableUsers(usersData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load support data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, priorityFilter, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter tickets by search
  const filteredTickets = tickets.filter((ticket) => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      ticket.subject.toLowerCase().includes(search) ||
      ticket.ticketNumber.toLowerCase().includes(search) ||
      ticket.submitterName?.toLowerCase().includes(search) ||
      ticket.description.toLowerCase().includes(search)
    );
  });

  // View ticket details
  const handleViewTicket = async (ticketId) => {
    setLoadingTicket(true);
    setDrawerVisible(true);
    try {
      const ticket = await helpSupportService.getTicketById(ticketId);
      setSelectedTicket(ticket);
    } catch (error) {
      console.error('Failed to fetch ticket:', error);
      toast.error('Failed to load ticket details');
    } finally {
      setLoadingTicket(false);
    }
  };

  // Submit reply
  const handleSubmitReply = async (values) => {
    if (!selectedTicket) return;

    setSubmittingReply(true);
    try {
      await helpSupportService.respondToTicket(
        selectedTicket.id,
        values.message,
        [],
        values.isInternal || false
      );
      toast.success('Reply sent successfully');
      replyForm.resetFields();
      const updatedTicket = await helpSupportService.getTicketById(selectedTicket.id);
      setSelectedTicket(updatedTicket);
      fetchData();
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Assign ticket
  const handleAssignTicket = async (values) => {
    if (!selectedTicket) return;

    setSubmittingAction(true);
    try {
      await helpSupportService.assignTicket(selectedTicket.id, values.assigneeId, values.remarks);
      toast.success('Ticket assigned successfully');
      setAssignModalVisible(false);
      assignForm.resetFields();
      const updatedTicket = await helpSupportService.getTicketById(selectedTicket.id);
      setSelectedTicket(updatedTicket);
      fetchData();
    } catch (error) {
      console.error('Failed to assign ticket:', error);
      toast.error('Failed to assign ticket');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Resolve ticket
  const handleResolveTicket = async (values) => {
    if (!selectedTicket) return;

    setSubmittingAction(true);
    try {
      await helpSupportService.resolveTicket(selectedTicket.id, values.resolution, values.remarks);
      toast.success('Ticket resolved successfully');
      setResolveModalVisible(false);
      resolveForm.resetFields();
      const updatedTicket = await helpSupportService.getTicketById(selectedTicket.id);
      setSelectedTicket(updatedTicket);
      fetchData();
    } catch (error) {
      console.error('Failed to resolve ticket:', error);
      toast.error('Failed to resolve ticket');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Close ticket
  const handleCloseTicket = async () => {
    if (!selectedTicket) return;

    try {
      await helpSupportService.closeTicket(selectedTicket.id);
      toast.success('Ticket closed successfully');
      const updatedTicket = await helpSupportService.getTicketById(selectedTicket.id);
      setSelectedTicket(updatedTicket);
      fetchData();
    } catch (error) {
      console.error('Failed to close ticket:', error);
      toast.error('Failed to close ticket');
    }
  };

  // Update status
  const handleUpdateStatus = async (status) => {
    if (!selectedTicket) return;

    try {
      await helpSupportService.updateTicketStatus(selectedTicket.id, status);
      toast.success('Status updated successfully');
      const updatedTicket = await helpSupportService.getTicketById(selectedTicket.id);
      setSelectedTicket(updatedTicket);
      fetchData();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  // Get status tag
  const getStatusTag = (status) => {
    const statusInfo = TICKET_STATUS[status] || { label: status, color: 'default' };
    return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>;
  };

  // Get priority tag
  const getPriorityTag = (priority) => {
    const priorityInfo = TICKET_PRIORITY[priority] || { label: priority, color: 'default' };
    return <Tag color={priorityInfo.color}>{priorityInfo.label}</Tag>;
  };

  // Get category info
  const getCategoryInfo = (category) => {
    return SUPPORT_CATEGORIES[category] || { label: category, color: 'default' };
  };

  // Table columns
  const columns = [
    {
      title: 'Ticket #',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      width: 150,
      render: (text) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>,
      sorter: (a, b) => a.ticketNumber.localeCompare(b.ticketNumber),
    },
    {
      title: 'Submitter',
      key: 'submitter',
      width: 150,
      render: (_, record) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <Text strong style={{ display: 'block', lineHeight: 1.2 }}>{record.submitterName}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.submitterRole}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (category) => (
        <Tag color={getCategoryInfo(category).color}>
          {getCategoryInfo(category).label}
        </Tag>
      ),
      filters: Object.values(SUPPORT_CATEGORIES).map(c => ({ text: c.label, value: c.value })),
      onFilter: (value, record) => record.category === value,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => getPriorityTag(priority),
      filters: Object.values(TICKET_PRIORITY).map(p => ({ text: p.label, value: p.value })),
      onFilter: (value, record) => record.priority === value,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getStatusTag(status),
      filters: Object.values(TICKET_STATUS).map(s => ({ text: s.label, value: s.value })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Assigned To',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 130,
      render: (assignee) => assignee ? (
        <Text>{assignee.name}</Text>
      ) : (
        <Tag color="warning">Unassigned</Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => (
        <Tooltip title={dayjs(date).format('DD MMM YYYY, HH:mm')}>
          {dayjs(date).fromNow()}
        </Tooltip>
      ),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Button type="link" onClick={() => handleViewTicket(record.id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm mr-3">
              <SolutionOutlined className="text-lg" />
            </div>
            <div>
              <Title level={2} className="mb-0 text-text-primary text-2xl">
                Support Dashboard
              </Title>
              <Paragraph className="text-text-secondary text-sm mb-0">
                Manage and resolve support tickets efficiently
              </Paragraph>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchData}
              loading={loading}
              className="rounded-xl h-10 border-border text-text-secondary hover:text-text-primary hover:border-primary"
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Card size="small" className="rounded-xl border-border shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                  <InboxOutlined className="text-lg" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">{statistics.total}</div>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary">Total Tickets</div>
                </div>
              </div>
            </Card>

            <Card size="small" className="rounded-xl border-border shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-warning/10 text-warning">
                  <FolderOpenOutlined className="text-lg" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">{statistics.byStatus?.open || 0}</div>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary">Open</div>
                </div>
              </div>
            </Card>

            <Card size="small" className="rounded-xl border-border shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-500">
                  <ClockCircleOutlined className="text-lg" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">{statistics.byStatus?.inProgress || 0}</div>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary">In Progress</div>
                </div>
              </div>
            </Card>

            <Card size="small" className="rounded-xl border-border shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-success/10 text-success">
                  <CheckCircleOutlined className="text-lg" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">{statistics.byStatus?.resolved || 0}</div>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary">Resolved</div>
                </div>
              </div>
            </Card>

            <Card size="small" className="rounded-xl border-border shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-error/10 text-error">
                  <AlertOutlined className="text-lg" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">{statistics.summary?.unassigned || 0}</div>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary">Unassigned</div>
                </div>
              </div>
            </Card>

            <Card size="small" className="rounded-xl border-border shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-500">
                  <ClockCircleOutlined className="text-lg" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">{statistics.summary?.recentWeek || 0}</div>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary">This Week</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="rounded-2xl border-border shadow-sm" styles={{ body: { padding: '16px' } }}>
          <div className="flex flex-wrap items-center gap-4">
            <Input
              placeholder="Search tickets..."
              prefix={<SearchOutlined className="text-text-tertiary" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="max-w-md rounded-lg h-10 bg-background border-border"
              allowClear
            />
            <Select
              placeholder="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-40 h-10 rounded-lg"
              allowClear
            >
              {Object.values(TICKET_STATUS).map((status) => (
                <Select.Option key={status.value} value={status.value}>
                  {status.label}
                </Select.Option>
              ))}
            </Select>
            <Select
              placeholder="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              className="w-44 h-10 rounded-lg"
              allowClear
            >
              {Object.values(SUPPORT_CATEGORIES).map((cat) => (
                <Select.Option key={cat.value} value={cat.value}>
                  {cat.label}
                </Select.Option>
              ))}
            </Select>
            <Select
              placeholder="Priority"
              value={priorityFilter}
              onChange={setPriorityFilter}
              className="w-36 h-10 rounded-lg"
              allowClear
            >
              {Object.values(TICKET_PRIORITY).map((p) => (
                <Select.Option key={p.value} value={p.value}>
                  {p.label}
                </Select.Option>
              ))}
            </Select>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              className="w-64 h-10 rounded-lg border-border"
            />
            <Button
              onClick={() => {
                setSearchText('');
                setStatusFilter(null);
                setCategoryFilter(null);
                setPriorityFilter(null);
                setDateRange(null);
              }}
              className="rounded-lg h-10 border-border text-text-secondary hover:text-text-primary"
            >
              Clear Filters
            </Button>
          </div>
        </Card>

        {/* Tickets Table */}
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
          <Table
            columns={columns}
            dataSource={filteredTickets}
            rowKey="id"
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} tickets`,
              className: "px-6 py-4",
            }}
            size="middle"
            className="custom-table"
          />
        </Card>

        {/* Ticket Detail Drawer */}
        <Drawer
          title={
            selectedTicket ? (
              <div className="flex items-center gap-3">
                <Text strong className="text-lg text-text-primary">{selectedTicket.ticketNumber}</Text>
                {getStatusTag(selectedTicket.status)}
              </div>
            ) : 'Ticket Details'
          }
          size="large"
          open={drawerVisible}
          onClose={() => {
            setDrawerVisible(false);
            setSelectedTicket(null);
            replyForm.resetFields();
          }}
          extra={
            selectedTicket && !['CLOSED'].includes(selectedTicket.status) && (
              <Space>
                <Button onClick={() => setAssignModalVisible(true)} className="rounded-lg h-9">
                  <TeamOutlined /> Assign
                </Button>
                {!['RESOLVED', 'CLOSED'].includes(selectedTicket.status) && (
                  <Button type="primary" onClick={() => setResolveModalVisible(true)} className="rounded-lg h-9 bg-success border-0">
                    <CheckCircleOutlined /> Resolve
                  </Button>
                )}
                {selectedTicket.status === 'RESOLVED' && (
                  <Popconfirm title="Close this ticket?" onConfirm={handleCloseTicket}>
                    <Button className="rounded-lg h-9"><CloseCircleOutlined /> Close</Button>
                  </Popconfirm>
                )}
              </Space>
            )
          }
          className="rounded-l-2xl"
          styles={{ header: { borderBottom: '1px solid var(--color-border)' } }}
        >
          {loadingTicket ? (
            <div className="flex justify-center items-center h-full">
              <Spin tip="Loading ticket..." />
            </div>
          ) : selectedTicket ? (
            <div className="space-y-6">
              {/* Ticket Info */}
              <Card size="small" className="rounded-xl border-border bg-surface shadow-sm">
                <Title level={5} className="!mb-3 text-text-primary">{selectedTicket.subject}</Title>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Tag color={getCategoryInfo(selectedTicket.category).color} className="rounded-md border-0 m-0 font-medium">
                    {getCategoryInfo(selectedTicket.category).label}
                  </Tag>
                  {getPriorityTag(selectedTicket.priority)}
                  <div className="flex items-center text-text-tertiary text-xs ml-auto">
                    <ClockCircleOutlined className="mr-1" />
                    {dayjs(selectedTicket.createdAt).format('DD MMM YYYY, HH:mm')}
                  </div>
                </div>
                <Paragraph className="text-text-secondary leading-relaxed mb-0 bg-background-tertiary/30 p-3 rounded-lg border border-border/50">
                  {selectedTicket.description}
                </Paragraph>

                <Divider className="my-4 border-border/50" />

                <Row gutter={16}>
                  <Col span={12}>
                    <Text className="text-text-tertiary text-xs uppercase font-bold tracking-wider block mb-1">Submitted by</Text>
                    <div>
                      <Text strong className="text-text-primary block">{selectedTicket.submitterName}</Text>
                      <Text className="text-text-tertiary text-xs block">
                        {selectedTicket.submitterEmail}
                      </Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Text className="text-text-tertiary text-xs uppercase font-bold tracking-wider block mb-1">Created</Text>
                    <div>
                      <Text className="text-text-primary font-medium">{dayjs(selectedTicket.createdAt).format('DD MMM YYYY, HH:mm')}</Text>
                    </div>
                  </Col>
                </Row>

                {selectedTicket.assignedTo && (
                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-2">
                    <UserOutlined className="text-text-tertiary" />
                    <span className="text-text-tertiary text-sm">Assigned to:</span>
                    <Text strong className="text-text-primary">{selectedTicket.assignedTo.name}</Text>
                  </div>
                )}
              </Card>

              {/* Status Update */}
              {!['RESOLVED', 'CLOSED'].includes(selectedTicket.status) && (
                <Card size="small" className="rounded-xl border-border bg-background-tertiary/20">
                  <Text strong className="text-text-primary block mb-2">Quick Status Update:</Text>
                  <Space>
                    {selectedTicket.status !== 'IN_PROGRESS' && (
                      <Button size="small" onClick={() => handleUpdateStatus('IN_PROGRESS')} className="rounded-md">
                        Mark In Progress
                      </Button>
                    )}
                    {selectedTicket.status !== 'PENDING_USER' && (
                      <Button size="small" onClick={() => handleUpdateStatus('PENDING_USER')} className="rounded-md">
                        Pending User Response
                      </Button>
                    )}
                  </Space>
                </Card>
              )}

              {/* Resolution */}
              {selectedTicket.resolution && (
                <Card size="small" className="rounded-xl border-success-border bg-success-50">
                  <Title level={5} className="!mb-2 flex items-center gap-2 text-success-700">
                    <CheckCircleOutlined /> Resolution
                  </Title>
                  <Paragraph className="mb-0 text-text-primary">{selectedTicket.resolution}</Paragraph>
                </Card>
              )}

              <Divider className="border-border">Conversation</Divider>

              {/* Responses */}
              {selectedTicket.responses && selectedTicket.responses.length > 0 ? (
                <Timeline className="mt-4 px-2">
                  {selectedTicket.responses.map((response) => (
                    <Timeline.Item
                      key={response.id}
                      dot={
                        <Avatar
                          size="small"
                          className={response.isInternal ? 'bg-warning' : response.responder?.id === user?.userId ? 'bg-primary' : 'bg-success'}
                        >
                          <UserOutlined />
                        </Avatar>
                      }
                    >
                      <Card
                        size="small"
                        className={`rounded-xl border-border mb-2 ${response.isInternal ? 'bg-warning-50 border-warning-200' : 'bg-surface'}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <Space>
                            <Text strong className="text-text-primary">{response.responderName}</Text>
                            <Tag className="rounded-md border-0 m-0 text-[10px] font-bold">{response.responderRole}</Tag>
                            {response.isInternal && <Tag color="warning" className="rounded-md border-0 m-0 text-[10px] font-bold">Internal Note</Tag>}
                          </Space>
                          <Text type="secondary" className="text-xs">
                            {dayjs(response.createdAt).fromNow()}
                          </Text>
                        </div>
                        <Paragraph className="mb-0 text-text-secondary">{response.message}</Paragraph>
                      </Card>
                    </Timeline.Item>
                  ))}
                </Timeline>
              ) : (
                <Text className="text-text-tertiary italic">No responses yet</Text>
              )}

              {/* Reply Form */}
              {!['CLOSED'].includes(selectedTicket.status) && (
                <div className="pt-4 border-t border-border mt-4">
                  <Text strong className="block mb-3 text-text-primary">Add Response</Text>
                  <Form form={replyForm} onFinish={handleSubmitReply}>
                    <Form.Item
                      name="message"
                      rules={[{ required: true, message: 'Please enter your response' }]}
                    >
                      <TextArea rows={4} placeholder="Type your response..." className="rounded-xl border-border bg-background p-3" />
                    </Form.Item>
                    <Form.Item name="isInternal" valuePropName="checked" className="mb-4">
                      <Checkbox className="text-text-secondary">Internal note (not visible to user)</Checkbox>
                    </Form.Item>
                    <div className="flex justify-end">
                      <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submittingReply} className="rounded-xl h-10 font-bold px-6 shadow-md">
                        Send Response
                      </Button>
                    </div>
                  </Form>
                </div>
              )}
            </div>
          ) : null}
        </Drawer>

        {/* Assign Modal */}
        <Modal
          title={<div className="flex items-center gap-2"><TeamOutlined className="text-primary" /> Assign Ticket</div>}
          open={assignModalVisible}
          onCancel={() => {
            setAssignModalVisible(false);
            assignForm.resetFields();
          }}
          footer={null}
          className="rounded-2xl overflow-hidden"
        >
          <Form form={assignForm} layout="vertical" onFinish={handleAssignTicket} className="pt-4">
            <Form.Item
              name="assigneeId"
              label="Assign To"
              rules={[{ required: true, message: 'Please select an assignee' }]}
            >
              <Select placeholder="Select user" className="rounded-lg h-11">
                {assignableUsers.map((u) => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="remarks" label="Remarks (Optional)">
              <TextArea rows={3} placeholder="Add any notes..." className="rounded-lg bg-background border-border" />
            </Form.Item>
            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
              <Button onClick={() => setAssignModalVisible(false)} className="rounded-xl h-10 font-medium">Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submittingAction} className="rounded-xl h-10 font-bold">
                Assign
              </Button>
            </div>
          </Form>
        </Modal>

        {/* Resolve Modal */}
        <Modal
          title={<div className="flex items-center gap-2"><CheckCircleOutlined className="text-success" /> Resolve Ticket</div>}
          open={resolveModalVisible}
          onCancel={() => {
            setResolveModalVisible(false);
            resolveForm.resetFields();
          }}
          footer={null}
          className="rounded-2xl overflow-hidden"
        >
          <Form form={resolveForm} layout="vertical" onFinish={handleResolveTicket} className="pt-4">
            <Form.Item
              name="resolution"
              label="Resolution"
              rules={[{ required: true, message: 'Please provide resolution details' }]}
            >
              <TextArea rows={4} placeholder="Describe how the issue was resolved..." className="rounded-lg bg-background border-border p-3" />
            </Form.Item>
            <Form.Item name="remarks" label="Additional Remarks (Optional)">
              <TextArea rows={2} placeholder="Any additional notes..." className="rounded-lg bg-background border-border" />
            </Form.Item>
            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
              <Button onClick={() => setResolveModalVisible(false)} className="rounded-xl h-10 font-medium">Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submittingAction} className="rounded-xl h-10 font-bold bg-success border-0">
                Resolve Ticket
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default SupportDashboard;
