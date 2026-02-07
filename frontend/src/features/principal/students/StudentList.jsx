import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button, Tag, Avatar, Input, Select, Card, Dropdown, Modal, theme } from 'antd';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchStudents,
  updateStudent,
  deleteStudent,
  resetUserPassword,
  optimisticallyUpdateStudent,
  optimisticallyDeleteStudent,
  rollbackStudentOperation,
} from '../store/principalSlice';
import {
  selectStudentsList,
  selectStudentsLoading,
  selectStudentsPagination,
  selectLastFetched,
} from '../store/principalSelectors';
import DataTable from '../../../components/tables/DataTable';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  SearchOutlined,
  PlusOutlined,
  MoreOutlined,
  CheckCircleOutlined,
  StopOutlined,
  KeyOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { getStatusColor } from '../../../utils/format';
import ProfileAvatar from '../../../components/common/ProfileAvatar';
import StudentModal from './StudentModal';
import { useLookup } from '../../shared/hooks/useLookup';

const { Search } = Input;
const { Option } = Select;

const StudentList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  // Use memoized selectors from principalSelectors for better performance
  const list = useSelector(selectStudentsList);
  const loading = useSelector(selectStudentsLoading);
  const pagination = useSelector(selectStudentsPagination);
  const lastFetchedData = useSelector(selectLastFetched);
  const lastFetched = lastFetchedData?.students;

  // Use global lookup data
  const { activeBranches, activeBatches, loadBranches, loadBatches } = useLookup({
    include: ['branches', 'batches']
  });

  // Deduplicate branches by id to avoid duplicate filter options
  const uniqueBranches = useMemo(() => {
    if (!activeBranches) return [];
    const seen = new Set();
    return activeBranches.filter(branch => {
      if (seen.has(branch.id)) return false;
      seen.add(branch.id);
      return true;
    });
  }, [activeBranches]);

  // Deduplicate batches by id
  const uniqueBatches = useMemo(() => {
    if (!activeBatches) return [];
    const seen = new Set();
    return activeBatches.filter(batch => {
      if (seen.has(batch.id)) return false;
      seen.add(batch.id);
      return true;
    });
  }, [activeBatches]);

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    branchId: '',
    batchId: '',
    isActive: '',
    page: 1,
    limit: 10,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleOpenModal = (studentId = null) => {
    setEditingStudentId(studentId);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingStudentId(null);
  };

  const handleModalSuccess = () => {
    dispatch(fetchStudents({ ...filters, forceRefresh: true }));
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await dispatch(fetchStudents({ ...filters, forceRefresh: true })).unwrap();
      // Refresh lookup data
      loadBranches();
      loadBatches();
      toast.success('Data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, filters, loadBranches, loadBatches]);

  // Debounced search effect - 300ms delay
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    dispatch(fetchStudents(filters));
  }, [dispatch, filters]);

  const handleView = (record) => {
    navigate('/app/all-students?studentId=' + record.id);
  };

  const handleEdit = (record) => {
    handleOpenModal(record.id);
  };

  const handleToggleStatus = async (record) => {
    // Use User SOT pattern: prefer user.active, fallback to isActive
    const currentStatus = record.user?.active ?? record.isActive;
    const newStatus = !currentStatus;
    const actionText = newStatus ? 'activate' : 'deactivate';
    const previousList = [...list];
    const studentName = record.user?.name || record.name;

    Modal.confirm({
      title: `${newStatus ? 'Activate' : 'Deactivate'} Student`,
      content: `Are you sure you want to ${actionText} ${studentName}?`,
      okText: newStatus ? 'Activate' : 'Deactivate',
      okType: newStatus ? 'primary' : 'danger',
      onOk: async () => {
        // Optimistic update - update UI immediately
        dispatch(optimisticallyUpdateStudent({ id: record.id, data: { isActive: newStatus } }));
        toast.success(`Student ${newStatus ? 'activated' : 'deactivated'} successfully`);

        try {
          await dispatch(updateStudent({
            id: record.id,
            data: { isActive: newStatus }
          })).unwrap();
        } catch (error) {
          // Rollback on failure
          dispatch(rollbackStudentOperation({ list: previousList }));
          toast.error(error || `Failed to ${actionText} student`);
        }
      },
    });
  };

  const handleResetPassword = (record) => {
    const userId = record.user?.id;
    if (!userId) {
      toast.error('User account not found for this student');
      return;
    }

    Modal.confirm({
      title: 'Reset Password',
      content: `Are you sure you want to reset the password for ${record.user?.name || record.name}? A new password will be generated.`,
      okText: 'Reset Password',
      okType: 'primary',
      onOk: async () => {
        try {
          const result = await dispatch(resetUserPassword(userId)).unwrap();
          // Show success modal with new password (if available) or email notification message
          Modal.success({
            title: 'Password Reset Successful',
            content: (
              <div style={{ marginTop: 16 }}>
                <p><strong>Name:</strong> {result.name || record.name}</p>
                <p><strong>Email:</strong> {result.email || record.email}</p>
                {result.newPassword ? (
                  <>
                    <div style={{ padding: 12, backgroundColor: token.colorSuccessBg, border: `1px solid ${token.colorSuccessBorder}`, borderRadius: token.borderRadiusLG, marginTop: 12 }}>
                      <p style={{ fontSize: 14, color: token.colorTextSecondary, marginBottom: 4 }}>New Password:</p>
                      <p style={{ fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', color: token.colorSuccessText, userSelect: 'all' }}>{result.newPassword}</p>
                    </div>
                    <p style={{ fontSize: 12, color: token.colorTextDescription, marginTop: 8 }}>
                      Please share this password securely with the student. They will be required to change it on first login.
                    </p>
                  </>
                ) : (
                  <div style={{ padding: 12, backgroundColor: token.colorInfoBg, border: `1px solid ${token.colorInfoBorder}`, borderRadius: token.borderRadiusLG, marginTop: 12 }}>
                    <p style={{ fontSize: 14, color: token.colorInfoText }}>
                      A new password has been generated and sent to the student's email address.
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

  const handleDelete = (record) => {
    const previousList = [...list];

    Modal.confirm({
      title: 'Deactivate Student',
      content: `Are you sure you want to deactivate ${record.name}? The student will no longer be able to access the system but their data will be preserved.`,
      okText: 'Deactivate',
      okType: 'danger',
      onOk: async () => {
        // Optimistic update - remove from active list
        dispatch(optimisticallyDeleteStudent(record.id));
        toast.success('Student deactivated successfully');

        try {
          await dispatch(deleteStudent(record.id)).unwrap();
        } catch (error) {
          // Rollback on failure
          dispatch(rollbackStudentOperation({ list: previousList }));
          toast.error(error || 'Failed to deactivate student');
        }
      },
    });
  };

  const getActionMenuItems = (record) => [
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
      label: (record.user?.active ?? record.isActive) ? 'Deactivate' : 'Activate',
      icon: (record.user?.active ?? record.isActive) ? <StopOutlined /> : <CheckCircleOutlined />,
      onClick: () => handleToggleStatus(record),
      danger: (record.user?.active ?? record.isActive),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      label: 'Deactivate',
      icon: <StopOutlined />,
      onClick: () => handleDelete(record),
      danger: true,
    },
  ];

  // Memoized columns definition
  const columns = useMemo(() => [
    {
      title: 'Student',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ProfileAvatar profileImage={record.profileImage} />
          <div>
            <div style={{ fontWeight: 500 }}>{record.user?.name || name}</div>
            <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.user?.rollNumber || record.rollNumber}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'branchName',
      key: 'branchName',
      render: (branchName, record) => branchName || record.branch?.name || '-',
    },
    {
      title: 'Batch',
      dataIndex: 'batchName',
      key: 'batchName',
      render: (batchName, record) => batchName || record.batch?.name || '-',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      render: (email, record) => record.user?.email || email,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      // Use User SOT pattern: prefer user.active, fallback to isActive
      render: (isActive, record) => {
        const activeStatus = record.user?.active ?? isActive;
        return (
          <Tag color={activeStatus ? 'success' : 'default'} bordered={false}>
            {activeStatus ? 'Active' : 'Inactive'}
          </Tag>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_, record) => (
        <Dropdown
          menu={{ items: getActionMenuItems(record) }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button
            type="text"
            icon={<MoreOutlined style={{ fontSize: '18px' }} />}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          />
        </Dropdown>
      ),
    },
  ], [filters, list, token]);

  const handleSearch = useCallback((value) => {
    setSearchInput(value);
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    // Convert undefined to empty string (Select allowClear passes undefined)
    setFilters(prev => ({ ...prev, [key]: value ?? '', page: 1 }));
  }, []);

  const handlePageChange = useCallback((page, pageSize) => {
    setFilters(prev => ({ ...prev, page, limit: pageSize }));
  }, []);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, backgroundColor: token.colorBgLayout, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', color: token.colorTextHeading, margin: 0, letterSpacing: '-0.025em' }}>Students</h1>
          {lastFetched && (
            <span style={{ fontSize: 12, color: token.colorTextDescription }}>
              Updated {new Date(lastFetched).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            onClick={handleRefresh}
            loading={isRefreshing}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
          >
            Add Student
          </Button>
        </div>
      </div>

      <Card
        style={{
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: token.boxShadowTertiary,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
        bodyStyle={{ padding: 16 }}
      >
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Search
            placeholder="Search by name or roll number"
            allowClear
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            style={{ width: '100%', maxWidth: 300 }}
            prefix={<SearchOutlined style={{ color: token.colorTextDescription }} />}
          />
          <Select
            placeholder="Branch"
            allowClear
            style={{ width: '100%', maxWidth: 200 }}
            onChange={(value) => handleFilterChange('branchId', value)}
          >
            {uniqueBranches.map(branch => (
              <Option key={branch.id} value={branch.id}>{branch.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="Batch/Year"
            allowClear
            style={{ width: '100%', maxWidth: 150 }}
            onChange={(value) => handleFilterChange('batchId', value)}
          >
            {uniqueBatches.map(batch => (
              <Option key={batch.id} value={batch.id}>{batch.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="Status"
            allowClear
            style={{ width: '100%', maxWidth: 150 }}
            onChange={(value) => handleFilterChange('isActive', value)}
          >
            <Option value="true">Active</Option>
            <Option value="false">Inactive</Option>
          </Select>
        </div>
      </Card>

      <div style={{ backgroundColor: token.colorBgContainer, borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, boxShadow: token.boxShadowTertiary, overflow: 'hidden' }}>
        <DataTable
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
            showTotal: (total) => `Total ${total} students`,
          }}
        />
      </div>

      <StudentModal
        open={modalOpen}
        onClose={handleCloseModal}
        studentId={editingStudentId}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default StudentList;

