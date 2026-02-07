import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button, Tag, Avatar, Input, Select, Card, Modal, Dropdown, Table, Typography, Space, Tooltip } from 'antd';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchStaff,
  fetchPrincipalDashboard,
  updateStaff,
  toggleStaffStatus,
  resetUserPassword,
  optimisticallyUpdateStaff,
  rollbackStaffOperation,
} from '../store/principalSlice';
import {
  selectStaffList,
  selectStaffLoading,
  selectStaffPagination,
  selectLastFetched,
} from '../store/principalSelectors';
import {
  EyeOutlined,
  EditOutlined,
  UserOutlined,
  SearchOutlined,
  PlusOutlined,
  MoreOutlined,
  CheckCircleOutlined,
  StopOutlined,
  KeyOutlined,
  ReloadOutlined,
  PhoneOutlined,
  MailOutlined,
  TeamOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import ProfileAvatar from '../../../components/common/ProfileAvatar';
import StaffModal from './StaffModal';
import { useLookup } from '../../shared/hooks/useLookup';

const { Search } = Input;
const { Option } = Select;
const { Text } = Typography;

const StaffList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Use memoized selectors from principalSelectors for better performance
  const list = useSelector(selectStaffList);
  const loading = useSelector(selectStaffLoading);
  const pagination = useSelector(selectStaffPagination);
  const lastFetchedData = useSelector(selectLastFetched);
  const lastFetched = lastFetchedData?.staff;
  const [filters, setFilters] = useState({
    search: '',
    role: '',
     isActive: '',
    page: 1,
    limit: 10,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use global lookup data for branches
  const { activeBranches } = useLookup({ include: ['branches'] });

  const handleOpenModal = (staffId = null) => {
    setEditingStaffId(staffId);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingStaffId(null);
  };

  const handleModalSuccess = () => {
    dispatch(fetchStaff({ ...filters, forceRefresh: true }));
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await dispatch(fetchStaff({ ...filters, forceRefresh: true })).unwrap();
      toast.success('Data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, filters]);

  useEffect(() => {
    dispatch(fetchStaff(filters));
  }, [dispatch, filters]);

  const handleView = (record) => {
    // Navigate to faculty progress page with the selected faculty
    navigate(`/app/faculty-progress?facultyId=${record.id}`);
  };

  const handleEdit = (record) => {
    handleOpenModal(record.id);
  };

  const handleToggleStatus = async (record) => {
    // Staff records use 'active' boolean field
    const isCurrentlyActive = record.active === true;
    const actionText = isCurrentlyActive ? 'deactivate' : 'activate';
    const actionPast = isCurrentlyActive ? 'deactivated' : 'activated';
    const previousList = [...list];

    Modal.confirm({
      title: `${isCurrentlyActive ? 'Deactivate' : 'Activate'} Staff Member`,
      content: isCurrentlyActive
        ? `Are you sure you want to deactivate ${record.name}? They will no longer be able to access the system. ⚠️ All mentor assignments will be permanently deleted and new assignments will need to be created if the user is reactivated. Faculty visits done by this mentor will be preserved.`
        : `Are you sure you want to activate ${record.name}? They will regain access to the system. Note: Previous mentor assignments were permanently removed - new assignments will need to be created.`,
      okText: isCurrentlyActive ? 'Deactivate' : 'Activate',
      okType: isCurrentlyActive ? 'danger' : 'primary',
      onOk: async () => {
        // Optimistic update - update UI immediately
        dispatch(optimisticallyUpdateStaff({ id: record.id, data: { active: !isCurrentlyActive } }));

        try {
          const result = await dispatch(toggleStaffStatus(record.id)).unwrap();
          toast.success(result.message || `Staff member ${actionPast} successfully`);
          // Refresh dashboard stats (mentor count may change)
          dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
        } catch (error) {
          // Rollback on failure
          dispatch(rollbackStaffOperation({ list: previousList }));
          toast.error(error || `Failed to ${actionText} staff member`);
        }
      },
    });
  };

  const handleResetPassword = (record) => {
    Modal.confirm({
      title: 'Reset Password',
      content: `Are you sure you want to reset the password for ${record.name}? A new password will be generated.`,
      okText: 'Reset Password',
      okType: 'primary',
      onOk: async () => {
        try {
          // Staff records are User records, so record.id is the userId
          const result = await dispatch(resetUserPassword(record.id)).unwrap();
          // Show success modal with new password (if available) or email notification message
          Modal.success({
            title: 'Password Reset Successful',
            content: (
              <div className="space-y-3 mt-4">
                <p><strong>Name:</strong> {result.name || record.name}</p>
                <p><strong>Email:</strong> {result.email || record.email}</p>
                {result.newPassword ? (
                  <>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">New Password:</p>
                      <p className="text-lg font-mono font-bold text-green-700 select-all">{result.newPassword}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Please share this password securely with the staff member. They will be required to change it on first login.
                    </p>
                  </>
                ) : (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      A new password has been generated and sent to the staff member's email address.
                      They will be required to change it on first login.
                    </p>
                  </div>
                )}
              </div>
            ),
            width: 450,
            okText: 'Close',
          });
        } catch (error) {
          toast.error(error || 'Failed to reset password');
        }
      },
    });
  };

  const getActionMenuItems = (record) => {
    const isActive = record.active === true;
    return [
      {
        key: 'view',
        label: 'View Details',
        icon: <EyeOutlined />,
        onClick: () => handleView(record),
      },
      {
        key: 'edit',
        label: 'Edit',
        icon: <EditOutlined />,
        onClick: () => handleEdit(record),
      },
      {
        type: 'divider',
      },
      {
        key: 'resetPassword',
        label: 'Reset Password',
        icon: <KeyOutlined />,
        onClick: () => handleResetPassword(record),
      },
      {
        key: 'toggle',
        label: isActive ? 'Deactivate' : 'Activate',
        icon: isActive ? <StopOutlined /> : <CheckCircleOutlined />,
        onClick: () => handleToggleStatus(record),
        danger: isActive,
      },
    ];
  };

  const columns = useMemo(() => [
    {
      title: 'Staff Member',
      dataIndex: 'name',
      key: 'name',
      width: 280,
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <ProfileAvatar profileImage={record.profileImage} size={40} className="bg-primary/10 text-primary" />
          <div className="min-w-0">
            <Text className="block font-medium text-text-primary truncate">{record.name || 'N/A'}</Text>
            <div className="flex items-center gap-1 text-xs text-text-tertiary">
              <MailOutlined />
              <span className="truncate">{record.email || 'No email'}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Role & Designation',
      key: 'role',
      width: 200,
      render: (_, record) => (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Text className="font-medium text-text-primary">
              {record.designation || 'Staff'}
            </Text>
          </div>
          <Tag color="blue" className="rounded-full border-none bg-blue-50 text-blue-600 px-3">
            {record.role?.replace(/_/g, ' ') || 'N/A'}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Branch',
      key: 'branch',
      width: 180,
      render: (_, record) => {
        // Try to find branch name from lookup if we have branchId
        let branchName = record.branchName;
        if (!branchName && record.branchId && activeBranches) {
          const branch = activeBranches.find(b => b.id === record.branchId);
          if (branch) branchName = branch.name;
        }
        return (
          <Text className="text-text-secondary">
            {branchName || record.department || '-'}
          </Text>
        );
      },
    },
    {
      title: 'Contact',
      key: 'contact',
      width: 180,
      render: (_, record) => (
        <div className="flex flex-col gap-1">
           {record.phoneNo ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <PhoneOutlined className="text-text-tertiary" />
              <span>{record.phoneNo}</span>
            </div>
           ) : (
             <Text className="text-text-tertiary text-sm">-</Text>
           )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 120,
      render: (active) => (
        <Tag
          icon={active ? <CheckCircleOutlined /> : <StopOutlined />}
          color={active ? 'success' : 'default'}
          className="rounded-full px-3 py-0.5"
        >
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      align: 'right',
      render: (_, record) => (
        <Dropdown
          menu={{ items: getActionMenuItems(record) }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button
            type="text"
            icon={<MoreOutlined style={{ fontSize: '18px' }} />}
            className="flex items-center justify-center text-text-tertiary hover:text-primary hover:bg-primary/5"
          />
        </Dropdown>
      ),
    },
  ], [filters, list]);

  const handleSearch = useCallback((value) => {
    setFilters(prev => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value ?? '', page: 1 }));
  }, []);

  const handlePageChange = useCallback((page, pageSize) => {
    setFilters(prev => ({ ...prev, page, limit: pageSize }));
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 bg-background-secondary min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold text-text-primary m-0">Staff Members</h1>
            <Tag color="blue" className="rounded-full px-2 bg-blue-50 text-blue-600 border-blue-100">
              {pagination?.total || 0} Total
            </Tag>
          </div>
          <Text className="text-text-tertiary text-sm">Manage faculty, coordinators, and administrators</Text>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip title="Refresh List">
            <Button
              icon={<ReloadOutlined spin={isRefreshing} />}
              onClick={handleRefresh}
              loading={isRefreshing}
              disabled={loading}
              className="border-border text-text-secondary hover:text-primary hover:border-primary"
            />
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
            className="rounded-lg shadow-sm shadow-primary/20 hover:shadow-md transition-all bg-primary"
          >
            Add Staff
          </Button>
        </div>
      </div>

      {/* Filters & Table Card */}
      <Card className="rounded-2xl border-border shadow-sm" styles={{ body: { padding: 0 } }}>
        {/* Filters Toolbar */}
        <div className="p-4 border-b border-border/50 flex flex-col md:flex-row gap-4 items-center justify-between bg-white/50">
          <Input
            placeholder="Search by name, email or ID..."
            prefix={<SearchOutlined className="text-text-tertiary" />}
            allowClear
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full md:w-72 rounded-lg"
          />
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Select
              placeholder="All Roles"
              allowClear
              className="w-full md:w-48"
              onChange={(value) => handleFilterChange('role', value)}
            >
              <Option value="FACULTY_SUPERVISOR">Faculty Supervisor</Option>
              <Option value="TEACHER">Teacher</Option>
              <Option value="HOD">HOD</Option>
              <Option value="COORDINATOR">Coordinator</Option>
            </Select>
            <Select
              placeholder="Status"
              allowClear
              className="w-full md:w-32"
              onChange={(value) => handleFilterChange('isActive', value)}
            >
              <Option value="true">Active</Option>
              <Option value="false">Inactive</Option>
            </Select>
          </div>
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={list}
          loading={loading}
          rowKey="id"
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: pagination?.total || 0,
            onChange: handlePageChange,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
            className: "p-4",
          }}
          className="no-border-table"
        />
      </Card>

      <StaffModal
        open={modalOpen}
        onClose={handleCloseModal}
        staffId={editingStaffId}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default StaffList;
