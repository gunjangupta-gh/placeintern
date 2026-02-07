import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Table,
  Button,
  Input,
  Typography,
  Tag,
  Space,
  Modal,
  Tooltip,
  Alert,
  theme
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  BankOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  GlobalOutlined,
  TeamOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { useDebounce } from 'use-debounce';
import dayjs from 'dayjs';

import InstitutionModal from './InstitutionModal';
import {
  fetchInstitutions,
  deleteInstitution,
  selectInstitutions,
  selectInstitutionsLoading,
  selectInstitutionsPagination,
  fetchDashboardStats,
  selectDashboardStats
} from '../store/stateSlice';

const { Title, Paragraph, Text } = Typography;

const InstituteManagement = () => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  
  // Redux State
  const institutions = useSelector(selectInstitutions);
  const loading = useSelector(selectInstitutionsLoading);
  const pagination = useSelector(selectInstitutionsPagination);
  const dashboardStats = useSelector(selectDashboardStats);

  // Local State
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch] = useDebounce(searchText, 500);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingInstituteId, setEditingInstituteId] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [instituteToDelete, setInstituteToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Initial Fetch
  useEffect(() => {
    fetchData();
    dispatch(fetchDashboardStats());
  }, [dispatch, currentPage, pageSize, debouncedSearch]);

  const fetchData = (force = false) => {
    dispatch(fetchInstitutions({
      page: currentPage,
      limit: pageSize,
      search: debouncedSearch,
      forceRefresh: force
    }));
  };

  const handleRefresh = () => {
    fetchData(true);
    dispatch(fetchDashboardStats({ forceRefresh: true }));
  };

  // Modal Handlers
  const openCreateModal = () => {
    setEditingInstituteId(null);
    setModalVisible(true);
  };

  const openEditModal = (id) => {
    setEditingInstituteId(id);
    setModalVisible(true);
  };

  const handleDeleteClick = (record) => {
    setInstituteToDelete(record);
    setDeleteConfirmText('');
    setDeleteModalVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (!instituteToDelete) return;
    
    setDeleting(true);
    try {
      await dispatch(deleteInstitution(instituteToDelete.id)).unwrap();
      toast.success('Institution deleted successfully');
      setDeleteModalVisible(false);
      setInstituteToDelete(null);
      // Refresh list if needed (handled by redux optimistic update usually, but safe to fetch)
      if (institutions.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete institution');
    } finally {
      setDeleting(false);
    }
  };

  // Table Columns
  const columns = [
    {
      title: 'Institution Details',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-start gap-3">
          <div 
            className="mt-1 p-2 rounded-lg"
            style={{ 
              backgroundColor: token.colorBgContainer, 
              border: `1px solid ${token.colorBorder}`,
              color: token.colorPrimary 
            }}
          >
            <BankOutlined />
          </div>
          <div>
            <Text strong style={{ color: token.colorText }} className="block">{text}</Text>
            <Space size={4} className="text-xs" style={{ color: token.colorTextTertiary }}>
              <Tag variant="borderless" className="m-0 text-[10px]" style={{ backgroundColor: token.colorBgContainer, color: token.colorTextSecondary }}>{record.code}</Tag>
              <span>•</span>
              <span>{record.city}, {record.state}</span>
            </Space>
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => (
        <Tag color="blue" className="rounded-md font-medium">
          {type?.replace('_', ' ') || 'N/A'}
        </Tag>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      width: 250,
      render: (_, record) => (
        <div className="space-y-1 text-sm">
          {record.contactEmail && (
            <div className="flex items-center gap-2" style={{ color: token.colorTextSecondary }}>
              <div 
                className="w-4 h-4 flex items-center justify-center rounded-full"
                style={{ backgroundColor: token.colorBgContainer, color: token.colorPrimary }}
              >@</div>
              <span className="truncate max-w-[180px]">{record.contactEmail}</span>
            </div>
          )}
          {record.contactPhone && (
            <div className="flex items-center gap-2" style={{ color: token.colorTextSecondary }}>
              <div 
                className="w-4 h-4 flex items-center justify-center rounded-full"
                style={{ backgroundColor: token.colorBgContainer, color: token.colorSuccess }}
              >#</div>
              <span>{record.contactPhone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Stats',
      key: 'stats',
      width: 150,
      render: (_, record) => (
        <Space size={16}>
          <Tooltip title="Students">
            <div className="flex items-center gap-1.5" style={{ color: token.colorTextSecondary }}>
              <TeamOutlined />
              <span>{record._count?.Student ?? record.studentCount ?? 0}</span>
            </div>
          </Tooltip>
          <Tooltip title="Staff">
            <div className="flex items-center gap-1.5" style={{ color: token.colorTextSecondary }}>
              <SafetyCertificateOutlined />
              <span>{record._count?.users ?? record.facultyCount ?? 0}</span>
            </div>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive) => (
        <Tag 
          color={isActive ? 'success' : 'error'} 
          icon={isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          className="rounded-full px-2"
        >
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record.id)}
            style={{ color: token.colorPrimary }}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteClick(record)}
          />
        </Space>
      ),
    },
  ];

  // Calculated stats (fallback if dashboardStats is missing or needs augmentation)
  const stats = useMemo(() => {
    // If we have dashboard stats, use those (mapping fields as best guess based on typical API)
    if (dashboardStats) {
      return {
        total: dashboardStats.totalInstitutions || dashboardStats.institutions?.total || 0,
        active: dashboardStats.activeInstitutions || dashboardStats.institutions?.active || 0,
        inactive: (dashboardStats.institutions?.total || 0) - (dashboardStats.institutions?.active || 0),
        autonomous: dashboardStats.autonomousInstitutions || 0
      };
    }
    // Fallback to current list stats (incomplete but better than nothing)
    return {
      total: pagination?.total || institutions.length,
      active: institutions.filter(i => i.isActive).length,
      inactive: institutions.filter(i => !i.isActive).length,
      autonomous: institutions.filter(i => i.autonomousStatus).length
    };
  }, [dashboardStats, institutions, pagination]);

  return (
    <div className="p-4 md:p-6 min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Header - Compact */}
        <div 
          style={{
            padding: '12px 16px',
            backgroundColor: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BankOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
            <div>
              <Title level={4} style={{ margin: 0, lineHeight: 1.2, color: token.colorText }}>
                Institution Management
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Manage educational institutions and track performance
              </Text>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card size="small" className="rounded-lg hover:shadow-md transition-all duration-300" style={{ borderColor: token.colorBorder, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }} bodyStyle={{ padding: '10px' }}>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary }}
              >
                <BankOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: token.colorText }}>{stats.total}</div>
                <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: token.colorTextTertiary }}>Total Institutes</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-lg hover:shadow-md transition-all duration-300" style={{ borderColor: token.colorBorder, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }} bodyStyle={{ padding: '10px' }}>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: token.colorSuccessBg, color: token.colorSuccess }}
              >
                <CheckCircleOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: token.colorText }}>{stats.active}</div>
                <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: token.colorTextTertiary }}>Active</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-lg hover:shadow-md transition-all duration-300" style={{ borderColor: token.colorBorder, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }} bodyStyle={{ padding: '10px' }}>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: token.colorErrorBg, color: token.colorError }}
              >
                <CloseCircleOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: token.colorText }}>{stats.inactive}</div>
                <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: token.colorTextTertiary }}>Inactive</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-lg hover:shadow-md transition-all duration-300" style={{ borderColor: token.colorBorder, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }} bodyStyle={{ padding: '10px' }}>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: token.colorFillQuaternary, color: token.colorTextSecondary }}
              >
                <GlobalOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: token.colorText }}>{stats.autonomous}</div>
                <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: token.colorTextTertiary }}>Autonomous</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content Card */}
        <Card 
          className="rounded-3xl overflow-hidden" 
          style={{ borderColor: token.colorBorder, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}
          styles={{ body: { padding: '24px' } }}
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <Input
              placeholder="Search by name, code, or city..."
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="max-w-md h-10 rounded-xl"
              style={{ backgroundColor: token.colorBgLayout, borderColor: token.colorBorder }}
              allowClear
            />
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
                className="h-10 rounded-xl"
                style={{ borderColor: token.colorBorder }}
              >
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
                className="h-10 rounded-xl font-bold shadow-lg"
                style={{ backgroundColor: token.colorPrimary }}
              >
                Add Institute
              </Button>
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ borderColor: token.colorBorder, backgroundColor: token.colorBgContainer }}>
            <Table
              columns={columns}
              dataSource={institutions}
              rowKey="id"
              loading={loading}
              scroll={{ x: 'max-content' }}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: pagination?.total || 0,
                onChange: (page, size) => {
                  setCurrentPage(page);
                  setPageSize(size);
                },
                showSizeChanger: true,
                showTotal: (total, range) => (
                  <span style={{ color: token.colorTextTertiary }}>
                    Showing {range[0]}-{range[1]} of {total} institutes
                  </span>
                ),
                className: "px-4 py-4"
              }}
            />
          </div>
        </Card>

        {/* Create/Edit Modal */}
        <InstitutionModal
          open={modalVisible}
          onClose={() => setModalVisible(false)}
          institutionId={editingInstituteId}
          onSuccess={() => handleRefresh()}
        />

        {/* Delete Confirmation Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2" style={{ color: token.colorError }}>
              <DeleteOutlined />
              <span className="font-bold">Delete Institute</span>
            </div>
          }
          open={deleteModalVisible}
          onCancel={() => {
            setDeleteModalVisible(false);
            setInstituteToDelete(null);
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => setDeleteModalVisible(false)}
              className="rounded-lg font-medium"
            >
              Cancel
            </Button>,
            <Button
              key="delete"
              type="primary"
              danger
              loading={deleting}
              disabled={deleteConfirmText !== instituteToDelete?.name}
              onClick={handleDeleteConfirm}
              className="rounded-lg font-bold"
            >
              Delete
            </Button>,
          ]}
          centered
          className="rounded-2xl overflow-hidden"
        >
          {instituteToDelete && (
            <div className="space-y-4">
              <Alert
                message="Warning: Irreversible Action"
                description="This will permanently delete the institution and all associated data including students, faculty, and academic records."
                type="error"
                showIcon
                className="rounded-lg"
                style={{ borderColor: `${token.colorError}33`, backgroundColor: token.colorErrorBg }}
              />

              <div>
                <Text className="block mb-2 font-medium" style={{ color: token.colorText }}>
                  Type <Text code>{instituteToDelete.name}</Text> to confirm:
                </Text>
                <Input
                  placeholder="Type institute name..."
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  status={deleteConfirmText && deleteConfirmText !== instituteToDelete?.name ? "error" : ""}
                  className="rounded-lg h-10"
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default InstituteManagement;