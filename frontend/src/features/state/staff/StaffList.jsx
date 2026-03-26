import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Table, Button, Tag, Space, Input, Avatar, Dropdown, App, Select, Row, Col } from 'antd';
import { toast } from 'react-hot-toast';
import { PlusOutlined, EditOutlined, SearchOutlined, UserOutlined, ReloadOutlined, MoreOutlined, KeyOutlined, FilterOutlined, ClearOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { fetchStaff, resetStaffPassword, toggleStaffStatus } from '../store/stateSlice';
import StaffModal from './StaffModal';
import { getImageUrl } from '../../../utils/imageUtils';
import { useInstitutions } from '../../shared/hooks/useLookup';

// Designation options for filter
const DESIGNATION_OPTIONS = [
  // Faculty/Teacher Designations
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'HOD', label: 'HOD' },
  { value: 'SENIOR_LECTURER', label: 'Senior Lecturer' },
  { value: 'LECTURER', label: 'Lecturer' },
  { value: 'ASSISTANT_PROFESSOR', label: 'Assistant Professor' },
  { value: 'FOREMAN_INSTRUCTOR', label: 'Foreman Instructor' },
  { value: 'WORKSHOP_INSTRUCTOR', label: 'Workshop Instructor' },
  { value: 'WORKSHOP_SUPERINTENDENT', label: 'Workshop Superintendent' },
  { value: 'WORKSHOP_FOREMAN', label: 'Workshop Foreman' },
  { value: 'LAB_TECHNICIAN', label: 'Lab Technician' },
  { value: 'TECHNICIAN', label: 'Technician' },
  { value: 'INSTRUCTOR', label: 'Instructor' },
  { value: 'SYSTEM_ANALYST', label: 'System Analyst' },
  { value: 'SYSTEM_ADMINISTRATOR', label: 'System Administrator' },
  { value: 'SYSTEM_MANAGER', label: 'System Manager' },
  { value: 'PROGRAMMER', label: 'Programmer' },
  { value: 'NETWORK_ENGINEER', label: 'Network Engineer' },
  { value: 'COMPUTER_OPERATOR', label: 'Computer Operator' },
  { value: 'LIBRARIAN', label: 'Librarian' },
  { value: 'TPO', label: 'TPO' },
  { value: 'FASHION_DESIGNER', label: 'Fashion Designer' },
  { value: 'PEON', label: 'Peon' },
  // Admin Staff Designations
  { value: 'ASSTT_DIRECTOR', label: 'Asstt. Director' },
  { value: 'ADDITIONAL_DIRECTOR', label: 'Additional Director' },
  { value: 'DEPUTY_DIRECTOR_STAFF', label: 'Deputy Director (Staff)' },
  { value: 'DEPUTY_DIRECTOR_CONDUCT', label: 'Deputy Director (Conduct)' },
  { value: 'DEPUTY_DIRECTOR_PLANNING', label: 'Deputy Director (Planning)' },
  { value: 'DIRECTOR_ACADEMICS', label: 'Director (Academics)' },
  { value: 'REGISTRAR', label: 'Registrar' },
  { value: 'HOD_CONTROLLER_EXAMINATIONS', label: 'HOD - Controller (Examinations)' },
  { value: 'DEMONSTRATOR', label: 'Demonstrator' },
  { value: 'STENOTYPIST', label: 'Stenotypist' },
  { value: 'CLERK', label: 'Clerk' },
  { value: 'JR_SCALE_STENOGRAPHER', label: 'Jr. Scale Stenographer' },
  { value: 'JUNIOR_ASSTT', label: 'Junior Asstt.' },
  { value: 'SR_ASSTT', label: 'Sr. Asstt.' },
  { value: 'SUPDT_GRADE_2', label: 'Supdt. Grade 2' },
  { value: 'OTHER', label: 'Other' },
];

