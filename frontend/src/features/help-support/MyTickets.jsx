import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
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
  Empty,
  Spin,
  Avatar,
  Tooltip,
  Badge,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  UserOutlined,
  MessageOutlined,
  ReloadOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';
import { helpSupportService, SUPPORT_CATEGORIES, TICKET_STATUS, TICKET_PRIORITY } from '../../services/helpSupport.service';
import { useAuth } from '../../hooks/useAuth';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// Status options for admin dropdown
const STATUS_OPTIONS = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED'];

const MyTickets = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [priorityFilter, setPriorityFilter] = useState(null);

  // Status update state (for SYSTEM_ADMIN)
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Ticket detail drawer
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(false);

  // Reply form
  const [replyForm] = Form.useForm();
  const [submittingReply, setSubmittingReply] = useState(false);

  // New ticket modal
  const [newTicketVisible, setNewTicketVisible] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketForm] = Form.useForm();

  // Check if user is SYSTEM_ADMIN
  const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';

  // Fetch tickets based on user role
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      // SYSTEM_ADMIN sees all tickets, others see only their own
      const data = isSystemAdmin
        ? await helpSupportService.getAllTickets()
        : await helpSupportService.getMyTickets();
      setTickets(Array.isArray(data) ? data : []);
      setFilteredTickets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Filter tickets
  useEffect(() => {
    let filtered = [...tickets];

    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (ticket) =>
          ticket.subject?.toLowerCase().includes(search) ||
          ticket.ticketNumber?.toLowerCase().includes(search) ||
          ticket.description?.toLowerCase().includes(search) ||
          // For SYSTEM_ADMIN: also search by user name/email
          (isSystemAdmin && ticket.createdBy?.name?.toLowerCase().includes(search)) ||
          (isSystemAdmin && ticket.createdBy?.email?.toLowerCase().includes(search))
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((ticket) => ticket.status === statusFilter);
    }

    if (categoryFilter) {
      filtered = filtered.filter((ticket) => ticket.category === categoryFilter);
    }

    if (priorityFilter) {
      filtered = filtered.filter((ticket) => ticket.priority === priorityFilter);
    }

    setFilteredTickets(filtered);
  }, [tickets, searchText, statusFilter, categoryFilter, priorityFilter, isSystemAdmin]);

  // Handle status change (SYSTEM_ADMIN only)
  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      setUpdatingStatusId(ticketId);
      await helpSupportService.updateTicketStatus(ticketId, newStatus);
      toast.success('Status updated successfully');
      fetchTickets();
      // Also refresh selected ticket if open
      if (selectedTicket?.id === ticketId) {
        const updatedTicket = await helpSupportService.getTicketById(ticketId);
        setSelectedTicket(updatedTicket);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error(error.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatusId(null);
    }
  };

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
      await helpSupportService.respondToTicket(selectedTicket.id, values.message);
      toast.success('Reply sent successfully');
      replyForm.resetFields();
      // Refresh ticket details
      const updatedTicket = await helpSupportService.getTicketById(selectedTicket.id);
      setSelectedTicket(updatedTicket);
      // Refresh ticket list
      fetchTickets();
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Submit new ticket
  const handleSubmitTicket = async (values) => {
    setSubmittingTicket(true);
    try {
      await helpSupportService.createTicket({
        subject: values.subject,
        description: values.description,
        category: values.category,
        priority: values.priority || 'MEDIUM',
        attachments: [],
      });
      toast.success('Ticket submitted successfully');
      setNewTicketVisible(false);
      ticketForm.resetFields();
      fetchTickets();
    } catch (error) {
      console.error('Failed to submit ticket:', error);
      toast.error('Failed to submit ticket');
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Get status tag
  const getStatusTag = (status) => {
    const statusInfo = TICKET_STATUS[status] || { label: status, color: 'default' };
    return (
      <Tag color={statusInfo.color} className="rounded-md font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 border-0">
        {statusInfo.label}
      </Tag>
    );
  };

  // Get priority tag
  const getPriorityTag = (priority) => {
    const priorityInfo = TICKET_PRIORITY[priority] || { label: priority, color: 'default' };
    return (
      <Tag color={priorityInfo.color} className="rounded-md font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 border-0">
        {priorityInfo.label}
      </Tag>
    );
  };

  // Get category info
  const getCategoryInfo = (category) => {
    return SUPPORT_CATEGORIES[category] || { label: category, color: 'default' };
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format role display
  const formatRole = (role) => {
    if (!role) return '';
    return role
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Table columns - dynamically built based on user role
  const getColumns = () => {
    const baseColumns = [
      {
        title: 'Ticket #',
        dataIndex: 'ticketNumber',
        key: 'ticketNumber',
        width: 130,
        render: (text) => <Text strong className="text-blue-600 font-mono text-xs">{text}</Text>,
      },
      {
        title: 'Subject',
        dataIndex: 'subject',
        key: 'subject',
        ellipsis: true,
        render: (text) => <Text strong className="text-gray-800">{text}</Text>,
      },
    ];

    // Add "Submitted By" column for SYSTEM_ADMIN
    if (isSystemAdmin) {
      baseColumns.push({
        title: 'Submitted By',
        key: 'submittedBy',
        width: 180,
        render: (_, record) => (
          <div className="flex items-center gap-2">
            <Avatar
              size={32}
              style={{ backgroundColor: '#3b82f6' }}
              icon={<UserOutlined />}
            >
              {getInitials(record.createdBy?.name)}
            </Avatar>
            <div className="flex flex-col min-w-0">
              <Text strong className="text-xs truncate">{record.createdBy?.name || 'Unknown'}</Text>
              <Text className="text-[10px] text-gray-400 truncate">{record.createdBy?.email || '-'}</Text>
            </div>
          </div>
        ),
      });
    }

    // Continue with rest of columns
    baseColumns.push(
      {
        title: 'Category',
        dataIndex: 'category',
        key: 'category',
        width: 140,
        render: (category) => (
          <Tag color={getCategoryInfo(category).color} className="rounded-md font-medium text-[10px]">
            {getCategoryInfo(category).label}
          </Tag>
        ),
      },
      {
        title: 'Priority',
        dataIndex: 'priority',
        key: 'priority',
        width: 90,
        render: (priority) => getPriorityTag(priority),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: isSystemAdmin ? 150 : 120,
        render: (status, record) =>
          isSystemAdmin ? (
            <Select
              value={status}
              onChange={(val) => handleStatusChange(record.id, val)}
              loading={updatingStatusId === record.id}
              size="small"
              className="w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {STATUS_OPTIONS.map((s) => (
                <Select.Option key={s} value={s}>
                  <Badge
                    status={TICKET_STATUS[s]?.color === 'processing' ? 'processing' : TICKET_STATUS[s]?.color || 'default'}
                    text={<span className="text-xs">{TICKET_STATUS[s]?.label || s}</span>}
                  />
                </Select.Option>
              ))}
            </Select>
          ) : (
            getStatusTag(status)
          ),
      },
      {
        title: 'Updated',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 120,
        render: (date) => (
          <Tooltip title={dayjs(date).format('DD MMM YYYY, HH:mm')}>
            <span className="text-gray-500 text-xs">{dayjs(date).fromNow()}</span>
          </Tooltip>
        ),
      },
      {
        title: 'Replies',
        dataIndex: 'responseCount',
        key: 'responseCount',
        width: 70,
        align: 'center',
        render: (count) => (
          <Badge count={count} showZero color="#3b82f6" className="font-bold">
            <MessageOutlined className="text-gray-400" />
          </Badge>
        ),
      },
      {
        title: '',
        key: 'action',
        width: 90,
        align: 'right',
        render: (_, record) => (
          <Button
            type="default"
            size="small"
            onClick={() => handleViewTicket(record.id)}
            className="rounded-lg border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200 text-xs"
          >
            View
          </Button>
        ),
      }
    );

    return baseColumns;
  };

  const columns = getColumns();

  // Calculate stats
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => ['OPEN', 'IN_PROGRESS'].includes(t.status)).length,
    resolved: tickets.filter(t => t.status === 'RESOLVED').length,
    pending: tickets.filter(t => t.status === 'PENDING').length,
  };

  // Small Stat Card
  const StatCard = ({ title, value, icon, color, subtitle }) => (
    <Card
      className="h-full border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 rounded-xl"
      styles={{ body: { padding: '14px 12px' } }}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
          style={{ backgroundColor: `${color}15` }}
        >
          {React.cloneElement(icon, { style: { fontSize: '16px', color } })}
        </div>
        <Text className="text-xs font-medium text-gray-600 mb-1">{title}</Text>
        <span style={{ fontSize: '24px', fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
        {subtitle && <Text className="text-[10px] text-gray-400 mt-1">{subtitle}</Text>}
      </div>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className="max-w-7xl mx-auto !space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            {isSystemAdmin && (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/25">
                <CustomerServiceOutlined className="text-white text-lg" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                {isSystemAdmin ? 'Support Ticket Management' : 'My Support Tickets'}
              </h1>
              <Text className="text-text-tertiary text-sm">
                {isSystemAdmin
                  ? 'Manage and respond to all user support requests'
                  : 'Track and manage your support requests'}
              </Text>
            </div>
          </div>
          <Space size="small">
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchTickets}
              className="rounded-lg"
            >
              Refresh
            </Button>
            {!isSystemAdmin && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setNewTicketVisible(true)}
                className="rounded-lg shadow-md shadow-primary/20"
              >
                New Ticket
              </Button>
            )}
          </Space>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard title="Total Tickets" value={stats.total} icon={<MessageOutlined />} color="#3b82f6" subtitle={isSystemAdmin ? "All users" : "All time"} />
          <StatCard title="Open" value={stats.open} icon={<ClockCircleOutlined />} color="#f59e0b" subtitle="In progress" />
          <StatCard title="Resolved" value={stats.resolved} icon={<CheckCircleOutlined />} color="#22c55e" subtitle="Completed" />
          <StatCard title="Pending" value={stats.pending} icon={<ClockCircleOutlined />} color="#8b5cf6" subtitle="Awaiting reply" />
        </div>

        {/* Filters */}
        <Card className="rounded-xl border border-border shadow-sm" styles={{ body: { padding: '12px 16px' } }}>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center">
              <Input
                placeholder={isSystemAdmin ? "Search tickets, users..." : "Search tickets..."}
                prefix={<SearchOutlined className="text-gray-400" />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full sm:w-56 rounded-lg"
                allowClear
              />
              <Select
                placeholder="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                className="w-full sm:w-36"
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
                className="w-full sm:w-40"
                allowClear
              >
                {Object.values(SUPPORT_CATEGORIES).map((cat) => (
                  <Select.Option key={cat.value} value={cat.value}>
                    {cat.label}
                  </Select.Option>
                ))}
              </Select>
              {isSystemAdmin && (
                <Select
                  placeholder="Priority"
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  className="w-full sm:w-32"
                  allowClear
                >
                  {Object.values(TICKET_PRIORITY).map((p) => (
                    <Select.Option key={p.value} value={p.value}>
                      {p.label}
                    </Select.Option>
                  ))}
                </Select>
              )}
            </div>
            <Text className="text-text-tertiary text-xs">
              Showing {filteredTickets.length} of {tickets.length} tickets
            </Text>
          </div>
        </Card>

        {/* Tickets Table */}
        <Card className="rounded-xl border border-border shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
          <Table
            columns={columns}
            dataSource={filteredTickets}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => <span className="text-text-tertiary text-sm">{range[0]}-{range[1]} of {total}</span>,
              className: "px-4 py-4",
            }}
            size="small"
            locale={{
              emptyText: (
                <div className="py-12 flex flex-col items-center justify-center">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={<span className="text-text-tertiary">No tickets found</span>}
                  />
                  <Button type="primary" onClick={() => setNewTicketVisible(true)} className="mt-4 rounded-lg">
                    Submit Your First Ticket
                  </Button>
                </div>
              ),
            }}
            className="custom-table-small"
          />
        </Card>

        {/* Ticket Detail Drawer */}
        <Drawer
          title={
            selectedTicket ? (
              <div className="flex items-center gap-2">
                <Text strong className="text-sm font-mono text-primary">{selectedTicket.ticketNumber}</Text>
                {getStatusTag(selectedTicket.status)}
              </div>
            ) : 'Ticket Details'
          }
          width={520}
          open={drawerVisible}
          onClose={() => {
            setDrawerVisible(false);
            setSelectedTicket(null);
            replyForm.resetFields();
          }}
          styles={{ body: { padding: '16px' } }}
        >
          {loadingTicket ? (
            <div className="flex justify-center items-center h-64">
              <Spin tip="Loading..." />
            </div>
          ) : selectedTicket ? (
            <div className="space-y-4">
              {/* Ticket Info */}
              <div className="bg-background-secondary rounded-xl p-4 border border-border">
                <Text strong className="text-text-primary block mb-2">{selectedTicket.subject}</Text>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Tag color={getCategoryInfo(selectedTicket.category).color} className="rounded border-0 m-0 text-[10px]">
                    {getCategoryInfo(selectedTicket.category).label}
                  </Tag>
                  {getPriorityTag(selectedTicket.priority)}
                  <Text className="text-text-tertiary text-[10px] ml-auto flex items-center gap-1">
                    <ClockCircleOutlined />
                    {dayjs(selectedTicket.createdAt).format('MMM D, YYYY')}
                  </Text>
                </div>
                <Paragraph className="text-text-secondary text-sm leading-relaxed mb-0 bg-surface p-3 rounded-lg border border-border">
                  {selectedTicket.description}
                </Paragraph>

                {/* Submitted By (for SYSTEM_ADMIN) */}
                {isSystemAdmin && selectedTicket.createdBy && (
                  <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
                    <Avatar
                      size={36}
                      style={{ backgroundColor: '#3b82f6' }}
                      icon={<UserOutlined />}
                    >
                      {getInitials(selectedTicket.createdBy?.name)}
                    </Avatar>
                    <div className="flex-1">
                      <Text className="text-[10px] text-text-tertiary uppercase block">Submitted By</Text>
                      <Text strong className="text-sm">{selectedTicket.createdBy.name}</Text>
                      <Text className="text-xs text-text-tertiary block">{selectedTicket.createdBy.email}</Text>
                      {selectedTicket.createdBy.role && (
                        <Tag color="blue" className="mt-1 text-[9px] rounded">{formatRole(selectedTicket.createdBy.role)}</Tag>
                      )}
                    </div>
                  </div>
                )}

                {/* Assigned To */}
                {selectedTicket.assignedTo && (
                  <div className="mt-3 flex items-center gap-2 text-[10px] text-text-tertiary border-t border-border pt-2">
                    <Avatar size="small" icon={<UserOutlined />} className="w-5 h-5" />
                    <span>Assigned to: <strong className="text-text-secondary">{selectedTicket.assignedTo.name}</strong></span>
                  </div>
                )}

                {/* Status Update for SYSTEM_ADMIN */}
                {isSystemAdmin && (
                  <div className="mt-3 border-t border-border pt-3">
                    <Text className="text-[10px] text-text-tertiary uppercase block mb-2">Update Status</Text>
                    <Select
                      value={selectedTicket.status}
                      onChange={(val) => handleStatusChange(selectedTicket.id, val)}
                      loading={updatingStatusId === selectedTicket.id}
                      className="w-full"
                      size="small"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <Select.Option key={s} value={s}>
                          <Badge
                            status={TICKET_STATUS[s]?.color === 'processing' ? 'processing' : TICKET_STATUS[s]?.color || 'default'}
                            text={TICKET_STATUS[s]?.label || s}
                          />
                        </Select.Option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              {/* Resolution */}
              {selectedTicket.resolution && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                  <Text strong className="text-green-700 text-sm flex items-center gap-1.5 mb-2">
                    <CheckCircleOutlined /> Resolution
                  </Text>
                  <Paragraph className="mb-0 text-green-800 text-sm">{selectedTicket.resolution}</Paragraph>
                </div>
              )}

              {/* Responses */}
              <div>
                <Text className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3 block">Discussion</Text>
                {selectedTicket.responses && selectedTicket.responses.length > 0 ? (
                  <Timeline className="px-1">
                    {selectedTicket.responses
                      .filter(r => !r.isInternal)
                      .map((response) => (
                        <Timeline.Item
                          key={response.id}
                          dot={<Avatar size="small" className={response.responder?.id === user?.userId ? 'bg-primary' : 'bg-success'} icon={<UserOutlined />} style={{ width: 24, height: 24 }} />}
                        >
                          <Card size="small" className={`rounded-lg border mb-1 ${response.responder?.id === user?.userId ? 'bg-primary/5 border-primary/20' : 'border-border'}`} styles={{ body: { padding: '10px 12px' } }}>
                            <div className="flex justify-between items-center mb-1">
                              <Text strong className="text-text-primary text-sm">
                                {response.responderName}
                                {response.responder?.id === user?.userId && <Tag className="ml-1.5 rounded border-0 bg-primary/10 text-primary text-[9px]">YOU</Tag>}
                              </Text>
                              <Text className="text-text-tertiary text-[10px]">{dayjs(response.createdAt).fromNow()}</Text>
                            </div>
                            <Paragraph className="mb-0 text-text-secondary text-sm">{response.message}</Paragraph>
                          </Card>
                        </Timeline.Item>
                      ))}
                  </Timeline>
                ) : (
                  <div className="py-6 text-center bg-background-secondary rounded-lg border border-dashed border-border">
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-text-tertiary text-xs">No responses yet</span>} />
                  </div>
                )}
              </div>

              {/* Reply Form - Always show for SYSTEM_ADMIN, or for open tickets for regular users */}
              {(isSystemAdmin || !['RESOLVED', 'CLOSED'].includes(selectedTicket.status)) && (
                <div className="bg-surface rounded-xl border border-border p-4">
                  <Text strong className="block mb-2 text-sm text-text-primary">
                    {isSystemAdmin ? 'Post a Response' : 'Post a Reply'}
                  </Text>
                  <Form form={replyForm} onFinish={handleSubmitReply}>
                    <Form.Item name="message" rules={[{ required: true, message: 'Please enter your reply' }]} className="mb-3">
                      <TextArea rows={3} placeholder="Type your response..." className="rounded-lg" />
                    </Form.Item>
                    <div className="flex justify-end">
                      <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submittingReply} className="rounded-lg">
                        Send {isSystemAdmin ? 'Response' : 'Reply'}
                      </Button>
                    </div>
                  </Form>
                </div>
              )}
            </div>
          ) : null}
        </Drawer>

        {/* New Ticket Modal */}
        <Modal
          title="Submit New Ticket"
          open={newTicketVisible}
          onCancel={() => {
            setNewTicketVisible(false);
            ticketForm.resetFields();
          }}
          footer={null}
          width={520}
        >
          <Form
            form={ticketForm}
            layout="vertical"
            onFinish={handleSubmitTicket}
            className="pt-2"
          >
            <Form.Item
              name="subject"
              label="Subject"
              rules={[
                { required: true, message: 'Please enter a subject' },
                { min: 5, message: 'Subject must be at least 5 characters' },
              ]}
            >
              <Input placeholder="Brief description of your issue" className="rounded-lg" />
            </Form.Item>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select a category' }]}
              >
                <Select placeholder="Select category" className="rounded-lg">
                  {Object.values(SUPPORT_CATEGORIES).map((cat) => (
                    <Select.Option key={cat.value} value={cat.value}>
                      {cat.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="priority"
                label="Priority"
                initialValue="MEDIUM"
              >
                <Select className="rounded-lg">
                  {Object.values(TICKET_PRIORITY).map((p) => (
                    <Select.Option key={p.value} value={p.value}>
                      <Tag color={p.color} className="mr-0 rounded border-0 text-[10px]">{p.label}</Tag>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <Form.Item
              name="description"
              label="Description"
              rules={[
                { required: true, message: 'Please describe your issue' },
                { min: 20, message: 'Description must be at least 20 characters' },
              ]}
            >
              <TextArea rows={5} placeholder="Please describe your issue in detail..." className="rounded-lg" />
            </Form.Item>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button onClick={() => setNewTicketVisible(false)} className="rounded-lg">
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={submittingTicket} className="rounded-lg">
                Submit Ticket
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default MyTickets;
