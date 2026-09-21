import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button, Tag, Avatar, Input, Select, Card, Modal, Space, Tooltip, Switch, InputNumber, theme } from 'antd';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchStudents,
  updateStudent,
  toggleStudentStatus,
  resetUserPassword,
  optimisticallyUpdateStudent,
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
  UserOutlined,
  SearchOutlined,
  PlusOutlined,
  TrophyOutlined,
  KeyOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { getStatusColor } from '../../../utils/format';
import ProfileAvatar from '../../../components/common/ProfileAvatar';
import StudentModal from './StudentModal';
import { useLookup } from '../../shared/hooks/useLookup';

const { Search, TextArea } = Input;
const { Option } = Select;

// Keep in sync with backend DeactivationReason enum (see schema.prisma)
const DEACTIVATION_REASONS = [
  { value: 'DROPOUT', label: 'Dropout' },
  { value: 'TRANSFERRED', label: 'Transferred' },
  { value: 'DISCIPLINARY', label: 'Disciplinary Action' },
  { value: 'DATA_CLEANUP', label: 'Data Cleanup' },
  { value: 'OTHER', label: 'Other' },
];

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

  // Deactivation confirmation modal (opened by clicking the Status tag)
  const [deactivateModal, setDeactivateModal] = useState({ open: false, record: null });
  const [deactivateForm, setDeactivateForm] = useState({ reason: undefined, remarks: '' });
  const [deactivateSubmitting, setDeactivateSubmitting] = useState(false);

  // Placement confirmation modal (opened from the Actions column)
  const [placementModal, setPlacementModal] = useState({ open: false, record: null });
  const [placementForm, setPlacementForm] = useState({ isPlaced: false, placedCompany: '', placedPackage: null });
  const [placementSubmitting, setPlacementSubmitting] = useState(false);

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

  // --- Status tag click -> deactivate (with reason) or reactivate (simple confirm) ---
  const closeDeactivateModal = () => {
    setDeactivateModal({ open: false, record: null });
    setDeactivateForm({ reason: undefined, remarks: '' });
  };

  const handleStatusTagClick = (record) => {
    const activeStatus = record.user?.active ?? record.isActive;

    if (activeStatus) {
      setDeactivateModal({ open: true, record });
      return;
    }

    const studentName = record.user?.name || record.name;
    Modal.confirm({
      title: 'Activate Student',
      content: `Are you sure you want to activate ${studentName}?`,
      okText: 'Activate',
      okType: 'primary',
      onOk: async () => {
        try {
          await dispatch(toggleStudentStatus({ studentId: record.id })).unwrap();
          toast.success('Student activated successfully');
        } catch (error) {
          toast.error(error || 'Failed to activate student');
        }
      },
    });
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateModal.record) return;
    if (!deactivateForm.reason) {
      toast.error('Please select a reason for deactivation');
      return;
    }

    setDeactivateSubmitting(true);
    try {
      await dispatch(toggleStudentStatus({
        studentId: deactivateModal.record.id,
        reason: deactivateForm.reason,
        remarks: deactivateForm.remarks?.trim() || undefined,
      })).unwrap();
      toast.success('Student deactivated successfully');
      closeDeactivateModal();
    } catch (error) {
      toast.error(error || 'Failed to deactivate student');
    } finally {
      setDeactivateSubmitting(false);
    }
  };

  // --- Placement action (from the Actions column) ---
  const openPlacementModal = (record) => {
    setPlacementForm({
      isPlaced: record.isPlaced ?? false,
      placedCompany: record.placedCompany || '',
      placedPackage: record.placedPackage ?? null,
    });
    setPlacementModal({ open: true, record });
  };

  const closePlacementModal = () => {
    setPlacementModal({ open: false, record: null });
  };

  const handleConfirmPlacement = async () => {
    if (!placementModal.record) return;
    if (placementForm.isPlaced && !placementForm.placedCompany?.trim()) {
      toast.error('Company name is required when marking a student as placed');
      return;
    }

    setPlacementSubmitting(true);
    try {
      await dispatch(updateStudent({
        id: placementModal.record.id,
        data: {
          isPlaced: placementForm.isPlaced,
          placedCompany: placementForm.isPlaced ? placementForm.placedCompany.trim() : undefined,
          placedPackage: placementForm.isPlaced ? placementForm.placedPackage : undefined,
        },
      })).unwrap();
      toast.success(placementForm.isPlaced ? 'Student marked as placed' : 'Placement status cleared');
      closePlacementModal();
    } catch (error) {
      toast.error(error || 'Failed to update placement status');
    } finally {
      setPlacementSubmitting(false);
    }
  };

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
          <Tooltip title={activeStatus ? 'Click to deactivate' : 'Click to activate'}>
            <Tag
              color={activeStatus ? 'success' : 'default'}
              bordered={false}
              style={{ cursor: 'pointer' }}
              onClick={() => handleStatusTagClick(record)}
            >
              {activeStatus ? 'Active' : 'Inactive'}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="View Details">
            <Button type="text" icon={<EyeOutlined style={{ fontSize: 16 }} />} onClick={() => handleView(record)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined style={{ fontSize: 16 }} />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="Reset Password">
            <Button type="text" icon={<KeyOutlined style={{ fontSize: 16 }} />} onClick={() => handleResetPassword(record)} />
          </Tooltip>
          <Tooltip title={record.isPlaced ? 'Placed (click to view/edit)' : 'Mark as Placed'}>
            <Button
              type="text"
              icon={<TrophyOutlined style={{ fontSize: 16, color: record.isPlaced ? token.colorSuccess : undefined }} />}
              onClick={() => openPlacementModal(record)}
            />
          </Tooltip>
        </Space>
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

      {/* Deactivation confirmation modal - opened by clicking the Status tag */}
      <Modal
        title="Deactivate Student"
        open={deactivateModal.open}
        onCancel={closeDeactivateModal}
        onOk={handleConfirmDeactivate}
        okText="Deactivate"
        okButtonProps={{ danger: true, loading: deactivateSubmitting }}
        cancelButtonProps={{ disabled: deactivateSubmitting }}
        destroyOnClose
      >
        <p>
          Are you sure you want to deactivate{' '}
          <strong>{deactivateModal.record?.user?.name || deactivateModal.record?.name}</strong>?
          This will also deactivate their mentor assignment and internship application.
        </p>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontSize: 13, color: token.colorTextSecondary }}>Reason</div>
          <Select
            style={{ width: '100%' }}
            placeholder="Select a reason"
            value={deactivateForm.reason}
            onChange={(value) => setDeactivateForm(prev => ({ ...prev, reason: value }))}
          >
            {DEACTIVATION_REASONS.map(r => (
              <Option key={r.value} value={r.value}>{r.label}</Option>
            ))}
          </Select>
        </div>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: token.colorTextSecondary }}>Remarks (optional)</div>
          <TextArea
            rows={3}
            placeholder="Any additional detail, e.g. destination institution, notice reference, etc."
            value={deactivateForm.remarks}
            onChange={(e) => setDeactivateForm(prev => ({ ...prev, remarks: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Placement confirmation modal - opened from the Actions column */}
      <Modal
        title="Placement Status"
        open={placementModal.open}
        onCancel={closePlacementModal}
        onOk={handleConfirmPlacement}
        okText="Save"
        okButtonProps={{ loading: placementSubmitting }}
        cancelButtonProps={{ disabled: placementSubmitting }}
        destroyOnClose
      >
        <p>
          Placement status for <strong>{placementModal.record?.user?.name || placementModal.record?.name}</strong>
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Switch
            checked={placementForm.isPlaced}
            onChange={(checked) => setPlacementForm(prev => ({ ...prev, isPlaced: checked }))}
          />
          <span>{placementForm.isPlaced ? 'Placed' : 'Not Placed'}</span>
        </div>
        {placementForm.isPlaced && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontSize: 13, color: token.colorTextSecondary }}>Company</div>
              <Input
                placeholder="Company name"
                value={placementForm.placedCompany}
                onChange={(e) => setPlacementForm(prev => ({ ...prev, placedCompany: e.target.value }))}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 13, color: token.colorTextSecondary }}>Package (LPA)</div>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={0.1}
                placeholder="e.g. 3.5"
                value={placementForm.placedPackage}
                onChange={(value) => setPlacementForm(prev => ({ ...prev, placedPackage: value }))}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default StudentList;