const StaffList = () => {
  const { modal } = App.useApp();
  const dispatch = useDispatch();
  const { list: staff, loading, pagination } = useSelector((state) => state.state.staff);

  // Use global lookup data for institutions
  const { activeInstitutions } = useInstitutions();

  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({
    institutionId: '',
    role: '',
    branchName: '',
    designationEnum: '',
    active: '',
  });
  const [tableParams, setTableParams] = useState({
    page: 1,
    limit: 10,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const loadStaff = useCallback((params = {}) => {
    dispatch(fetchStaff({
      page: tableParams.page,
      limit: tableParams.limit,
      search: searchText,
      ...filters,
      ...params,
    }));
  }, [dispatch, tableParams.page, tableParams.limit, searchText, filters]);

  // Institutions are automatically loaded by useInstitutions hook

  useEffect(() => {
    loadStaff();
  }, []);

  const handleOpenModal = (staffId = null) => {
    setEditingStaffId(staffId);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingStaffId(null);
  };

  const handleModalSuccess = () => {
    loadStaff({ forceRefresh: true });
  };

  const handleResetPassword = (id, name) => {
    modal.confirm({
      title: 'Reset Password',
      content: (
        <div>
          <p>Are you sure you want to reset password for <strong>{name}</strong>?</p>
          <p className="text-gray-500 text-sm">A new password will be generated.</p>
        </div>
      ),
      okText: 'Reset Password',
      okType: 'primary',
      confirmLoading: resettingId === id,
      onOk: async () => {
        setResettingId(id);
        try {
          const result = await dispatch(resetStaffPassword(id)).unwrap();
          toast.success('Password reset successfully');
          modal.success({
            title: 'Password Reset Successful',
            content: (
              <div>
                <p>New password has been generated:</p>
                <p className="font-mono bg-gray-100 p-2 rounded my-2 select-all">{result.newPassword}</p>
                <p className="text-sm text-gray-500">Please share this password securely with the staff member.</p>
              </div>
            ),
            width: 500,
          });
        } catch (error) {
          toast.error(error?.message || 'Failed to reset password');
          throw error;
        } finally {
          setResettingId(null);
        }
      },
    });
  };

  const handleToggleStatus = (id, name, isCurrentlyActive) => {
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    const actionPast = isCurrentlyActive ? 'deactivated' : 'activated';

    modal.confirm({
      title: `${isCurrentlyActive ? 'Deactivate' : 'Activate'} Staff Member`,
      content: isCurrentlyActive
        ? `Are you sure you want to deactivate ${name}? They will no longer be able to access the system. ⚠️ All mentor assignments will be permanently deleted and new assignments will need to be created if the user is reactivated. Faculty visits done by this mentor will be preserved.`
        : `Are you sure you want to activate ${name}? They will regain access to the system. Note: Previous mentor assignments were permanently removed - new assignments will need to be created.`,
      okText: isCurrentlyActive ? 'Deactivate' : 'Activate',
      okType: isCurrentlyActive ? 'danger' : 'primary',
      confirmLoading: togglingId === id,
      onOk: async () => {
        setTogglingId(id);
        try {
          const result = await dispatch(toggleStaffStatus(id)).unwrap();
          toast.success(result.message || `Staff member ${actionPast} successfully`);
          loadStaff({ forceRefresh: true });
        } catch (error) {
          toast.error(error?.message || `Failed to ${action} staff member`);
          throw error;
        } finally {
          setTogglingId(null);
        }
      },
    });
  };

  const staffList = Array.isArray(staff) ? staff : [];

  // Handle search
  const handleSearch = (value) => {
    setSearchText(value);
    setTableParams(prev => ({ ...prev, page: 1 }));
    loadStaff({ search: value, page: 1 });
  };

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Apply filters
  const applyFilters = () => {
    setTableParams(prev => ({ ...prev, page: 1 }));
    loadStaff({ ...filters, page: 1 });
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      institutionId: '',
      role: '',
      branchName: '',
      designationEnum: '',
      active: '',
    });
    setSearchText('');
    setTableParams(prev => ({ ...prev, page: 1 }));
    loadStaff({ forceRefresh: true, page: 1 });
  };

  // Handle table change (pagination)
  const handleTableChange = (paginationConfig) => {
    const newParams = {
      page: paginationConfig.current,
      limit: paginationConfig.pageSize,
    };
    setTableParams(newParams);
    loadStaff({ ...newParams, search: searchText, ...filters });
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'TEACHER': return 'blue';
      case 'FACULTY_COORDINATOR': return 'purple';
      case 'PRINCIPAL': return 'gold';
      case 'ADMIN_STAFF': return 'cyan';
      default: return 'default';
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      STUDENT: 'Student',
      PRINCIPAL: 'Principal',
      TEACHER: 'Teacher',
      FACULTY_COORDINATOR: 'Faculty Coordinator',
      PRINCIPAL: 'Principal',
      ADMIN_STAFF: 'Admin Staff',
    };
    return labels[role] || role;
  };

  const columns = [
    {
      title: 'Staff Member',
      key: 'staff',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={getImageUrl(record.profileImage)} />
          <div>
            <div className="font-medium">{record.name}</div>
            <div className="text-gray-500 text-xs">{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={getRoleColor(role)}>
          {getRoleLabel(role)}
        </Tag>
      ),
    },
    {
      title: 'Institution',
      key: 'institution',
      render: (_, record) => record.Institution?.name || 'Not Assigned',
    },
    {
      title: 'Branch',
      dataIndex: 'branchName',
      key: 'branchName',
      render: (text) => text || '-',
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      render: (text) => text || '-',
    },
    {
      title: 'Phone',
      dataIndex: 'phoneNo',
      key: 'phoneNo',
      render: (text) => text || 'N/A',
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'status',
      render: (active) => (
        <Tag color={active !== false ? 'green' : 'red'}>
          {active !== false ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const isActive = record.active !== false;

        const handleMenuClick = ({ key }) => {
          switch (key) {
            case 'edit':
              handleOpenModal(record.id);
              break;
            case 'reset-password':
              handleResetPassword(record.id, record.name);
              break;
            case 'toggle-status':
              handleToggleStatus(record.id, record.name, isActive);
              break;
            default:
              break;
          }
        };

        const isLoading = resettingId === record.id || togglingId === record.id;

        const menuItems = [
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Edit',
            disabled: isLoading,
          },
          {
            key: 'reset-password',
            icon: <KeyOutlined />,
            label: 'Reset Password',
            disabled: isLoading,
          },
          {
            type: 'divider',
          },
          {
            key: 'toggle-status',
            icon: isActive ? <StopOutlined /> : <CheckCircleOutlined />,
            label: isActive ? 'Deactivate' : 'Activate',
            danger: isActive,
            disabled: isLoading,
          },
        ];

        return (
          <Dropdown
            menu={{ items: menuItems, onClick: handleMenuClick }}
            trigger={['click']}
            placement="bottomRight"
            disabled={isLoading}
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              size="small"
              disabled={isLoading}
            />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div className="p-6">
      <Card
        title="Staff Management"
        extra={
          <Space>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadStaff({ forceRefresh: true })}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenModal()}
            >
              Add Staff
            </Button>
          </Space>
        }
        variant="borderless"
      >
        {/* Search and Filters */}
        <div className="mb-4">
          <Input.Search
            placeholder="Search by name, email, or designation..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 300 }}
            allowClear
            enterButton
          />
        </div>

        {showFilters && (
          <div className="mb-4 p-4 bg-gray-50 rounded">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Institution"
                  style={{ width: '100%' }}
                  allowClear
                  value={filters.institutionId || undefined}
                  onChange={(value) => handleFilterChange('institutionId', value || '')}
                  showSearch
                  optionFilterProp="children"
                >
                  {activeInstitutions?.map(inst => (
                    <Select.Option key={inst.id} value={inst.id}>
                      {inst.name}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Role"
                  style={{ width: '100%' }}
                  allowClear
                  value={filters.role || undefined}
                  onChange={(value) => handleFilterChange('role', value || '')}
                >
                  <Select.Option value="PRINCIPAL">Principal</Select.Option>
                  <Select.Option value="TEACHER">Teacher</Select.Option>
                  <Select.Option value="FACULTY_COORDINATOR">Faculty Coordinator</Select.Option>
                  <Select.Option value="ADMIN_STAFF">Admin Staff</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Input
                  placeholder="Branch"
                  value={filters.branchName}
                  onChange={(e) => handleFilterChange('branchName', e.target.value)}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Designation"
                  style={{ width: '100%' }}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={filters.designationEnum || undefined}
                  onChange={(value) => handleFilterChange('designationEnum', value || '')}
                  options={DESIGNATION_OPTIONS}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Status"
                  style={{ width: '100%' }}
                  allowClear
                  value={filters.active || undefined}
                  onChange={(value) => handleFilterChange('active', value || '')}
                >
                  <Select.Option value="true">Active</Select.Option>
                  <Select.Option value="false">Inactive</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Space>
                  <Button type="primary" onClick={applyFilters}>
                    Apply Filters
                  </Button>
                  <Button icon={<ClearOutlined />} onClick={clearFilters}>
                    Clear
                  </Button>
                </Space>
              </Col>
            </Row>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={staffList}
          loading={loading}
          rowKey="id"
          onChange={handleTableChange}
          pagination={{
            current: pagination?.page || tableParams.page,
            pageSize: pagination?.limit || tableParams.limit,
            total: pagination?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} staff members`,
          }}
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
